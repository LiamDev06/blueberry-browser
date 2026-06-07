import { WebContents } from "electron";
import { stepCountIs } from "ai";
import type { Window } from "../Window";
import type { LLMClient } from "./LLMClient";
import type { AgentRequest, AgentRun } from "@shared/types";
import { generateGoal, type TaskGoal } from "./AgentGoal";
import { ElementRegistry } from "../page/registry";
import type { ToolDependencies } from "./tools/ToolContext";
import { agentTools } from "./tools/ToolRegistry";

const MAX_STEPS = 60;
const EMIT_THROTTLE_MS = 40;

export class BrowserAgent {
  private readonly webContents: WebContents;
  private readonly llm: LLMClient;
  private window: Window | null = null;
  private running = false;
  private aborted = false;

  private run: AgentRun | null = null;
  private lastEmit = 0;
  private emitTimer: NodeJS.Timeout | null = null;

  constructor(webContents: WebContents, llm: LLMClient) {
    this.webContents = webContents;
    this.llm = llm;
  }

  setWindow(window: Window): void {
    this.window = window;
  }

  get isRunning(): boolean {
    return this.running;
  }

  stop(): void {
    this.aborted = true;
  }

  private get overlay() {
    return this.window?.agentOverlay ?? null;
  }

  private emit(force = false): void {
    if (!this.run) {
      return;
    }

    const send = (): void => {
      this.lastEmit = Date.now();
      if (this.emitTimer) {
        clearTimeout(this.emitTimer);
        this.emitTimer = null;
      }

      if (!this.webContents.isDestroyed()) {
        this.webContents.send("agent-activity", this.run);
      }
    };
    
    if (force) {
      return send();
    }
    
    const since = Date.now() - this.lastEmit;
    if (since >= EMIT_THROTTLE_MS) {
      send();
    } else if (!this.emitTimer) {
      this.emitTimer = setTimeout(send, EMIT_THROTTLE_MS - since);
    }
  }

  async runTask(request: AgentRequest): Promise<void> {
    if (this.running) {
      return;
    }

    const tab = this.window?.activeTab ?? null;

    const run: AgentRun = {
      id: request.messageId,
      request: request.message,
      goal: "",
      criteria: [],
      items: [],
      status: "planning",
      summary: "",
    };

    this.run = run;
    this.emit(true);

    if (!tab) {
      run.status = "error";
      run.summary = "There is no active tab to control.";
      this.emit(true);
      return;
    }

    this.running = true;
    this.aborted = false;

    try {
      const goal = await generateGoal(this.llm, request.message, tab.url);
      run.goal = goal.goal;
      run.criteria = goal.criteria.map((criterion) => ({ text: criterion, met: null }));
      run.status = "running";
      this.emit(true);

      this.overlay?.show(goal.goal, this.window?.sidebar.getIsVisible() ?? true);

      const registry = new ElementRegistry();
      const initial = await registry.observe(tab);
      const dependencies: ToolDependencies = {
        tab,
        run,
        goal,
        llm: this.llm,
        overlay: this.overlay,
        registry,
        isAborted: () => this.aborted,
        emit: () => this.emit(true),
      };
      
      const result = this.llm.streamWithTools(
        this.systemPrompt(),
        this.taskPrompt(request.message, goal, initial),
        agentTools.bind(dependencies),
        [
          stepCountIs(MAX_STEPS),
          () => this.aborted || run.status === "done",
        ]
      );

      for await (const part of result.fullStream) {
        switch (part.type) {
          case "text-start": {
            run.items.push({ id: part.id, kind: "text", text: "" });
            this.emit();
            break;
          }
          case "text-delta": {
            const item = run.items.find(
              (item) => item.kind === "text" && item.id === part.id
            );
            if (item) {
              item.text = (item.text || "") + part.text;
              this.emit();
            }
            break;
          }
          case "error": {
            console.error("Agent stream error:", part.error);
            break;
          }
        }
      }

      this.finalize(run);
      this.emit(true);
    } catch (error) {
      console.error("Browser agent error:", error);
      run.status = "error";
      run.summary =
        error instanceof Error ? error.message : "Something went wrong.";
      this.emit(true);
    } finally {
      this.overlay?.hide();
      this.running = false;
    }
  }

  private finalize(run: AgentRun): void {
    if (this.aborted) {
      run.status = "stopped";
      if (!run.summary) {
        run.summary = "Stopped. Control handed back to you.";
      }
    } else if (run.status !== "done") {
      run.status = "done";
      if (!run.summary) {
        run.summary = "I reached the step limit before fully completing this.";
      }
    }
  }

  private taskPrompt(query: string, goal: TaskGoal, observation: string): string {
    const criteria = goal.criteria.length
      ? `\n\nSuccess criteria (the goal is met when these are satisfied):\n${goal.criteria
          .map((criterion, i) => `${i + 1}. ${criterion}`)
          .join("\n")}`
      : "";
    return `User request: ${query}\n\nGoal: ${goal.goal}${criteria}\n\nCurrent page:\n${observation}`;
  }

  private systemPrompt(): string {
    return [
      "You are a friendly browser agent operating a real web browser on the user's behalf.",
      "You are given a goal and a short checklist. Make the page satisfy the goal's intent.",
      "Each step you get a snapshot of the current page: its URL and a numbered list of interactive elements. Indices are re-numbered every step — always use the latest.",
      "",
      "Voice: Talk to the user naturally and warmly, in the first person, as you work. Before an action, write ONE short, friendly sentence about what you're doing and why (e.g. \"Let me open the pricing page to check the plans.\"). Keep it conversational — never mention tools, indices, or coordinates.",
      "",
      "How to act:",
      "- Narrate briefly, then take ONE action, then look at the result.",
      "- Only use element indices from the latest snapshot.",
      "- If a link/button is inside a dropdown or flyout, hover() its trigger first; its items then appear in the next snapshot.",
      "- If something isn't visible, scroll to reveal it, or navigate to a likely URL.",
      "- Don't repeat an action that changed nothing; try another way.",
      "- When you believe the goal's intent is met, call done() with a natural summary or the answer. A validator checks the page; if it isn't met it tells you what's missing and you keep going.",
      "- Only give up (done, explaining why) if the goal is genuinely impossible.",
    ].join("\n");
  }
}

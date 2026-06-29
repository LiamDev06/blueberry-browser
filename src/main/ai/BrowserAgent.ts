import { WebContents } from "electron";
import { stepCountIs } from "ai";
import type { Window } from "../Window";
import type { LLMClient } from "./LLMClient";
import type { AgentRequest, AgentRun, RunStatus } from "@shared/types";
import { generateGoal, type TaskGoal } from "./AgentGoal";
import { ElementRegistry } from "../page/registry";
import type { ToolDependencies } from "./ToolContext";
import { agentTools } from "./ToolRegistry";
import type { MemoryStore } from "./MemoryStore";
import type { RemixStore } from "../page/RemixStore";

const MAX_STEPS = 60;
const EMIT_THROTTLE_MS = 40;

export class BrowserAgent {
  private readonly webContents: WebContents;
  private readonly llm: LLMClient;
  private readonly memory: MemoryStore;
  private readonly remixStore: RemixStore;
  private window: Window | null = null;
  private running = false;
  private aborted = false;
  private abortController: AbortController | null = null;

  private run: AgentRun | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private dirty = false;
  
  private pendingAnswers = new Map<string, (answer: string) => void>();

  constructor(
    webContents: WebContents,
    llm: LLMClient,
    memory: MemoryStore,
    remixStore: RemixStore
  ) {
    this.webContents = webContents;
    this.llm = llm;
    this.memory = memory;
    this.remixStore = remixStore;
  }

  setWindow(window: Window): void {
    this.window = window;
  }

  get isRunning(): boolean {
    return this.running;
  }

  stop(): void {
    this.aborted = true;
    for (const resolve of this.pendingAnswers.values()) {
      resolve("");
    }
    this.pendingAnswers.clear();
    this.abortController?.abort();
  }

  private awaitAnswer(id: string): Promise<string> {
    return new Promise<string>((resolve) => {
      this.pendingAnswers.set(id, resolve);
    });
  }

  answerQuestion(id: string, answer: string): void {
    const resolve = this.pendingAnswers.get(id);
    if (!resolve) {
      return;
    }
    this.pendingAnswers.delete(id);

    const item = this.run?.items.find(
      (item) => item.kind === "question" && item.id === id
    );
    if (item) {
      item.answer = answer;
    }
    this.setStatus("running");
    resolve(answer);
  }

  private get overlay() {
    return this.window?.agentOverlay ?? null;
  }

  // Push the latest run snapshot to the renderer immediately
  private flush(): void {
    this.dirty = false;
    if (!this.run || this.webContents.isDestroyed()) {
      return;
    }
    this.webContents.send("agent-activity", this.run);
  }

  private setStatus(status: RunStatus): void {
    if (!this.run) {
      return;
    }
    this.run.status = status;
    this.flush();
  }

  async runTask(request: AgentRequest): Promise<void> {
    if (this.running) {
      return;
    }

    const window = this.window;
    const tab = window?.activeTab ?? null;

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
    this.flush();

    if (!tab || !window) {
      run.summary = "There is no active tab to control.";
      this.setStatus("error");
      return;
    }

    this.running = true;
    this.aborted = false;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const goal = await generateGoal(this.llm, request.message, tab.url);
      run.goal = goal.goal;
      run.criteria = goal.criteria.map((criterion) => ({ text: criterion, met: null }));
      this.setStatus("running");

      this.overlay?.show(goal.goal, this.window?.sidebar.getIsVisible() ?? true);
      this.window?.onAgentRunStarted();

      const registry = new ElementRegistry();
      const initial = await registry.observe(tab);
      const dependencies: ToolDependencies = {
        tab,
        window,
        run,
        goal,
        llm: this.llm,
        memory: this.memory,
        remixStore: this.remixStore,
        overlay: this.overlay,
        registry,
        isAborted: () => this.aborted,
        emit: () => this.flush(),
        awaitAnswer: (id) => this.awaitAnswer(id),
      };
      
      const result = this.llm.streamWithTools(
        this.systemPrompt(),
        this.taskPrompt(request.message, goal, initial),
        agentTools.bind(dependencies),
        [
          stepCountIs(MAX_STEPS),
          () => this.aborted || run.status === "done",
        ],
        signal
      );

      this.flushTimer = setInterval(() => {
        if (this.dirty) {
          this.flush();
        }
      }, EMIT_THROTTLE_MS);

      for await (const part of result.fullStream) {
        switch (part.type) {
          case "text-start": {
            run.items.push({ id: part.id, kind: "text", text: "" });
            this.dirty = true;
            break;
          }
          case "text-delta": {
            const item = run.items.find(
              (item) => item.kind === "text" && item.id === part.id
            );
            if (item) {
              item.text = (item.text || "") + part.text;
              this.dirty = true;
            }
            break;
          }
          case "reasoning-start": {
            const last = run.items[run.items.length - 1];
            if (last?.kind === "reasoning") {
              if (last.text) {
                last.text += "\n\n";
              }
            } else {
              run.items.push({ id: part.id, kind: "reasoning", text: "" });
            }

            this.dirty = true;
            break;
          }
          case "reasoning-delta": {
            const last = run.items[run.items.length - 1];
            if (last?.kind === "reasoning") {
              last.text = (last.text || "") + part.text;
              this.dirty = true;
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
    } catch (error) {
      if (this.aborted) {
        this.finalize(run);
      } else {
        console.error("Browser agent error:", error);
        run.summary =
          error instanceof Error ? error.message : "Something went wrong.";
        this.setStatus("error");
      }
    } finally {
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = null;
      }
      
      this.flush(); // guarantee the final frame
      this.overlay?.hide();
      this.running = false;
      this.window?.onAgentRunEnded();
    }
  }

  private finalize(run: AgentRun): void {
    if (this.aborted) {
      if (!run.summary) {
        run.summary = "Stopped. Control handed back to you.";
      }
      this.setStatus("stopped");
    } else if (run.status !== "done") {
      if (!run.summary) {
        run.summary = "I reached the step limit before fully completing this.";
      }
      this.setStatus("done");
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
      "You are given a goal and a short checklist. Satisfy the goal's intent — for information requests that means finding and reporting each piece of information asked for, not just landing on a page.",
      "Each step you get a snapshot of the current page: its URL and a numbered list of interactive elements. Indices are re-numbered every step — always use the latest.",
      "",
      "Voice: Talk to the user naturally and warmly, in the first person, as you work. Before an action, write ONE short, friendly sentence about what you're doing and why (e.g. \"Let me open the pricing page to check the plans.\"). Keep it conversational — never mention tools, indices, or coordinates.",
      "",
      "How to act:",
      "- Narrate briefly, then take ONE action, then look at the result.",
      "- Only use element indices from the latest snapshot.",
      "- If a link/button is inside a dropdown or flyout, hover() its trigger first; its items then appear in the next snapshot.",
      "- If something isn't visible, scroll to reveal it, or navigate to a likely URL.",
      "- If the request covers multiple distinct items (several people, products, etc.), treat each as its own sub-task — don't assume one page covers them all. Gather each answer in turn (a separate search or tab per item works well) and only call done() once you have every one.",
      "- The snapshot only lists elements, not how the page looks. When appearance matters — layout, images, charts, colors, or confirming something rendered the way you expect — take a screenshot to see the page for yourself.",
      "- You can work across multiple tabs: create_tab opens a new tab and switches to it, switch_tab moves you to another tab by its ID, list_tabs shows everything that's open, and close_tab closes one. Snapshots and actions always apply to the tab you're currently in. Use separate tabs to compare options side by side (e.g. open each candidate in its own tab), then switch between them to decide.",
      "- Don't repeat an action that changed nothing; try another way.",
      "- When a choice would materially change the outcome — the request is ambiguous, there are several reasonable options, or you'd otherwise be guessing at something that could waste effort — call ask_user() with a clear question and, when there are obvious choices, a few options (the user can still type their own). Ask at genuine decision points rather than pushing ahead on an assumption; but don't ask about things you can settle yourself by looking at the page. Execution pauses until they reply.",
      "- When you believe the goal's intent is met, call done() with a natural summary or the answer. A validator checks the page; if it isn't met it tells you what's missing and you keep going.",
      "- Only give up (done, explaining why) if the goal is genuinely impossible.",
      "- When the user reveals a durable preference or fact about themselves that would help in future tasks (how they like things, who they are, recurring context), remember it by calling write_memory() with a short self-contained note. Save lasting facts only, not one-off task details.",
      this.memory.promptSection(),
    ]
      .filter(Boolean)
      .join("\n");
  }
}

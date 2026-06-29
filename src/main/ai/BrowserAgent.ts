import { WebContents } from "electron";
import { stepCountIs } from "ai";
import type { Window } from "../Window";
import type { LLMClient } from "./LLMClient";
import type { AgentRequest, AgentRun, QuestionItem, RunStatus, TextItem } from "@shared/types";
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
      (item): item is QuestionItem => item.kind === "question" && item.id === id
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
              (item): item is TextItem =>
                item.kind === "text" && item.id === part.id
            );
            if (item) {
              item.text = item.text + part.text;
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
              last.text = last.text + part.text;
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
      "- Narrate briefly, then take ONE action, then look at the result. Don't repeat an action that changed nothing; try another way.",
      "- NEVER guess. The moment you don't have a definitive, unambiguous answer for what to do next, stop and call ask_user() — that includes any real choice the request leaves open: which option, which item, a detail like a size/date/account, how to handle an edge case. The only times you proceed without asking are when the request itself makes the answer unambiguous, or you can settle it for certain by looking at the page. If you catch yourself about to assume, infer, or pick 'the most likely' option, ask instead. Err hard toward asking — a quick question is always cheaper than doing the wrong thing.",
      "- Reveal what you need before acting: hover() a trigger to open its menu, scroll to bring offscreen elements into view, or navigate to a likely URL.",
      "- Take a screenshot whenever appearance matters — layout, images, charts, colors, or confirming something rendered as expected — since the snapshot lists elements but not how the page looks.",
      "- If the request covers multiple distinct items (several people, products, etc.), treat each as its own sub-task — don't assume one page covers them all, and only call done() once you have every one. Separate tabs are good for this: work options in parallel, then switch between them to compare and decide.",
      "- To present gathered data — a report, summary, or comparison table — render it as a virtual page rather than dumping it into chat, and keep refining that same page instead of opening new tabs.",
      "- When the goal's intent is met, call done(); only give up (done, explaining why) if it's genuinely impossible.",
      "- Save durable things you learn about the user with write_memory() — stated outright or inferred from the choices they make (how they like things, who they are, recurring context). When in doubt, save it; skip only genuinely one-off task mechanics.",
      "- For example: the request is \"book the cheapest flight\" and two nonstop options are tied on price → ask_user() which they prefer. The user picks the window seat for the second time → write_memory(\"Prefers window seats.\"). They mention they're vegetarian while ordering food → write_memory(\"Vegetarian.\").",
      this.memory.promptSection(),
    ]
      .filter(Boolean)
      .join("\n");
  }
}

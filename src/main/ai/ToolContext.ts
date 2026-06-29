import type { Tab } from "../Tab";
import type { Window } from "../Window";
import type { AgentOverlay } from "./AgentOverlay";
import type { ActionItem, ActionStatus, AgentRun, RunStatus, ToolName } from "@shared/types";
import type { TaskGoal } from "./AgentGoal";
import type { ElementRegistry } from "../page/registry";
import type { LLMClient } from "./LLMClient";
import type { MemoryStore } from "./MemoryStore";
import type { RemixStore } from "../page/RemixStore";
import type { ToolCall } from "./BrowserTool";

export interface ToolDependencies {
  tab: Tab;
  window: Window;
  run: AgentRun;
  goal: TaskGoal;
  llm: LLMClient;
  memory: MemoryStore;
  remixStore: RemixStore;
  overlay: AgentOverlay | null;
  registry: ElementRegistry;
  isAborted: () => boolean;
  emit: () => void;
  awaitAnswer: (id: string) => Promise<string>;
}

export class ToolContext {
  constructor(
    private readonly dependencies: ToolDependencies,
    private readonly tool: ToolName,
    private readonly call: ToolCall
  ) {}

  // Resolve live so actions follow the agent after switch_tab/create_tab.
  get tab(): Tab {
    return this.dependencies.window.activeTab ?? this.dependencies.tab;
  }
  get window(): Window {
    return this.dependencies.window;
  }
  get run(): AgentRun {
    return this.dependencies.run;
  }
  get goal(): TaskGoal {
    return this.dependencies.goal;
  }
  get llm(): LLMClient {
    return this.dependencies.llm;
  }
  get memory(): MemoryStore {
    return this.dependencies.memory;
  }
  get remixStore(): RemixStore {
    return this.dependencies.remixStore;
  }
  get overlay(): AgentOverlay | null {
    return this.dependencies.overlay;
  }
  get registry(): ElementRegistry {
    return this.dependencies.registry;
  }
  get isAborted(): () => boolean {
    return this.dependencies.isAborted;
  }

  setStatus(status: RunStatus): void {
    this.run.status = status;
    this.dependencies.emit();
  }

  askUser(question: string, options: string[]): Promise<string> {
    this.run.items.push({
      id: this.call.toolCallId,
      kind: "question",
      question,
      options: options.length > 0 ? options : undefined,
    });
    this.run.status = "waiting";
    this.dependencies.emit();
    return this.dependencies.awaitAnswer(this.call.toolCallId);
  }

  startAction(): void {
    this.run.items.push({
      id: this.call.toolCallId,
      kind: "action",
      tool: this.tool,
      status: "running",
    });
    this.dependencies.emit();
  }

  finishAction(status: ActionStatus, title?: string): void {
    const item = this.run.items.find(
      (item): item is ActionItem =>
        item.kind === "action" && item.id === this.call.toolCallId
    );
    if (!item) {
      return;
    }

    item.status = status;
    if (title) {
      item.title = title;
    }

    this.dependencies.emit();
  }
}

import type { Tab } from "../../Tab";
import type { AgentOverlay } from "../AgentOverlay";
import type { ActionStatus, AgentRun, RunStatus, ToolName } from "@shared/types";
import type { TaskGoal } from "../AgentGoal";
import type { ElementRegistry } from "../../page/registry";
import type { LLMClient } from "../LLMClient";
import type { ToolCall } from "./BrowserTool";

export interface ToolDependencies {
  tab: Tab;
  run: AgentRun;
  goal: TaskGoal;
  llm: LLMClient;
  overlay: AgentOverlay | null;
  registry: ElementRegistry;
  isAborted: () => boolean;
  emit: () => void;
}

export class ToolContext {
  constructor(
    private readonly dependencies: ToolDependencies,
    private readonly tool: ToolName,
    private readonly call: ToolCall
  ) {}

  get tab(): Tab {
    return this.dependencies.tab;
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
      (item) => item.kind === "action" && item.id === this.call.toolCallId
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

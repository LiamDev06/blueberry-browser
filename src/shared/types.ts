export type ToolName =
  | "click"
  | "hover"
  | "type"
  | "navigate"
  | "back"
  | "forward"
  | "scroll"
  | "screenshot"
  | "remix"
  | "list_tabs"
  | "create_tab"
  | "switch_tab"
  | "close_tab"
  | "write_memory"
  | "done";

export type ActionStatus = "running" | "done" | "error";

export type RunStatus =
  | "planning"
  | "running"
  | "validating"
  | "done"
  | "stopped"
  | "error";

export interface AgentRequest {
  message: string;
  messageId: string;
}

export interface AgentItem {
  id: string;
  kind: "text" | "action" | "reasoning";
  text?: string;
  tool?: ToolName;
  title?: string;
  status?: ActionStatus;
}

export interface AgentCriterion {
  text: string;
  met: boolean | null;
}

export interface AgentRun {
  id: string;
  request: string;
  goal: string;
  criteria: AgentCriterion[];
  items: AgentItem[];
  status: RunStatus;
  summary: string;
}

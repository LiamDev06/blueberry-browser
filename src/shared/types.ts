export type ToolName =
  | "click"
  | "hover"
  | "type"
  | "navigate"
  | "back"
  | "forward"
  | "scroll"
  | "screenshot"
  | "run_js"
  | "remix"
  | "list_tabs"
  | "create_tab"
  | "create_virtual_page"
  | "update_virtual_page"
  | "switch_tab"
  | "close_tab"
  | "ask_user"
  | "write_memory"
  | "done";

export type ActionStatus = "running" | "done" | "error";

export type RunStatus =
  | "planning"
  | "running"
  | "validating"
  | "waiting"
  | "done"
  | "stopped"
  | "error";

export interface AgentRequest {
  message: string;
  messageId: string;
}

export interface TextItem {
  id: string;
  kind: "text";
  text: string;
}

export interface ReasoningItem {
  id: string;
  kind: "reasoning";
  text: string;
}

export interface ActionItem {
  id: string;
  kind: "action";
  tool: ToolName;
  status: ActionStatus;
  title?: string;
}

export interface QuestionItem {
  id: string;
  kind: "question";
  question: string;
  options?: string[];
  answer?: string;
}

export type AgentItem = TextItem | ReasoningItem | ActionItem | QuestionItem;

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

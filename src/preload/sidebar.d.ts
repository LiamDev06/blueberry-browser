import { ElectronAPI } from "@electron-toolkit/preload";
import type { AgentRequest, AgentRun } from "@shared/types";
import type { RemixPromptData } from "@shared/remix";

interface ChatRequest {
  message: string;
  context?: {
    url: string | null;
    content: string | null;
    text: string | null;
  };
  messageId: string;
}

interface ChatResponse {
  messageId: string;
  content: string;
  isComplete: boolean;
}

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface SidebarAPI {
  // Chat functionality
  sendChatMessage: (request: ChatRequest) => Promise<void>;
  clearChat: () => Promise<boolean>;
  getMessages: () => Promise<unknown[]>;
  onChatResponse: (callback: (data: ChatResponse) => void) => void;
  onMessagesUpdated: (callback: (messages: unknown[]) => void) => void;
  removeChatResponseListener: () => void;
  removeMessagesUpdatedListener: () => void;

  // Browser-use agent
  runAgentTask: (request: AgentRequest) => Promise<void>;
  stopAgent: () => Promise<boolean>;
  answerAgentQuestion: (payload: { id: string; answer: string }) => Promise<boolean>;
  onAgentActivity: (callback: (run: AgentRun) => void) => void;
  removeAgentActivityListener: () => void;

  // Remix prompt
  onRemixPrompt: (callback: (data: RemixPromptData | null) => void) => void;
  removeRemixPromptListener: () => void;
  loadRemix: (id: string) => Promise<boolean>;
  dismissRemix: () => Promise<void>;

  // Page content access
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;

  // Tab information
  getActiveTabInfo: () => Promise<TabInfo | null>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    sidebarAPI: SidebarAPI;
  }
}

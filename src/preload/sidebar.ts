import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

interface ChatRequest {
  message: string;
  context: {
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

// Sidebar specific APIs
const sidebarAPI = {
  // Chat functionality
  sendChatMessage: (request: Partial<ChatRequest>) =>
    electronAPI.ipcRenderer.invoke("sidebar-chat-message", request),

  clearChat: () => electronAPI.ipcRenderer.invoke("sidebar-clear-chat"),

  getMessages: () => electronAPI.ipcRenderer.invoke("sidebar-get-messages"),

  // Browser-use agent
  runAgentTask: (request: { message: string; messageId: string }) =>
    electronAPI.ipcRenderer.invoke("sidebar-run-agent", request),

  stopAgent: () => electronAPI.ipcRenderer.invoke("sidebar-stop-agent"),

  answerAgentQuestion: (payload: { id: string; answer: string }) =>
    electronAPI.ipcRenderer.invoke("sidebar-answer-question", payload),

  onAgentActivity: (callback: (run: any) => void) => {
    electronAPI.ipcRenderer.on("agent-activity", (_, run) => callback(run));
  },

  removeAgentActivityListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("agent-activity");
  },

  onChatResponse: (callback: (data: ChatResponse) => void) => {
    electronAPI.ipcRenderer.on("chat-response", (_, data) => callback(data));
  },

  onMessagesUpdated: (callback: (messages: any[]) => void) => {
    electronAPI.ipcRenderer.on("chat-messages-updated", (_, messages) =>
      callback(messages)
    );
  },

  removeChatResponseListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-response");
  },

  removeMessagesUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-messages-updated");
  },

  // Remix prompt
  onRemixPrompt: (callback: (data: unknown) => void) => {
    electronAPI.ipcRenderer.on("remix-prompt:data", (_, data) => callback(data));
  },

  removeRemixPromptListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("remix-prompt:data");
  },

  loadRemix: (id: string) =>
    electronAPI.ipcRenderer.invoke("remix-prompt:load", id),

  dismissRemix: () => electronAPI.ipcRenderer.invoke("remix-prompt:dismiss"),

  // Page content access
  getPageContent: () => electronAPI.ipcRenderer.invoke("get-page-content"),
  getPageText: () => electronAPI.ipcRenderer.invoke("get-page-text"),
  getCurrentUrl: () => electronAPI.ipcRenderer.invoke("get-current-url"),

  // Tab information
  getActiveTabInfo: () => electronAPI.ipcRenderer.invoke("get-active-tab-info"),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("sidebarAPI", sidebarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.sidebarAPI = sidebarAPI;
}

import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

interface Point {
  x: number;
  y: number;
}

const overlayAPI = {
  // Begin/reset a run with the goal label
  onStart: (callback: (goal: string) => void) => {
    electronAPI.ipcRenderer.on("overlay:start", (_, goal) => callback(goal));
  },
  // Move the cursor to a viewport position
  onMove: (callback: (point: Point) => void) => {
    electronAPI.ipcRenderer.on("overlay:move", (_, point) => callback(point));
  },
  removeAll: () => {
    electronAPI.ipcRenderer.removeAllListeners("overlay:start");
    electronAPI.ipcRenderer.removeAllListeners("overlay:move");
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("overlayAPI", overlayAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.overlayAPI = overlayAPI;
}

import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import type { HudPatch, Point } from "@shared/overlay";

const overlayAPI = {
  // Patch the HUD presentation: the goal label and/or the remixing effect
  onHud: (callback: (patch: HudPatch) => void) => {
    electronAPI.ipcRenderer.on("overlay:hud", (_, patch) => callback(patch));
  },
  // Move the cursor to a viewport position
  onMove: (callback: (point: Point) => void) => {
    electronAPI.ipcRenderer.on("overlay:move", (_, point) => callback(point));
  },
  removeAll: () => {
    electronAPI.ipcRenderer.removeAllListeners("overlay:hud");
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

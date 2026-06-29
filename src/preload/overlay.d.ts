import { ElectronAPI } from "@electron-toolkit/preload";
import type { HudPatch, Point } from "@shared/overlay";

interface OverlayAPI {
  onHud: (callback: (patch: HudPatch) => void) => void;
  onMove: (callback: (point: Point) => void) => void;
  removeAll: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    overlayAPI: OverlayAPI;
  }
}

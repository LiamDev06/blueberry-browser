import { ElectronAPI } from "@electron-toolkit/preload";

interface Point {
  x: number;
  y: number;
}

interface RemixState {
  active: boolean;
}

interface HudPatch {
  goal?: string;
  remix?: RemixState;
}

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

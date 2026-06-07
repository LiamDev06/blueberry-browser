import { ElectronAPI } from "@electron-toolkit/preload";

interface Point {
  x: number;
  y: number;
}

interface OverlayAPI {
  onStart: (callback: (goal: string) => void) => void;
  onMove: (callback: (point: Point) => void) => void;
  removeAll: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    overlayAPI: OverlayAPI;
  }
}

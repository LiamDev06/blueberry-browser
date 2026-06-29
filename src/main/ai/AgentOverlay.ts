import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";
import { LayoutHelper } from "../layout";

export class AgentOverlay {
  private readonly baseWindow: BaseWindow;
  private readonly view: WebContentsView;
  private visible = false;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/overlay.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    // Transparent so the page shows through; only the painted HUD is visible.
    this.view.setBackgroundColor("#00000000");
    this.loadRenderer();

    this.view.setVisible(false);
    this.baseWindow.contentView.addChildView(this.view);
    this.updateBounds(true);
  }

  private loadRenderer(): void {
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      const url = new URL("/overlay/", process.env["ELECTRON_RENDERER_URL"]);
      this.view.webContents.loadURL(url.toString());
    } else {
      this.view.webContents.loadFile(
        join(__dirname, "../renderer/overlay/index.html")
      );
    }
  }

  updateBounds(sidebarVisible: boolean): void {
    this.view.setBounds(
      LayoutHelper.getContentBounds(this.baseWindow.getBounds(), sidebarVisible)
    );
  }

  private restack(): void {
    this.baseWindow.contentView.removeChildView(this.view);
    this.baseWindow.contentView.addChildView(this.view);
  }

  raise(): void {
    if (this.visible) {
      this.restack();
    }
  }

  private send(channel: string, payload?: unknown): void {
    if (!this.view.webContents.isDestroyed()) {
      this.view.webContents.send(channel, payload);
    }
  }

  show(goal: string, sidebarVisible: boolean): void {
    this.visible = true;
    this.updateBounds(sidebarVisible);
    this.restack();
    this.view.setVisible(true);
    this.send("overlay:hud", { goal, remix: { active: false } });
  }

  moveCursor(x: number, y: number): void {
    this.send("overlay:move", { x, y });
  }

  startRemix(): void {
    this.send("overlay:hud", { remix: { active: true } });
  }

  endRemix(): void {
    this.send("overlay:hud", { remix: { active: false } });
  }

  hide(): void {
    this.visible = false;
    this.view.setVisible(false);
  }
}

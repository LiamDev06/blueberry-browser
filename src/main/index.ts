import { app, BaseWindow, protocol } from "electron";
import { electronApp } from "@electron-toolkit/utils";
import { Window } from "./Window";
import { AppMenu } from "./Menu";
import { EventManager } from "./EventManager";
import { VIRTUAL_PAGE_SCHEME, virtualPageStore } from "./page/virtualPage";

let mainWindow: Window | null = null;
let eventManager: EventManager | null = null;
let menu: AppMenu | null = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: VIRTUAL_PAGE_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

const registerVirtualPageProtocol = (): void => {
  protocol.handle(VIRTUAL_PAGE_SCHEME, (request) => {
    const html = virtualPageStore.htmlForUrl(request.url);
    if (html === undefined) {
      return new Response("Page not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  });
};

const createWindow = (): Window => {
  const window = new Window();
  menu = new AppMenu(window);
  eventManager = new EventManager(window);
  return window;
};

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.electron");

  registerVirtualPageProtocol();

  mainWindow = createWindow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BaseWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (eventManager) {
    eventManager.cleanup();
    eventManager = null;
  }

  // Clean up references
  if (mainWindow) {
    mainWindow = null;
  }
  if (menu) {
    menu = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

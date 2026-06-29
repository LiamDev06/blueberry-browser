import { BaseWindow, shell } from "electron";
import { Tab } from "./Tab";
import { TopBar } from "./TopBar";
import { SideBar } from "./SideBar";
import { AgentOverlay } from "./ai/AgentOverlay";
import { LayoutHelper } from "./layout";
import { virtualPageStore } from "./page/virtualPage";

export class Window {
  private _baseWindow: BaseWindow;
  private tabsMap: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private tabCounter: number = 0;
  private _topBar: TopBar;
  private _sideBar: SideBar;
  private _agentOverlay: AgentOverlay;

  constructor() {
    // Create the browser window.
    this._baseWindow = new BaseWindow({
      width: 1000,
      height: 800,
      show: true,
      autoHideMenuBar: false,
      titleBarStyle: "hidden",
      ...(process.platform !== "darwin" ? { titleBarOverlay: true } : {}),
      trafficLightPosition: { x: 15, y: 13 },
    });

    this._baseWindow.setMinimumSize(1000, 800);

    this._topBar = new TopBar(this._baseWindow);
    this._sideBar = new SideBar(this._baseWindow);
    this._agentOverlay = new AgentOverlay(this._baseWindow);

    // Set the window reference on the LLM client and agent to avoid circular dependency
    this._sideBar.client.setWindow(this);
    this._sideBar.agent.setWindow(this);

    // Create the first tab
    this.createTab();

    // Set up window resize handler
    this._baseWindow.on("resize", () => {
      this.updateTabBounds();
      this._topBar.updateBounds();
      this._sideBar.updateBounds();
      this._agentOverlay.updateBounds(this._sideBar.getIsVisible());
      // Notify renderer of resize through active tab
      const bounds = this._baseWindow.getBounds();
      if (this.activeTab) {
        this.activeTab.webContents.send("window-resized", {
          width: bounds.width,
          height: bounds.height,
        });
      }
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this._baseWindow.on("closed", () => {
      // Clean up all tabs when window is closed
      this.tabsMap.forEach((tab) => tab.destroy());
      this.tabsMap.clear();
    });
  }

  // Getters
  get window(): BaseWindow {
    return this._baseWindow;
  }

  get activeTab(): Tab | null {
    if (this.activeTabId) {
      return this.tabsMap.get(this.activeTabId) || null;
    }
    return null;
  }

  get allTabs(): Tab[] {
    return Array.from(this.tabsMap.values());
  }

  get tabCount(): number {
    return this.tabsMap.size;
  }

  // Tab management methods
  createTab(url?: string): Tab {
    const tabId = `tab-${++this.tabCounter}`;
    const tab = new Tab(tabId, url);

    tab.webContents.setWindowOpenHandler((details) => {
      if (/^https?:\/\//i.test(details.url)) {
        const newTab = this.createTab(details.url);
        if (details.disposition !== "background-tab") {
          this.switchActiveTab(newTab.id);
        }
      } else {
        shell.openExternal(details.url);
      }
      return { action: "deny" };
    });

    // Add the tab's WebContentsView to the window
    this._baseWindow.contentView.addChildView(tab.view);

    // addChildView stacks on top, so re-raise the overlay above the new tab.
    this._agentOverlay.raise();

    // Fill the content area: below the topbar, left of the sidebar (when shown).
    tab.view.setBounds(
      LayoutHelper.getContentBounds(
        this._baseWindow.getBounds(),
        this._sideBar.getIsVisible()
      )
    );

    // Store the tab
    this.tabsMap.set(tabId, tab);

    // If this is the first tab, make it active
    if (this.tabsMap.size === 1) {
      this.switchActiveTab(tabId);
    } else {
      // Hide the tab initially if it's not the first one
      tab.hide();
    }

    return tab;
  }

  createVirtualPage(html: string, title?: string): Tab {
    const tab = this.createTab(virtualPageStore.create(html, title));
    tab.setVirtual(true);
    this.switchActiveTab(tab.id);
    return tab;
  }

  updateVirtualPage(tabId: string, html: string, title?: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab || !tab.isVirtual) {
      return false;
    }
    if (!virtualPageStore.update(tab.url, html, title)) {
      return false;
    }
    tab.reload();
    return true;
  }

  closeTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) {
      return false;
    }

    if (tab.isVirtual) {
      virtualPageStore.deleteByUrl(tab.url);
    }

    // Remove the WebContentsView from the window
    this._baseWindow.contentView.removeChildView(tab.view);

    // Destroy the tab
    tab.destroy();

    // Remove from our tabs map
    this.tabsMap.delete(tabId);

    // If this was the active tab, switch to another tab
    if (this.activeTabId === tabId) {
      this.activeTabId = null;
      const remainingTabs = Array.from(this.tabsMap.keys());
      if (remainingTabs.length > 0) {
        this.switchActiveTab(remainingTabs[0]);
      }
    }

    // If no tabs left, close the window
    if (this.tabsMap.size === 0) {
      this._baseWindow.close();
    }

    return true;
  }

  switchActiveTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) {
      return false;
    }

    // Hide the currently active tab
    if (this.activeTabId && this.activeTabId !== tabId) {
      const currentTab = this.tabsMap.get(this.activeTabId);
      if (currentTab) {
        currentTab.hide();
      }
    }

    // Show the new active tab
    tab.show();
    this.activeTabId = tabId;
    this._agentOverlay.raise();

    // Update the window title to match the tab title
    this._baseWindow.setTitle(tab.title || "Blueberry Browser");

    return true;
  }

  getTab(tabId: string): Tab | null {
    return this.tabsMap.get(tabId) || null;
  }

  // Window methods
  show(): void {
    this._baseWindow.show();
  }

  hide(): void {
    this._baseWindow.hide();
  }

  close(): void {
    this._baseWindow.close();
  }

  focus(): void {
    this._baseWindow.focus();
  }

  minimize(): void {
    this._baseWindow.minimize();
  }

  maximize(): void {
    this._baseWindow.maximize();
  }

  unmaximize(): void {
    this._baseWindow.unmaximize();
  }

  isMaximized(): boolean {
    return this._baseWindow.isMaximized();
  }

  setTitle(title: string): void {
    this._baseWindow.setTitle(title);
  }

  setBounds(bounds: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }): void {
    this._baseWindow.setBounds(bounds);
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return this._baseWindow.getBounds();
  }

  // Handle window resize to update tab bounds
  private updateTabBounds(): void {
    const bounds = LayoutHelper.getContentBounds(
      this._baseWindow.getBounds(),
      this._sideBar.getIsVisible()
    );
    this.tabsMap.forEach((tab) => tab.view.setBounds(bounds));
  }

  // Public method to update all bounds when sidebar is toggled
  updateAllBounds(): void {
    this.updateTabBounds();
    this._sideBar.updateBounds();
    this._agentOverlay.updateBounds(this._sideBar.getIsVisible());
  }

  // Getter for sidebar to access from main process
  get sidebar(): SideBar {
    return this._sideBar;
  }

  // Getter for the agent's on-screen overlay
  get agentOverlay(): AgentOverlay {
    return this._agentOverlay;
  }

  // Getter for topBar to access from main process
  get topBar(): TopBar {
    return this._topBar;
  }

  // Getter for all tabs as array
  get tabs(): Tab[] {
    return Array.from(this.tabsMap.values());
  }

  // Getter for baseWindow to access from Menu
  get baseWindow(): BaseWindow {
    return this._baseWindow;
  }
}

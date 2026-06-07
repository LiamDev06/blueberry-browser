import type { Rectangle } from "electron";

export class LayoutHelper {
  static readonly TOPBAR_HEIGHT = 88; // 40px tabs + 48px address bar
  static readonly SIDEBAR_WIDTH = 400;

  // The topbar: full-width strip pinned to the top.
  static getTopBarBounds(windowBounds: Rectangle): Rectangle {
    return {
      x: 0,
      y: 0,
      width: windowBounds.width,
      height: this.TOPBAR_HEIGHT,
    };
  }

  // The sidebar: full-height column pinned to the right edge, below the topbar.
  static getSidebarBounds(windowBounds: Rectangle): Rectangle {
    return {
      x: windowBounds.width - this.SIDEBAR_WIDTH,
      y: this.TOPBAR_HEIGHT,
      width: this.SIDEBAR_WIDTH,
      height: windowBounds.height - this.TOPBAR_HEIGHT,
    };
  }

  // The page content area: below the topbar, left of the sidebar (when shown)
  static getContentBounds(
    windowBounds: Rectangle,
    sidebarVisible: boolean
  ): Rectangle {
    return {
      x: 0,
      y: this.TOPBAR_HEIGHT,
      width: windowBounds.width - (sidebarVisible ? this.SIDEBAR_WIDTH : 0),
      height: windowBounds.height - this.TOPBAR_HEIGHT,
    };
  }
}

import type { Debugger } from "electron";
import type { Tab } from "../Tab";

const PROTOCOL_VERSION = "1.3";

export enum CdpCommand {
  // Enable the DOM domain so node and box-model queries work.
  EnableDom = "DOM.enable",
  // Enable the accessibility domain so the AX tree can be fetched.
  EnableAccessibility = "Accessibility.enable",
  // Fetch the full accessibility tree (roles, names, backend node ids).
  GetFullAXTree = "Accessibility.getFullAXTree",
  // Read viewport size, scroll offset, and total content size.
  GetLayoutMetrics = "Page.getLayoutMetrics",
  // Get an element's box quads — its position and size in the viewport.
  GetBoxModel = "DOM.getBoxModel",
  // Scroll an element into view if it isn't already visible.
  ScrollIntoViewIfNeeded = "DOM.scrollIntoViewIfNeeded",
  // Find the topmost node sitting at a given viewport point.
  GetNodeForLocation = "DOM.getNodeForLocation",
  // Move keyboard focus to an element.
  Focus = "DOM.focus",
  // Describe a node: tag name, attributes, and optionally its subtree.
  DescribeNode = "DOM.describeNode",
  // Insert text into the focused element, firing real input events.
  InsertText = "Input.insertText",
  // Dispatch a mouse event (used here for wheel scrolling).
  DispatchMouseEvent = "Input.dispatchMouseEvent",
  // Dispatch a keyboard event (used for select-all and Enter).
  DispatchKeyEvent = "Input.dispatchKeyEvent",
}

export async function chromeDevtoolsProtocolSession(tab: Tab): Promise<Debugger> {
  const dbg = tab.webContents.debugger;
  if (!dbg.isAttached()) {
    try {
      dbg.attach(PROTOCOL_VERSION);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Couldn't attach the debugger to the tab (is DevTools open on it?): ${reason}`
      );
    }
  }

  await dbg.sendCommand(CdpCommand.EnableDom);
  await dbg.sendCommand(CdpCommand.EnableAccessibility);

  return dbg;
}

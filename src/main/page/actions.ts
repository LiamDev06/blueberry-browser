import type { Tab } from "../Tab";
import { chromeDevtoolsProtocolSession, CdpCommand } from "./cdp";
import { type ElementSnapshot, type PageSnapshot } from "./types";

const MAX_ELEMENTS = 75;

// elements the model can interact with, like click into
const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "searchbox",
  "combobox",
  "listbox",
  "checkbox",
  "radio",
  "switch",
  "slider",
  "spinbutton",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "disclosuretriangle",
]);

export type ActionResult = { ok: true } | { ok: false; error: string };

export type LocatedPoint =
  | { ok: false; error: string }
  | { ok: true; x: number; y: number };

export type PointCheck =
  | { ok: false; error: string }
  | { ok: true; target: string };

interface DescribedNode {
  nodeName?: string;
  backendNodeId?: number;
  attributes?: string[];
  children?: DescribedNode[];
}

interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Cdp = Awaited<ReturnType<typeof chromeDevtoolsProtocolSession>>;

export async function snapshotPage(
  tab: Tab,
  maxElements = MAX_ELEMENTS
): Promise<PageSnapshot> {
  const session = await chromeDevtoolsProtocolSession(tab);

  const [{ nodes }, metrics] = await Promise.all([
    session.sendCommand(CdpCommand.GetFullAXTree),
    session.sendCommand(CdpCommand.GetLayoutMetrics),
  ]);

  const candidates = nodes.filter(
    (node) =>
      !node.ignored &&
      node.backendDOMNodeId != null &&
      node.role?.value != null &&
      INTERACTIVE_ROLES.has(node.role.value)
  );

  const located = await Promise.all(
    candidates.map(async (node) => {
      try {
        const { model } = (await session.sendCommand(CdpCommand.GetBoxModel, {
          backendNodeId: node.backendDOMNodeId,
        }));
        
        const box = quadBounds(model.content);
        if (box.width < 2 || box.height < 2) {
          return null;
        }

        const href =
          node.role?.value === "link"
            ? await linkHref(session, node.backendDOMNodeId!, tab.url)
            : undefined;
        return { node, box, href };
      } catch {
        // No box model means the node isn't rendered
        return null;
      }
    })
  );

  const viewportHeight = metrics.cssLayoutViewport.clientHeight;

  const elements: ElementSnapshot[] = located
    .flatMap((item) => (item ? [item] : []))
    .slice(0, maxElements)
    .map((item, index) => ({
      index,
      role: item.node.role!.value!,
      // TODO, could maybe break out into some construct name function?
      name: (item.node.name?.value ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
      href: item.href,
      backendNodeId: item.node.backendDOMNodeId!,
      inViewport: item.box.top < viewportHeight && item.box.top + item.box.height > 0,
    }));

  return {
    url: tab.url,
    title: tab.title,
    scrollY: Math.round(metrics.cssVisualViewport.pageY),
    scrollHeight: Math.round(metrics.cssContentSize.height),
    viewportHeight,
    elements,
  };
}

export async function locateElement(
  tab: Tab,
  backendNodeId: number
): Promise<LocatedPoint> {
  const session = await chromeDevtoolsProtocolSession(tab);

  try {
    await session.sendCommand(CdpCommand.ScrollIntoViewIfNeeded, { backendNodeId });
  } catch {
    // Best-effort
  }

  const box = await boxFor(session, backendNodeId);
  if (!box) {
    return { ok: false, error: "That element is gone from the page — take a fresh look." };
  }
  if (box.width < 1 || box.height < 1) {
    return { ok: false, error: "That element has no visible clickable area." };
  }

  const { cssLayoutViewport } = (await session.sendCommand(
    CdpCommand.GetLayoutMetrics
  ));
  const clamp = (value: number, max: number): number =>
    Math.round(Math.min(Math.max(value, 1), max - 1));

  return {
    ok: true,
    x: clamp(box.left + box.width / 2, cssLayoutViewport.clientWidth),
    y: clamp(box.top + box.height / 2, cssLayoutViewport.clientHeight),
  };
}

export async function verifyPoint(
  tab: Tab,
  backendNodeId: number,
  x: number,
  y: number
): Promise<PointCheck> {
  const session = await chromeDevtoolsProtocolSession(tab);

  let hitNodeId: number | undefined;
  try {
    ({ backendNodeId: hitNodeId } = (await session.sendCommand(CdpCommand.GetNodeForLocation, {
      x,
      y,
      includeUserAgentShadowDOM: true,
    })));
  } catch {
    return { ok: false, error: "Nothing is at that position — it may be off-screen." };
  }
  if (hitNodeId == null) {
    return { ok: false, error: "Nothing is at that position — it may be off-screen." };
  }

  const onTarget =
    hitNodeId === backendNodeId ||
    (await isInSubtree(session, backendNodeId, hitNodeId)) || // hit a descendant of the target
    (await isInSubtree(session, hitNodeId, backendNodeId)); // hit an ancestor wrapping the target

  if (onTarget) {
    return { ok: true, target: await describe(session, hitNodeId) };
  }
  
  return {
    ok: false,
    error: `The cursor is over ${await describe(session, hitNodeId)}, not the intended element — it is covered or has moved.`,
  };
}

export async function typeIntoElement(
  tab: Tab,
  backendNodeId: number,
  text: string,
  submit: boolean
): Promise<ActionResult> {
  const session = await chromeDevtoolsProtocolSession(tab);

  try {
    await session.sendCommand(CdpCommand.ScrollIntoViewIfNeeded, { backendNodeId });
    await session.sendCommand(CdpCommand.Focus, { backendNodeId });
  } catch {
    return {
      ok: false,
      error: "That element can't be focused — it may not be a text field.",
    };
  }

  await selectAll(session);
  await session.sendCommand(CdpCommand.InsertText, { text });

  if (submit) {
    await pressEnter(session);
  }
  return { ok: true };
}

export async function scroll(
  tab: Tab,
  direction: "up" | "down"
): Promise<ActionResult> {
  const session = await chromeDevtoolsProtocolSession(tab);
  const { cssLayoutViewport } = (await session.sendCommand(
    CdpCommand.GetLayoutMetrics
  ));

  const step = Math.round(cssLayoutViewport.clientHeight * 0.8);
  await session.sendCommand(CdpCommand.DispatchMouseEvent, {
    type: "mouseWheel",
    x: Math.round(cssLayoutViewport.clientWidth / 2),
    y: Math.round(cssLayoutViewport.clientHeight / 2),
    deltaX: 0,
    deltaY: direction === "up" ? -step : step,
  });
  
  return { ok: true };
}

export async function replaceDocument(
  tab: Tab,
  html: string
): Promise<ActionResult> {
  const session = await chromeDevtoolsProtocolSession(tab);
  await session.sendCommand(CdpCommand.EnablePage);

  const { frameTree } = await session.sendCommand(CdpCommand.GetFrameTree);
  await session.sendCommand(CdpCommand.SetDocumentContent, {
    frameId: frameTree.frame.id,
    html,
  });

  return { ok: true };
}

function quadBounds(quad: number[]): Bounds {
  const xCoordinates = [quad[0], quad[2], quad[4], quad[6]];
  const yCoordinates = [quad[1], quad[3], quad[5], quad[7]];
  const left = Math.min(...xCoordinates);
  const top = Math.min(...yCoordinates);
  return {
    left,
    top,
    width: Math.max(...xCoordinates) - left,
    height: Math.max(...yCoordinates) - top,
  };
}

async function boxFor(
  session: Cdp,
  backendNodeId: number
): Promise<Bounds | null> {
  try {
    const { model } = (await session.sendCommand(CdpCommand.GetBoxModel, {
      backendNodeId,
    }));
    return quadBounds(model.content);
  } catch {
    return null;
  }
}

async function linkHref(
  session: Cdp,
  backendNodeId: number,
  baseUrl: string
): Promise<string | undefined> {
  const node = await describeNode(session, backendNodeId);
  const attributes = node?.attributes ?? [];

  for (let index = 0; index < attributes.length; index += 2) {
    if (attributes[index] !== "href") {
      continue;
    }

    const rawHref = attributes[index + 1];
    try {
      return new URL(rawHref, baseUrl).href.slice(0, 200);
    } catch {
      return rawHref.slice(0, 200);
    }
  }
  return undefined;
}

async function describeNode(
  session: Cdp,
  backendNodeId: number,
  depth = 0
): Promise<DescribedNode | null> {
  try {
    const { node } = (await session.sendCommand(CdpCommand.DescribeNode, {
      backendNodeId,
      depth,
      pierce: true,
    }));
    return node;
  } catch {
    return null;
  }
}

async function isInSubtree(
  session: Cdp,
  rootNodeId: number,
  needle: number
): Promise<boolean> {
  if (rootNodeId === needle) return true;

  const root = await describeNode(session, rootNodeId, -1);
  if (!root) {
    return false;
  }

  const stack: DescribedNode[] = [...(root.children ?? [])];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.backendNodeId === needle) {
      return true;
    }

    if (node.children) stack.push(...node.children);
  }
  return false;
}

async function describe(
  session: Cdp,
  backendNodeId: number
): Promise<string> {
  const node = await describeNode(session, backendNodeId);
  return node?.nodeName ? node.nodeName.toLowerCase() : "an element";
}

async function selectAll(session: Cdp): Promise<void> {
  for (const type of ["keyDown", "keyUp"] as const) {
    await session.sendCommand(CdpCommand.DispatchKeyEvent, {
      type,
      modifiers: process.platform === "darwin" ? 4 : 2,
      key: "a",
      code: "KeyA",
      windowsVirtualKeyCode: 65,
    });
  }
}

async function pressEnter(session: Cdp): Promise<void> {
  await session.sendCommand(CdpCommand.DispatchKeyEvent, {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    text: "\r",
  });
  await session.sendCommand(CdpCommand.DispatchKeyEvent, {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
}

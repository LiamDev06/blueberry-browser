import type { Tab } from "../Tab";
import { chromeDevtoolsProtocolSession, CdpCommand } from "./cdp";
import { REMIX_MAIN_ATTR, REMIX_REGION_ATTR } from "./observer";
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

export type ClickPoint =
  | { ok: false; error: string }
  | { ok: true; x: number; y: number; target: string };

interface DescribedNode {
  nodeName?: string;
  backendNodeId?: number;
  attributes?: string[];
  children?: DescribedNode[];
}

interface AxNode {
  ignored?: boolean;
  role?: { value?: string };
  name?: { value?: string };
  backendDOMNodeId?: number;
}

interface FrameTreeNode {
  frame: { id: string };
  childFrames?: FrameTreeNode[];
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
  await session.sendCommand(CdpCommand.EnablePage);

  const [frameIds, metrics] = await Promise.all([
    collectFrameIds(session),
    session.sendCommand(CdpCommand.GetLayoutMetrics),
  ]);

  const nodes = await collectAxNodes(session, frameIds);

  const candidates = nodes.filter(
    (node) =>
      !node.ignored &&
      node.backendDOMNodeId != null &&
      node.role?.value != null &&
      INTERACTIVE_ROLES.has(node.role.value)
  );

  const viewportHeight = metrics.cssLayoutViewport.clientHeight;

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
        const inViewport = box.top < viewportHeight && box.top + box.height > 0;
        return { node, box, href, inViewport };
      } catch {
        // No box model means the node isn't rendered
        return null;
      }
    })
  );

  const visible = located.flatMap((item) => (item ? [item] : []));

  const ordered = [...visible].sort(
    (first, second) => Number(second.inViewport) - Number(first.inViewport)
  );

  const elements: ElementSnapshot[] = ordered
    .slice(0, maxElements)
    .map((item, index) => ({
      index,
      role: item.node.role!.value!,
      name: elementName(item.node),
      href: item.href,
      backendNodeId: item.node.backendDOMNodeId!,
      inViewport: item.inViewport,
    }));

  return {
    url: tab.url,
    title: tab.title,
    scrollY: Math.round(metrics.cssVisualViewport.pageY),
    scrollHeight: Math.round(metrics.cssContentSize.height),
    viewportHeight,
    elements,
    hiddenElements: Math.max(0, visible.length - elements.length),
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

  return {
    ok: true,
    x: clampToViewport(box.left + box.width / 2, cssLayoutViewport.clientWidth),
    y: clampToViewport(box.top + box.height / 2, cssLayoutViewport.clientHeight),
  };
}

export async function findClickablePoint(
  tab: Tab,
  backendNodeId: number
): Promise<ClickPoint> {
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

  const fractions = [0.5, 0.3, 0.7];
  const points = fractions.flatMap((fractionY) =>
    fractions.map((fractionX) => ({
      x: clampToViewport(box.left + box.width * fractionX, cssLayoutViewport.clientWidth),
      y: clampToViewport(box.top + box.height * fractionY, cssLayoutViewport.clientHeight),
    }))
  );

  let lastHit: string | undefined;
  for (const point of points) {
    let hitNodeId: number | undefined;
    try {
      ({ backendNodeId: hitNodeId } = (await session.sendCommand(
        CdpCommand.GetNodeForLocation,
        { x: point.x, y: point.y, includeUserAgentShadowDOM: true }
      )));
    } catch {
      continue;
    }
    if (hitNodeId == null) {
      continue;
    }

    const onTarget =
      hitNodeId === backendNodeId ||
      (await isInSubtree(session, backendNodeId, hitNodeId)) ||
      (await isInSubtree(session, hitNodeId, backendNodeId));

    if (onTarget) {
      return {
        ok: true,
        x: point.x,
        y: point.y,
        target: await describe(session, hitNodeId),
      };
    }
    lastHit = await describe(session, hitNodeId);
  }

  return {
    ok: false,
    error: `The cursor is over ${lastHit ?? "another element"}, not the intended element — it is covered or has moved.`,
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

export type RemixTarget =
  | { kind: "main" }
  | { kind: "region"; id: number };

export async function applyRemix(
  tab: Tab,
  target: RemixTarget,
  html: string
): Promise<ActionResult> {
  const selector =
    target.kind === "main"
      ? `[${REMIX_MAIN_ATTR}]`
      : `[${REMIX_REGION_ATTR}="${target.id}"]`;

  const result = await tab.runJs(applyRemixScript(selector, html));
  if (result && result.ok) {
    return { ok: true };
  }
  return { ok: false, error: "The remix target is no longer on the page." };
}

function applyRemixScript(selector: string, html: string): string {
  return `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { ok: false };
    el.innerHTML = ${JSON.stringify(html)};

    if (document.body && !document.getElementById("blueberry-remix-badge")) {
      const badge = document.createElement("div");
      badge.id = "blueberry-remix-badge";
      badge.textContent = "✨ Remixed";
      badge.setAttribute(
        "style",
        "position:fixed;bottom:16px;right:16px;z-index:2147483647;" +
          "font:600 12px -apple-system,system-ui,sans-serif;letter-spacing:.04em;" +
          "text-transform:uppercase;padding:6px 11px;border-radius:999px;" +
          "background:rgba(107,78,255,.14);color:#6b4eff;pointer-events:none;"
      );
      document.body.appendChild(badge);
    }
    return { ok: true };
  })()`;
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

function elementName(node: AxNode): string {
  return (node.name?.value ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function clampToViewport(value: number, max: number): number {
  return Math.round(Math.min(Math.max(value, 1), max - 1));
}

async function collectFrameIds(session: Cdp): Promise<string[]> {
  const { frameTree } = (await session.sendCommand(CdpCommand.GetFrameTree));

  const ids: string[] = [];
  const walk = (node: FrameTreeNode): void => {
    ids.push(node.frame.id);
    for (const child of node.childFrames ?? []) {
      walk(child);
    }
  };
  walk(frameTree);
  return ids;
}

async function collectAxNodes(
  session: Cdp,
  frameIds: string[]
): Promise<AxNode[]> {
  const trees = await Promise.all(
    frameIds.map(async (frameId) => {
      try {
        const { nodes } = (await session.sendCommand(CdpCommand.GetFullAXTree, {
          frameId,
        }));
        return nodes as AxNode[];
      } catch {
        return [];
      }
    })
  );
  return trees.flat();
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

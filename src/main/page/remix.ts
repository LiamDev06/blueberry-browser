import type { Tab } from "../Tab";
import type { ActionResult } from "./actions";
import remixReadScript from "./scripts/remix-read.js?raw";
import remixApplyScript from "./scripts/remix-apply.js?raw";

export const REMIX_MAIN_ATTR = "data-blueberry-remix-main";
export const REMIX_REGION_ATTR = "data-blueberry-remix-id";

const MAX_REGION_TEXT = 2500;
const MAX_MAIN_TEXT = 14000;
const MIN_BLOCK_TEXT = 80;
const MIN_MAIN_TEXT = 200;
const MAX_REGIONS = 40;

export type ContentRegion = {
  id: number;
  tag: string;
  preview: string;
  html: string;
};

export type RemixModel = {
  regions: ContentRegion[];
  mainHtml: string;
};

export type RemixTarget =
  | { kind: "main" }
  | { kind: "region"; id: number };

export type RemixAction =
  | "replace"
  | "append"
  | "prepend"
  | "before"
  | "after"
  | "remove";

export type RemixOp = {
  action: RemixAction;
  target: RemixTarget;
  html: string;
};

export type ResolvedRemixOp = {
  action: RemixAction;
  selector: string;
  html: string;
};

export async function readRemixModel(tab: Tab): Promise<RemixModel | null> {
  const config = {
    mainAttr: REMIX_MAIN_ATTR,
    regionAttr: REMIX_REGION_ATTR,
    maxRegionText: MAX_REGION_TEXT,
    maxMainText: MAX_MAIN_TEXT,
    minBlockText: MIN_BLOCK_TEXT,
    minMainText: MIN_MAIN_TEXT,
    maxRegions: MAX_REGIONS,
  };

  try {
    const result = await tab.runJs(`(${remixReadScript})(${JSON.stringify(config)})`);
    return result && result.ok ? (result as RemixModel & { ok: true }) : null;
  } catch {
    return null;
  }
}

export function resolveRemixOps(ops: RemixOp[]): ResolvedRemixOp[] {
  return ops.map((op) => ({
    action: op.action,
    selector: selectorFor(op.target),
    html: op.html,
  }));
}

export async function applyResolvedOps(
  tab: Tab,
  resolved: ResolvedRemixOp[]
): Promise<ActionResult> {
  const result = await tab.runJs(`(${remixApplyScript})(${JSON.stringify(resolved)})`);
  if (result && result.applied > 0) {
    return { ok: true };
  }
  return { ok: false, error: "None of the remix targets are on the page." };
}

export async function replayRemix(
  tab: Tab,
  resolved: ResolvedRemixOp[]
): Promise<ActionResult> {
  await readRemixModel(tab);
  return applyResolvedOps(tab, resolved);
}

function selectorFor(target: RemixTarget): string {
  return target.kind === "main"
    ? `[${REMIX_MAIN_ATTR}]`
    : `[${REMIX_REGION_ATTR}="${target.id}"]`;
}

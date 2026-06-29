import type { Tab } from "../Tab";
import type { ActionResult } from "./actions";

export const REMIX_MAIN_ATTR = "data-blueberry-remix-main";
export const REMIX_REGION_ATTR = "data-blueberry-remix-id";

const MAX_REGION_TEXT = 2500;
const MAX_MAIN_TEXT = 14000;
const MIN_BLOCK_TEXT = 80;
const MIN_MAIN_TEXT = 200;
const MAX_REGIONS = 40;

export type PageTheme = {
  background: string;
  foreground: string;
  fontFamily: string;
  fontSize: string;
  linkColor: string;
  isDark: boolean;
};

export type ContentRegion = {
  id: number;
  tag: string;
  preview: string;
  html: string;
};

export type RemixModel = {
  theme: PageTheme;
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

export async function readRemixModel(tab: Tab): Promise<RemixModel | null> {
  try {
    const result = await tab.runJs(remixModelScript());
    return result && result.ok ? (result as RemixModel & { ok: true }) : null;
  } catch {
    return null;
  }
}

function remixModelScript(): string {
  const config = JSON.stringify({
    mainAttr: REMIX_MAIN_ATTR,
    regionAttr: REMIX_REGION_ATTR,
    maxRegionText: MAX_REGION_TEXT,
    maxMainText: MAX_MAIN_TEXT,
    minBlockText: MIN_BLOCK_TEXT,
    minMainText: MIN_MAIN_TEXT,
    maxRegions: MAX_REGIONS,
  });

  return `(() => {
    const cfg = ${config};
    const SKIP = new Set(["NAV","HEADER","FOOTER","ASIDE","SCRIPT","STYLE","NOSCRIPT","SVG","FORM"]);
    const KEEP_ATTR = new Set(["class", "href", "src", "alt"]);
    const norm = (el) => ((el && el.innerText) || "").replace(/\\s+/g, " ").trim();
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 1 && rect.height > 1 && style.visibility !== "hidden" && style.display !== "none";
    };
    const isChrome = (el) => !!el.closest("nav, header, footer, aside");

    // A trimmed copy of an element's markup: only structural tags + the
    // class/href/src/alt attributes, so the model can mirror the site's own
    // tags and class names (and thus its styling) without the noise.
    const skeleton = (el) => {
      const clone = el.cloneNode(true);
      const strip = (node) => {
        for (const attr of Array.from(node.attributes)) {
          if (!KEEP_ATTR.has(attr.name)) node.removeAttribute(attr.name);
        }
        for (const child of Array.from(node.children)) {
          if (SKIP.has(child.tagName)) child.remove();
          else strip(child);
        }
      };
      strip(clone);
      return clone.outerHTML.replace(/\\s+/g, " ").trim();
    };

    if (!document.body) return { ok: false };

    document.querySelectorAll("[" + cfg.mainAttr + "], [" + cfg.regionAttr + "]").forEach((el) => {
      el.removeAttribute(cfg.mainAttr);
      el.removeAttribute(cfg.regionAttr);
    });

    let main = document.querySelector('main, [role="main"], article');
    if (!main || norm(main).length < cfg.minMainText) {
      let best = null;
      let bestLen = 0;
      document.body.querySelectorAll("main, article, section, div").forEach((el) => {
        if (SKIP.has(el.tagName) || isChrome(el) || !isVisible(el)) return;
        const len = norm(el).length;
        if (len > bestLen) { bestLen = len; best = el; }
      });
      main = best || document.body;
    }

    // Descend into the real content container: unwrap structural wrappers whose
    // text is dominated by a single child, so "the top of the content" is the
    // top of the article body — not the landmark with its title/chrome above it.
    const DESCEND = new Set(["DIV", "SECTION", "ARTICLE", "MAIN"]);
    for (let depth = 0; depth < 6; depth += 1) {
      const total = norm(main).length;
      if (total === 0) break;
      let dominant = null;
      for (const child of main.children) {
        if (SKIP.has(child.tagName) || isChrome(child) || !isVisible(child)) continue;
        if (DESCEND.has(child.tagName) && child.children.length > 0 && norm(child).length >= total * 0.9) {
          dominant = child;
          break;
        }
      }
      if (!dominant) break;
      main = dominant;
    }

    main.setAttribute(cfg.mainAttr, "1");

    const regions = [];
    let id = 0;
    let budget = cfg.maxMainText;
    for (const child of Array.from(main.children)) {
      if (regions.length >= cfg.maxRegions) break;
      if (SKIP.has(child.tagName) || isChrome(child) || !isVisible(child)) continue;
      const text = norm(child);
      if (text.length < cfg.minBlockText) continue;
      id += 1;
      child.setAttribute(cfg.regionAttr, String(id));
      const markup = budget > 0 ? skeleton(child).slice(0, Math.min(cfg.maxRegionText, budget)) : "";
      budget -= markup.length;
      regions.push({
        id,
        tag: child.tagName.toLowerCase(),
        preview: text.slice(0, 160),
        html: markup,
      });
    }

    let bg = "rgb(255, 255, 255)";
    for (let el = main; el; el = el.parentElement) {
      const color = getComputedStyle(el).backgroundColor;
      if (color && color !== "transparent" && !color.startsWith("rgba(0, 0, 0, 0)")) {
        bg = color;
        break;
      }
    }
    const luminance = (() => {
      const nums = bg.match(/\\d+(\\.\\d+)?/g);
      if (!nums || nums.length < 3) return 1;
      const [r, g, b] = nums.map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    })();

    const bodyStyle = getComputedStyle(document.body);
    const link = main.querySelector("a") || document.querySelector("a");
    const theme = {
      background: bg,
      foreground: bodyStyle.color,
      fontFamily: bodyStyle.fontFamily,
      fontSize: bodyStyle.fontSize,
      linkColor: link ? getComputedStyle(link).color : bodyStyle.color,
      isDark: luminance < 0.5,
    };

    return {
      ok: true,
      theme,
      regions,
      mainHtml: skeleton(main).slice(0, cfg.maxMainText),
    };
  })()`;
}

export async function applyRemixOps(
  tab: Tab,
  ops: RemixOp[]
): Promise<ActionResult> {
  const resolved = ops.map((op) => ({
    action: op.action,
    selector: selectorFor(op.target),
    html: op.html,
  }));

  const result = await tab.runJs(applyRemixScript(resolved));
  if (result && result.applied > 0) {
    return { ok: true };
  }
  return { ok: false, error: "None of the remix targets are on the page." };
}

function selectorFor(target: RemixTarget): string {
  return target.kind === "main"
    ? `[${REMIX_MAIN_ATTR}]`
    : `[${REMIX_REGION_ATTR}="${target.id}"]`;
}

function applyRemixScript(
  ops: { action: RemixAction; selector: string; html: string }[]
): string {
  return `(() => {
    const ops = ${JSON.stringify(ops)};
    const positions = { prepend: "afterbegin", append: "beforeend", before: "beforebegin", after: "afterend" };
    let applied = 0;
    for (const op of ops) {
      const el = document.querySelector(op.selector);
      if (!el) continue;
      if (op.action === "remove") {
        el.remove();
      } else if (op.action === "replace") {
        el.innerHTML = op.html;
      } else if (positions[op.action]) {
        el.insertAdjacentHTML(positions[op.action], op.html);
      } else {
        continue;
      }
      applied += 1;
    }

    if (applied > 0 && document.body && !document.getElementById("blueberry-remix-badge")) {
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
    return { applied };
  })()`;
}

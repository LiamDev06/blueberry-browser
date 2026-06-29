import type { Tab } from "../Tab";
import type { PageContent, PageSnapshot, RemixModel } from "./types";

const SETTLE_MS = 600;
const LOAD_TIMEOUT_MS = 8000;
const POLL_INTERVAL_MS = 100;
const MAX_PAGE_TEXT = 3000;

export const REMIX_MAIN_ATTR = "data-blueberry-remix-main";
export const REMIX_REGION_ATTR = "data-blueberry-remix-id";

const MAX_REGION_TEXT = 2500;
const MAX_MAIN_TEXT = 14000;
const MIN_BLOCK_TEXT = 80;
const MIN_MAIN_TEXT = 200;
const MAX_REGIONS = 40;

export function formatSnapshot(snapshot: PageSnapshot): string {
  const lines = snapshot.elements.map((element) => {
    const parts = [`[${element.index}] <${element.role}>`];
    if (element.name) {
      parts.push(`"${element.name}"`);
    }

    if (element.href) {
      parts.push(`-> ${element.href}`);
    }
    
    if (!element.inViewport) {
      parts.push("(off-screen)");
    }

    return parts.join(" ");
  });

  return [
    `URL: ${snapshot.url}`,
    `Title: ${snapshot.title}`,
    `Scroll: ${snapshot.scrollY}/${snapshot.scrollHeight}px (viewport ${snapshot.viewportHeight}px)`,
    `Interactive elements (${snapshot.elements.length}):`,
    ...lines,
  ].join("\n");
}

export async function readPageContent(
  tab: Tab,
  maxChars: number = MAX_PAGE_TEXT
): Promise<PageContent> {
  let text = "";
  try {
    const tabText = await tab.getTabText();
    text = tabText.replace(/\s+/g, " ").slice(0, maxChars);
  } catch {
    // Leave text empty.
  }
  return { title: tab.title, url: tab.url, text };
}

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
    const norm = (el) => ((el && el.innerText) || "").replace(/\\s+/g, " ").trim();
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 1 && rect.height > 1 && style.visibility !== "hidden" && style.display !== "none";
    };
    const isChrome = (el) => !!el.closest("nav, header, footer, aside");

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
      const included = budget > 0 ? text.slice(0, Math.min(cfg.maxRegionText, budget)) : "";
      budget -= included.length;
      regions.push({
        id,
        tag: child.tagName.toLowerCase(),
        preview: text.slice(0, 160),
        text: included,
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
      mainText: norm(main).slice(0, cfg.maxMainText),
    };
  })()`;
}

// Wait for the page to finish loading and settle before the next snapshot
export function waitForIdle(tab: Tab, isAborted: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = (): void => {
      if (isAborted()) {
        return resolve();
      }

      if (!tab.webContents.isLoadingMainFrame() || Date.now() - start > LOAD_TIMEOUT_MS) {
        setTimeout(resolve, SETTLE_MS);
      } else {
        setTimeout(check, POLL_INTERVAL_MS);
      }
    };
    check();
  });
}

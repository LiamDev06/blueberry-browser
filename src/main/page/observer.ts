import type { Tab } from "../Tab";
import type { PageContent, PageSnapshot } from "./types";

const SETTLE_MS = 600;
const LOAD_TIMEOUT_MS = 8000;
const POLL_INTERVAL_MS = 100;
const MAX_PAGE_TEXT = 3000;

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

  if (snapshot.hiddenElements > 0) {
    lines.push(
      `…and ${snapshot.hiddenElements} more off-screen element(s) not shown — scroll to bring them into view.`
    );
  }

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

(cfg) => {
  const SKIP = new Set([
    "NAV", "HEADER", "FOOTER", "ASIDE", "SCRIPT", "STYLE", "NOSCRIPT", "SVG", "FORM",
  ]);
  const KEEP_ATTR = new Set(["class", "href", "src", "alt"]);
  const DESCEND = new Set(["DIV", "SECTION", "ARTICLE", "MAIN"]);

  const norm = (el) => ((el && el.innerText) || "").replace(/\s+/g, " ").trim();

  const isVisible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return (
      rect.width > 1 &&
      rect.height > 1 &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  };

  const isChrome = (el) => !!el.closest("nav, header, footer, aside");

  const skeleton = (el) => {
    const clone = el.cloneNode(true);
    const strip = (node) => {
      for (const attr of Array.from(node.attributes)) {
        if (!KEEP_ATTR.has(attr.name)) {
          node.removeAttribute(attr.name);
        }
      }
      for (const child of Array.from(node.children)) {
        if (SKIP.has(child.tagName)) {
          child.remove();
        } else {
          strip(child);
        }
      }
    };
    strip(clone);
    return clone.outerHTML.replace(/\s+/g, " ").trim();
  };

  if (!document.body) {
    return { ok: false };
  }

  document
    .querySelectorAll("[" + cfg.mainAttr + "], [" + cfg.regionAttr + "]")
    .forEach((el) => {
      el.removeAttribute(cfg.mainAttr);
      el.removeAttribute(cfg.regionAttr);
    });

  let main = document.querySelector('main, [role="main"], article');
  if (!main || norm(main).length < cfg.minMainText) {
    let best = null;
    let bestLen = 0;
    document.body.querySelectorAll("main, article, section, div").forEach((el) => {
      if (SKIP.has(el.tagName) || isChrome(el) || !isVisible(el)) {
        return;
      }
      const len = norm(el).length;
      if (len > bestLen) {
        bestLen = len;
        best = el;
      }
    });
    main = best || document.body;
  }

  for (let depth = 0; depth < 6; depth += 1) {
    const total = norm(main).length;
    if (total === 0) {
      break;
    }
    let dominant = null;
    for (const child of main.children) {
      if (SKIP.has(child.tagName) || isChrome(child) || !isVisible(child)) {
        continue;
      }
      if (
        DESCEND.has(child.tagName) &&
        child.children.length > 0 &&
        norm(child).length >= total * 0.9
      ) {
        dominant = child;
        break;
      }
    }
    if (!dominant) {
      break;
    }
    main = dominant;
  }

  main.setAttribute(cfg.mainAttr, "1");

  const regions = [];
  let id = 0;
  let budget = cfg.maxMainText;
  for (const child of Array.from(main.children)) {
    if (regions.length >= cfg.maxRegions) {
      break;
    }
    if (SKIP.has(child.tagName) || isChrome(child) || !isVisible(child)) {
      continue;
    }
    const text = norm(child);
    if (text.length < cfg.minBlockText) {
      continue;
    }

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

  return {
    ok: true,
    regions,
    mainHtml: skeleton(main).slice(0, cfg.maxMainText),
  };
}

import sanitizeHtml from "sanitize-html";

export const VIRTUAL_PAGE_SCHEME = "blueberry";

type VirtualPage = {
  html: string;
  title?: string;
};

const ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  "html", "head", "body", "title", "meta", "style", "img",
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ensureTitle(html: string, fallbackTitle?: string): string {
  if (!fallbackTitle || /<title[\s>]/i.test(html)) {
    return html;
  }
  const titleTag = `<title>${escapeHtml(fallbackTitle)}</title>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${titleTag}`);
  }
  return `${titleTag}${html}`;
}

function sanitizeDocument(html: string, fallbackTitle?: string): string {
  const clean = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": ["class", "id", "style"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      meta: ["charset", "name", "content"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "data"],
    nonTextTags: ["script", "textarea", "option", "noscript"],
    allowVulnerableTags: true,
  });
  return ensureTitle(clean, fallbackTitle);
}

class VirtualPageStore {
  private pages: Map<string, VirtualPage> = new Map();
  private counter = 0;

  create(html: string, title?: string): string {
    const id = `page-${++this.counter}`;
    this.pages.set(id, { html: sanitizeDocument(html, title), title });
    return this.urlFor(id);
  }

  update(url: string, html: string, title?: string): boolean {
    const id = this.idFromUrl(url);
    if (!id || !this.pages.has(id)) {
      return false;
    }
    this.pages.set(id, { html: sanitizeDocument(html, title), title });
    return true;
  }

  htmlForUrl(url: string): string | undefined {
    const id = this.idFromUrl(url);
    return id ? this.pages.get(id)?.html : undefined;
  }

  deleteByUrl(url: string): void {
    const id = this.idFromUrl(url);
    if (id) {
      this.pages.delete(id);
    }
  }

  private urlFor(id: string): string {
    return `${VIRTUAL_PAGE_SCHEME}://page/${id}`;
  }

  private idFromUrl(url: string): string | null {
    if (!url.startsWith(`${VIRTUAL_PAGE_SCHEME}://`)) {
      return null;
    }
    try {
      const id = new URL(url).pathname.replace(/^\//, "");
      return id || null;
    } catch {
      return null;
    }
  }
}

export const virtualPageStore = new VirtualPageStore();

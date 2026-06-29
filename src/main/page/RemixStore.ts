import { randomUUID } from "node:crypto";
import { JsonFileStore } from "../JsonFileStore";
import type { ResolvedRemixOp } from "./remix";

export type StoredRemix = {
  id: string;
  url: string;
  pageTitle: string;
  label: string;
  ops: ResolvedRemixOp[];
  createdAt: number;
};

const MAX_REMIXES = 200;
const MAX_PER_URL = 10;

export class RemixStore extends JsonFileStore<StoredRemix> {
  constructor(filePath?: string) {
    super("remixes.json", filePath);
  }

  add(
    url: string,
    pageTitle: string,
    label: string,
    ops: ResolvedRemixOp[]
  ): StoredRemix | null {
    const key = normalizeUrl(url);
    if (!key || ops.length === 0) {
      return null;
    }

    const remix: StoredRemix = {
      id: randomUUID(),
      url: key,
      pageTitle,
      label: label.trim() || "Remix",
      ops,
      createdAt: Date.now(),
    };
    this.items.push(remix);

    const forUrl = this.items.filter((entry) => entry.url === key);
    if (forUrl.length > MAX_PER_URL) {
      const stale = new Set(
        forUrl
          .sort((a, b) => a.createdAt - b.createdAt)
          .slice(0, forUrl.length - MAX_PER_URL)
          .map((entry) => entry.id)
      );
      this.items = this.items.filter((entry) => !stale.has(entry.id));
    }
    if (this.items.length > MAX_REMIXES) {
      this.items = this.items.slice(-MAX_REMIXES);
    }

    void this.persist();
    return remix;
  }

  getForUrl(url: string): StoredRemix[] {
    const key = normalizeUrl(url);
    return this.items
      .filter((entry) => entry.url === key)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  get(id: string): StoredRemix | null {
    return this.items.find((entry) => entry.id === id) ?? null;
  }

  remove(id: string): void {
    const next = this.items.filter((entry) => entry.id !== id);
    if (next.length !== this.items.length) {
      this.items = next;
      void this.persist();
    }
  }

  clear(): void {
    this.items = [];
    void this.persist();
  }
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

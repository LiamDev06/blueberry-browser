import { randomUUID } from "node:crypto";
import { JsonFileStore } from "../JsonFileStore";

export type Memory = {
  id: string;
  text: string;
  createdAt: number;
};

const MAX_MEMORIES = 50;

export class MemoryStore extends JsonFileStore<Memory> {
  constructor(filePath?: string) {
    super("memories.json", filePath);
  }

  add(text: string): Memory | null {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    const isDuplicate = this.items.some(
      (memory) => memory.text.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      return null;
    }

    const memory: Memory = {
      id: randomUUID(),
      text: trimmed,
      createdAt: Date.now(),
    };
    this.items.push(memory);

    if (this.items.length > MAX_MEMORIES) {
      this.items = this.items.slice(-MAX_MEMORIES);
    }

    void this.persist();
    return memory;
  }

  getAll(): Memory[] {
    return this.items;
  }

  clear(): void {
    this.items = [];
    void this.persist();
  }

  promptSection(): string {
    if (this.items.length === 0) {
      return "";
    }

    const lines = this.items.map((memory) => `- ${memory.text}`).join("\n");
    return `\nWhat you remember about this user (from past conversations):\n${lines}`;
  }
}

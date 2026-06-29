import { app } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type Memory = {
  id: string;
  text: string;
  createdAt: number;
};

const MAX_MEMORIES = 50;

export class MemoryStore {
  private memories: Memory[] = [];
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath("userData"), "memories.json");
    this.load();
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf-8"));
      if (Array.isArray(parsed)) {
        this.memories = parsed;
      }
    } catch (error) {
      console.error("Failed to load memories:", error);
    }
  }

  private async persist(): Promise<void> {
    try {
      await writeFile(
        this.filePath,
        JSON.stringify(this.memories, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error("Failed to save memories:", error);
    }
  }

  add(text: string): Memory | null {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    const isDuplicate = this.memories.some(
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
    this.memories.push(memory);

    if (this.memories.length > MAX_MEMORIES) {
      this.memories = this.memories.slice(-MAX_MEMORIES);
    }

    void this.persist();
    return memory;
  }

  getAll(): Memory[] {
    return this.memories;
  }

  clear(): void {
    this.memories = [];
    void this.persist();
  }

  promptSection(): string {
    if (this.memories.length === 0) {
      return "";
    }

    const lines = this.memories.map((memory) => `- ${memory.text}`).join("\n");
    return `\nWhat you remember about this user (from past conversations):\n${lines}`;
  }
}

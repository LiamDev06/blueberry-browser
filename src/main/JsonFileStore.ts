import { app } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export abstract class JsonFileStore<T> {
  protected items: T[] = [];
  private readonly filePath: string;

  constructor(fileName: string, filePath?: string) {
    this.filePath = filePath ?? join(app.getPath("userData"), fileName);
    this.load();
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf-8"));
      if (Array.isArray(parsed)) {
        this.items = parsed;
      }
    } catch (error) {
      console.error(`Failed to load ${this.filePath}:`, error);
    }
  }

  protected async persist(): Promise<void> {
    try {
      await writeFile(
        this.filePath,
        JSON.stringify(this.items, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error(`Failed to save ${this.filePath}:`, error);
    }
  }
}

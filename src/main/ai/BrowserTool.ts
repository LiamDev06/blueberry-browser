import type { z } from "zod";
import type { ToolContext } from "./ToolContext";
import type { ToolName } from "@shared/types";

export type ToolCall = {
  toolCallId: string;
}

export type ToolImage = {
  data: string; // base64-encoded, no data: prefix
  mediaType: string;
}

export type ToolResult = {
  status: "done" | "error";
  title: string;
  reobserve: boolean;
  message?: string;
  image?: ToolImage;
}

// Succeeded: mark the step done and follow with a fresh snapshot (+ optional note and image)
export function ok(title: string, note?: string, image?: ToolImage): ToolResult {
  return { status: "done", title, reobserve: true, message: note, image };
}

// Failed: mark the step errored but still re-observe so the model sees the page
export function fail(title: string, note?: string): ToolResult {
  return { status: "error", title, reobserve: true, message: note };
}

// Terminal: mark the step done and feed the model exactly this, with no snapshot
export function finish(title: string, message: string): ToolResult {
  return { status: "done", title, reobserve: false, message };
}

export abstract class BrowserTool<TInput> {
  abstract readonly name: ToolName;
  abstract readonly description: string;
  abstract readonly inputSchema: z.ZodType<TInput>;
  abstract execute(input: TInput, ctx: ToolContext): Promise<ToolResult>;
}

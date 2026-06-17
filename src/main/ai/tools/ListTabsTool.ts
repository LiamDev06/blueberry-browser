import { z } from "zod";
import { BrowserTool, reply, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";

const listTabsInputSchema = z.object({});

type ListTabsInput = z.infer<typeof listTabsInputSchema>;

export class ListTabsTool extends BrowserTool<ListTabsInput> {
  readonly name = "list_tabs";
  readonly description =
    "List every open tab with its ID, title, and URL, marking which one is active. Use this to find a tab's ID before switching to or closing it.";
  readonly inputSchema = listTabsInputSchema;

  async execute(_input: ListTabsInput, ctx: ToolContext): Promise<ToolResult> {
    const activeId = ctx.tab.id;
    const lines = ctx.window.allTabs.map((tab) => {
      const marker = tab.id === activeId ? " (active)" : "";
      return `- ${tab.id}${marker}: ${tab.title || "Untitled"} — ${tab.url}`;
    });
    
    return reply(
      `${lines.length} open tab${lines.length === 1 ? "" : "s"}`,
      `Open tabs:\n${lines.join("\n")}`
    );
  }
}

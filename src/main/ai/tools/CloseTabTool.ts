import { z } from "zod";
import { BrowserTool, ok, fail, type ToolResult } from "./BrowserTool";
import type { ToolContext } from "./ToolContext";

const closeTabInputSchema = z.object({
  tabId: z.string().describe("The ID of the tab to close."),
});

type CloseTabInput = z.infer<typeof closeTabInputSchema>;

export class CloseTabTool extends BrowserTool<CloseTabInput> {
  readonly name = "close_tab";
  readonly description =
    "Close an open tab by its ID. If you close the active tab, the browser switches to another open tab. The last remaining tab can't be closed.";
  readonly inputSchema = closeTabInputSchema;

  async execute(input: CloseTabInput, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.window.getTab(input.tabId)) {
      return fail(
        `No tab ${input.tabId}`,
        "There's no open tab with that ID. Use list_tabs to see what's open."
      );
    }
    
    if (ctx.window.tabCount <= 1) {
      return fail(
        "Can't close the last tab",
        "This is the only open tab, so it can't be closed."
      );
    }
    
    ctx.window.closeTab(input.tabId);
    return ok(`Closed ${input.tabId}`, `Now on ${ctx.tab.id}.`);
  }
}

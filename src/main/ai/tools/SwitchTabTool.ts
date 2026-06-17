import { z } from "zod";
import { BrowserTool, look, fail, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";

const switchTabInputSchema = z.object({
  tabId: z
    .string()
    .describe('The ID of the tab to switch to, e.g. "tab-2". Use list_tabs to see the IDs.'),
});

type SwitchTabInput = z.infer<typeof switchTabInputSchema>;

export class SwitchTabTool extends BrowserTool<SwitchTabInput> {
  readonly name = "switch_tab";
  readonly description =
    "Switch to another open tab by its ID, so your following actions happen in that tab.";
  readonly inputSchema = switchTabInputSchema;

  async execute(input: SwitchTabInput, ctx: ToolContext): Promise<ToolResult> {
    if (ctx.tab.id === input.tabId) {
      return look(`Already on ${input.tabId}`);
    }
    
    if (!ctx.window.switchActiveTab(input.tabId)) {
      return fail(
        `No tab ${input.tabId}`,
        "There's no open tab with that ID. Use list_tabs to see what's open."
      );
    }
    
    return look(`Switched to ${input.tabId}`);
  }
}

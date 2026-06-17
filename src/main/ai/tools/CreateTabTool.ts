import { z } from "zod";
import { BrowserTool, look, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";
import { Utils } from "../../utils";

const createTabInputSchema = z.object({
  url: z
    .string()
    .optional()
    .describe("Optional URL to open in the new tab. If omitted, the tab opens to Google."),
});

type CreateTabInput = z.infer<typeof createTabInputSchema>;

export class CreateTabTool extends BrowserTool<CreateTabInput> {
  readonly name = "create_tab";
  readonly description =
    "Open a new tab and switch to it, so your next actions happen there. Optionally give a URL to load. Useful for comparing options side by side without losing your current tab.";
  readonly inputSchema = createTabInputSchema;

  async execute(input: CreateTabInput, ctx: ToolContext): Promise<ToolResult> {
    const target = input.url ? Utils.ensureUrlScheme(input.url) : undefined;
    const tab = ctx.window.createTab(target);
    
    ctx.window.switchActiveTab(tab.id);
    
    const where = target ? ` at ${Utils.hostnameFromUrl(target)}` : "";
    return look(`Opened a new tab${where}`, `Created and switched to ${tab.id}.`);
  }
}

import { z } from "zod";
import { BrowserTool, look, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";
import { Utils } from "../../utils";

const navigateInputSchema = z.object({
  url: z.string().describe("The URL to navigate to."),
});

type NavigateInput = z.infer<typeof navigateInputSchema>;

export class NavigateTool extends BrowserTool<NavigateInput> {
  readonly name = "navigate";
  readonly description = "Navigate the active tab directly to a URL.";
  readonly inputSchema = navigateInputSchema;

  async execute(input: NavigateInput, ctx: ToolContext): Promise<ToolResult> {
    const target = Utils.ensureUrlScheme(input.url);
    await ctx.tab.loadURL(target);
    return look(`Opened ${Utils.hostnameFromUrl(target)}`);
  }
}

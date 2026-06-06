import { z } from "zod";
import { BrowserTool, ok, type ToolResult } from "./BrowserTool";
import type { ToolContext } from "./ToolContext";
import { hostnameFromUrl } from "../../utils";

const navigateInputSchema = z.object({
  url: z.string().describe("The URL to navigate to."),
});

type NavigateInput = z.infer<typeof navigateInputSchema>;

function full(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

export class NavigateTool extends BrowserTool<NavigateInput> {
  readonly name = "navigate";
  readonly description = "Navigate the active tab directly to a URL.";
  readonly inputSchema = navigateInputSchema;

  async execute(input: NavigateInput, ctx: ToolContext): Promise<ToolResult> {
    const target = full(input.url);
    await ctx.tab.loadURL(target);
    return ok(`Opened ${hostnameFromUrl(target)}`);
  }
}

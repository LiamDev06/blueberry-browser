import { z } from "zod";
import { BrowserTool, ok, fail, type ToolResult } from "./BrowserTool";
import type { ToolContext } from "./ToolContext";

const forwardInputSchema = z.object({});

type ForwardInput = z.infer<typeof forwardInputSchema>;

export class ForwardTool extends BrowserTool<ForwardInput> {
  readonly name = "forward";
  readonly description =
    "Go forward to the next page in this tab's navigation history.";
  readonly inputSchema = forwardInputSchema;

  async execute(_input: ForwardInput, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.tab.goForward()) {
      return fail("Can't go forward", "There is no next page in history.");
    }
    return ok("Went forward");
  }
}

import { z } from "zod";
import { BrowserTool, look, fail, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";

const backInputSchema = z.object({});

type BackInput = z.infer<typeof backInputSchema>;

export class BackTool extends BrowserTool<BackInput> {
  readonly name = "back";
  readonly description =
    "Go back to the previous page in this tab's navigation history.";
  readonly inputSchema = backInputSchema;

  async execute(_input: BackInput, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.tab.goBack()) {
      return fail("Can't go back", "There is no previous page in history.");
    }
    return look("Went back");
  }
}

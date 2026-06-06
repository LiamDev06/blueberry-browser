import { z } from "zod";
import { scroll } from "../../page/actions";
import { BrowserTool, ok, type ToolResult } from "./BrowserTool";
import type { ToolContext } from "./ToolContext";

const scrollInputSchema = z.object({
  direction: z.enum(["up", "down"]),
});

type ScrollInput = z.infer<typeof scrollInputSchema>;

export class ScrollTool extends BrowserTool<ScrollInput> {
  readonly name = "scroll";
  readonly description =
    "Scroll the page up or down by roughly one screen to reveal more elements.";
  readonly inputSchema = scrollInputSchema;

  async execute(input: ScrollInput, ctx: ToolContext): Promise<ToolResult> {
    await scroll(ctx.tab, input.direction);
    return ok(`Scrolled ${input.direction}`);
  }
}

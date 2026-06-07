import { z } from "zod";
import { locateElement, verifyPoint } from "../../page/actions";
import { BrowserTool, ok, fail, type ToolResult } from "./BrowserTool";
import type { ToolContext } from "./ToolContext";
import { HOVER_MS } from "./constants";
import { delay } from "../../utils";

const clickInputSchema = z.object({
  index: z.number().describe("Index of the element to click."),
  description: z
    .string()
    .describe("Short label of what is being clicked, e.g. 'Pricing link'.")
    .optional(),
});

type ClickInput = z.infer<typeof clickInputSchema>;

export class ClickTool extends BrowserTool<ClickInput> {
  readonly name = "click";
  readonly description =
    "Click an element by its index. Moves the real mouse to it, checks the cursor is actually over it, then clicks — so hover menus, dropdowns and overlays behave correctly.";
  readonly inputSchema = clickInputSchema;

  async execute(input: ClickInput, ctx: ToolContext): Promise<ToolResult> {
    const { description, index } = input;
    const label = description || `element [${index}]`;

    const nodeId = ctx.registry.nodeIdFor(index);
    if (nodeId === undefined) {
      return fail(
        `Couldn't click ${label}`,
        `No element [${index}] in the latest snapshot — take a fresh look.`
      );
    }

    const loc = await locateElement(ctx.tab, nodeId);
    if (!loc.ok) {
      return fail(`Couldn't click ${label}`, `Could not click: ${loc.error}`);
    }

    ctx.overlay?.moveCursor(loc.x, loc.y);
    ctx.tab.moveMouse(loc.x, loc.y);
    await delay(HOVER_MS);

    const check = await verifyPoint(ctx.tab, nodeId, loc.x, loc.y);
    if (!check.ok) {
      return fail(
        `Couldn't click ${label}`,
        `Did not click — the position check failed: ${check.error}`
      );
    }

    ctx.tab.clickAt(loc.x, loc.y);
    return ok(`Clicked ${description || check.target}`);
  }
}

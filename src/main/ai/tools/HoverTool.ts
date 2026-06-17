import { z } from "zod";
import { locateElement } from "../../page/actions";
import { BrowserTool, look, fail, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";
import { HOVER_MS } from "./constants";
import { Utils } from "../../utils";

const hoverInputSchema = z.object({
  index: z.number().describe("Index of the element to hover."),
  description: z.string().describe("Short label, e.g. 'Products menu'.").optional(),
});

type HoverInput = z.infer<typeof hoverInputSchema>;

export class HoverTool extends BrowserTool<HoverInput> {
  readonly name = "hover";
  readonly description =
    "Move the mouse over an element without clicking, to open a hover/dropdown menu. Its items appear in the snapshot returned — then click the one you want.";
  readonly inputSchema = hoverInputSchema;

  async execute(input: HoverInput, ctx: ToolContext): Promise<ToolResult> {
    const { index } = input;
    const label = input.description || `element [${index}]`;

    const nodeId = ctx.registry.nodeIdFor(index);
    if (nodeId === undefined) {
      return fail(
        `Couldn't hover ${label}`,
        `No element [${index}] in the latest snapshot — take a fresh look.`
      );
    }

    const loc = await locateElement(ctx.tab, nodeId);
    if (!loc.ok) {
      return fail(`Couldn't hover ${label}`, `Could not hover: ${loc.error}`);
    }

    ctx.overlay?.moveCursor(loc.x, loc.y);
    ctx.tab.moveMouse(loc.x, loc.y);
    await Utils.delay(HOVER_MS);
    return look(
      `Hovered ${label}`,
      "Hovering. Any menu it opened is now in this snapshot"
    );
  }
}

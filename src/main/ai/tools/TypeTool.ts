import { z } from "zod";
import { locateElement, typeIntoElement } from "../../page/actions";
import { BrowserTool, ok, fail, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";

const typeInputSchema = z.object({
  index: z.number(),
  text: z.string(),
  submit: z.boolean().describe("Press Enter after typing.").optional(),
});

type TypeInput = z.infer<typeof typeInputSchema>;

export class TypeTool extends BrowserTool<TypeInput> {
  readonly name = "type";
  readonly description =
    "Type text into an input or textarea by its index. Set submit to press Enter afterwards (e.g. to run a search).";
  readonly inputSchema = typeInputSchema;

  async execute(input: TypeInput, ctx: ToolContext): Promise<ToolResult> {
    const { index, text, submit } = input;

    const nodeId = ctx.registry.nodeIdFor(index);
    if (nodeId === undefined) {
      return fail(
        `Couldn't type into [${index}]`,
        `No element [${index}] in the latest snapshot — take a fresh look.`
      );
    }

    const loc = await locateElement(ctx.tab, nodeId);
    if (loc.ok) {
      ctx.overlay?.moveCursor(loc.x, loc.y);
    }

    const result = await typeIntoElement(ctx.tab, nodeId, text, !!submit);
    if (!result.ok) {
      return fail(`Couldn't type into [${index}]`, `Could not type: ${result.error}`);
    }
    
    return ok(`Typed “${text}”${submit ? " and pressed Enter" : ""}`);
  }
}

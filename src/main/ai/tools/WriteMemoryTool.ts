import { z } from "zod";
import { BrowserTool, reply, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";

const writeMemoryInputSchema = z.object({
  content: z
    .string()
    .describe(
      "A concise, self-contained note about the user, e.g. 'Prefers prices in GBP.'"
    ),
});

type WriteMemoryInput = z.infer<typeof writeMemoryInputSchema>;

export class WriteMemoryTool extends BrowserTool<WriteMemoryInput> {
  readonly name = "write_memory";
  readonly description =
    "Save anything durable you learn about the user — stated outright OR inferred from the choices they make — that would make a future task better: how they like things, who they are, recurring context, decisions they make repeatedly (e.g. always picks the cheapest option, prefers window seats, wants prices in GBP). When in doubt, save it: a slightly-too-eager note is cheap, a forgotten preference is not. Skip only genuinely one-off task mechanics.";
  readonly inputSchema = writeMemoryInputSchema;

  async execute(input: WriteMemoryInput, ctx: ToolContext): Promise<ToolResult> {
    const saved = ctx.memory.add(input.content);
    if (!saved) {
      return reply("Already in memory", "Nothing new to remember.");
    }
    return reply(
      `Wrote “${saved.text}” to memory`,
      `Saved to memory: ${saved.text}`
    );
  }
}

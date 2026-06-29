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
    "Save a durable preference or fact the user reveals about themselves so it can inform future tasks. Use for lasting context, not one-off task details.";
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

import { z } from "zod";
import { BrowserTool, reply, fail, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";

const updateVirtualPageInputSchema = z.object({
  tab_id: z
    .string()
    .describe("The id of the virtual page to update, as returned by create_virtual_page (e.g. \"tab-3\")."),
  html: z
    .string()
    .describe(
      "The full replacement HTML document for the page, including <head>, a <title>, and inline <style>. No <script> — pages are static and any scripts are stripped."
    ),
  title: z
    .string()
    .optional()
    .describe("Optional tab title. Used only if the HTML has no <title> of its own."),
});

type UpdateVirtualPageInput = z.infer<typeof updateVirtualPageInputSchema>;

export class UpdateVirtualPageTool extends BrowserTool<UpdateVirtualPageInput> {
  readonly name = "update_virtual_page";
  readonly description =
    "Replace the contents of a virtual page you created earlier with create_virtual_page, re-rendering it in the same tab. Use this to refine a report or write-up — adjust styling, add a section, fix a heading — instead of opening a new tab each time. Pass the full updated HTML document.";
  readonly inputSchema = updateVirtualPageInputSchema;

  async execute(input: UpdateVirtualPageInput, ctx: ToolContext): Promise<ToolResult> {
    const ok = ctx.window.updateVirtualPage(input.tab_id, input.html, input.title);
    if (!ok) {
      return fail(
        "Couldn't update the page",
        `There's no virtual page with tab id "${input.tab_id}". Use list_tabs to check, or create_virtual_page to make a new one.`
      );
    }
    return reply("Updated the page", `Re-rendered the virtual page in ${input.tab_id}.`);
  }
}

import { z } from "zod";
import { BrowserTool, reply, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";

const createVirtualPageInputSchema = z.object({
  html: z
    .string()
    .describe(
      "A complete, self-contained HTML document for the page, including <html>, <head>, a <title>, and inline <style> for a polished look. No <script> — pages are static and any scripts are stripped."
    ),
  title: z
    .string()
    .optional()
    .describe("Optional tab title. Used only if the HTML has no <title> of its own."),
});

type CreateVirtualPageInput = z.infer<typeof createVirtualPageInputSchema>;

export class CreateVirtualPageTool extends BrowserTool<CreateVirtualPageInput> {
  readonly name = "create_virtual_page";
  readonly description =
    "Render your own HTML as a new browser tab — a virtual page that looks like a real site but exists only in this browser, with no real website behind it. Use it to present results to the user as a page rather than chat: reports, summaries, dashboards, or formatted write-ups of data you gathered. Pass a complete, styled HTML document. The page is static (no JavaScript). To revise it later, use update_virtual_page with the tab id returned here.";
  readonly inputSchema = createVirtualPageInputSchema;

  async execute(input: CreateVirtualPageInput, ctx: ToolContext): Promise<ToolResult> {
    const tab = ctx.window.createVirtualPage(input.html, input.title);
    const label = input.title || tab.title || "page";
    return reply(
      `Created page "${label}"`,
      `Opened the virtual page as ${tab.id}. To revise it, call update_virtual_page with tab_id "${tab.id}".`
    );
  }
}

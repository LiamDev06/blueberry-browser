import { z } from "zod";
import { BrowserTool, ok, type ToolResult } from "./BrowserTool";
import type { ToolContext } from "./ToolContext";

const MAX_WIDTH = 1024;

const screenshotInputSchema = z.object({});

type ScreenshotInput = z.infer<typeof screenshotInputSchema>;

export class ScreenshotTool extends BrowserTool<ScreenshotInput> {
  readonly name = "screenshot";
  readonly description =
    "Capture a screenshot of the current tab so you can see how the page actually looks — layout, images, colors, charts, and anything the text snapshot can't convey. Use this when the visual appearance matters or when the element list alone isn't enough to decide what to do.";
  readonly inputSchema = screenshotInputSchema;

  async execute(_input: ScreenshotInput, ctx: ToolContext): Promise<ToolResult> {
    let image = await ctx.tab.screenshot();

    if (image.getSize().width > MAX_WIDTH) {
      image = image.resize({ width: MAX_WIDTH });
    }

    return ok("Took a screenshot", "Here's what the page looks like right now:", {
      data: image.toPNG().toString("base64"),
      mediaType: "image/png",
    });
  }
}

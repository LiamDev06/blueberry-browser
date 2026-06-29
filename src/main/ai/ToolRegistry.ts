import { tool, type ToolSet } from "ai";
import { waitForIdle } from "../page/observer";
import type { BrowserTool } from "./BrowserTool";
import { ToolContext, type ToolDependencies } from "./ToolContext";
import { ClickTool } from "./tools/ClickTool";
import { HoverTool } from "./tools/HoverTool";
import { TypeTool } from "./tools/TypeTool";
import { NavigateTool } from "./tools/NavigateTool";
import { BackTool } from "./tools/BackTool";
import { ForwardTool } from "./tools/ForwardTool";
import { ScrollTool } from "./tools/ScrollTool";
import { ScreenshotTool } from "./tools/ScreenshotTool";
import { RemixTool } from "./tools/RemixTool";
import { ListTabsTool } from "./tools/ListTabsTool";
import { CreateTabTool } from "./tools/CreateTabTool";
import { SwitchTabTool } from "./tools/SwitchTabTool";
import { CloseTabTool } from "./tools/CloseTabTool";
import { WriteMemoryTool } from "./tools/WriteMemoryTool";
import { DoneTool } from "./tools/DoneTool";

export class ToolRegistry {
  constructor(private readonly tools: BrowserTool<any>[]) {}

  bind(dependencies: ToolDependencies): ToolSet {
    return Object.fromEntries(
      this.tools.map((target) => [
        target.name,
        tool({
          description: target.description,
          inputSchema: target.inputSchema,
          execute: async (input, { toolCallId }) => {
            if (dependencies.isAborted()) {
              return { text: "The user stopped the task." };
            }

            const ctx = new ToolContext(dependencies, target.name, { toolCallId });
            ctx.startAction();
            const result = await target.execute(input, ctx);
            ctx.finishAction(result.status, result.title);

            let text: string;
            if (!result.reobserve) {
              text = result.message ?? "";
            } else {
              await waitForIdle(ctx.tab, ctx.isAborted);
              const snapshot = await ctx.registry.observe(ctx.tab);
              text = result.message
                ? `${result.message}\n\nCurrent page:\n${snapshot}`
                : `Current page:\n${snapshot}`;
            }

            return { text, image: result.image };
          },
          toModelOutput: ({ output }) => ({
            type: "content",
            value: [
              { type: "text", text: output.text },
              ...(output.image
                ? [
                    {
                      type: "media" as const,
                      data: output.image.data,
                      mediaType: output.image.mediaType,
                    },
                  ]
                : []),
            ],
          }),
        }),
      ])
    );
  }
}

export const agentTools = new ToolRegistry([
  new ClickTool(),
  new HoverTool(),
  new TypeTool(),
  new NavigateTool(),
  new BackTool(),
  new ForwardTool(),
  new ScrollTool(),
  new ScreenshotTool(),
  new RemixTool(),
  new ListTabsTool(),
  new CreateTabTool(),
  new SwitchTabTool(),
  new CloseTabTool(),
  new WriteMemoryTool(),
  new DoneTool(),
]);

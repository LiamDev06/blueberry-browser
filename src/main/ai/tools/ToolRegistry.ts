import { tool, type ToolSet } from "ai";
import { waitForIdle } from "../../page/observer";
import type { BrowserTool } from "./BrowserTool";
import { ToolContext, type ToolDependencies } from "./ToolContext";
import { ClickTool } from "./ClickTool";
import { HoverTool } from "./HoverTool";
import { TypeTool } from "./TypeTool";
import { NavigateTool } from "./NavigateTool";
import { BackTool } from "./BackTool";
import { ForwardTool } from "./ForwardTool";
import { ScrollTool } from "./ScrollTool";
import { ScreenshotTool } from "./ScreenshotTool";
import { RemixTool } from "./RemixTool";
import { ListTabsTool } from "./ListTabsTool";
import { CreateTabTool } from "./CreateTabTool";
import { SwitchTabTool } from "./SwitchTabTool";
import { CloseTabTool } from "./CloseTabTool";
import { DoneTool } from "./DoneTool";

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
  new DoneTool(),
]);

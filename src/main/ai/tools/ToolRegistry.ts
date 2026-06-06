import { tool, type ToolSet } from "ai";
import { waitForIdle } from "../../page/observer";
import type { BrowserTool } from "./BrowserTool";
import { ToolContext, type ToolDependencies } from "./ToolContext";
import { ClickTool } from "./ClickTool";
import { HoverTool } from "./HoverTool";
import { TypeTool } from "./TypeTool";
import { NavigateTool } from "./NavigateTool";
import { ScrollTool } from "./ScrollTool";
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
              return "The user stopped the task.";
            }

            const ctx = new ToolContext(dependencies, target.name, { toolCallId });
            ctx.startAction();
            const result = await target.execute(input, ctx);
            ctx.finishAction(result.status, result.title);

            if (!result.reobserve) {
              return result.message ?? "";
            }

            await waitForIdle(ctx.tab, ctx.isAborted);
            const snapshot = await ctx.registry.observe(ctx.tab);

            return result.message
              ? `${result.message}\n\nCurrent page:\n${snapshot}`
              : `Current page:\n${snapshot}`;
          },
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
  new ScrollTool(),
  new DoneTool(),
]);

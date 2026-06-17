import { z } from "zod";
import { readPageContent } from "../../page/observer";
import { validateGoal } from "../AgentGoal";
import { BrowserTool, look, reply, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";

const doneInputSchema = z.object({
  summary: z
    .string()
    .describe("A friendly summary of what you did, or the answer to the question."),
});

type DoneInput = z.infer<typeof doneInputSchema>;

export class DoneTool extends BrowserTool<DoneInput> {
  readonly name = "done";
  readonly description =
    "Call when you believe the goal is met (or is genuinely impossible). Give a natural-language summary or answer. An independent validator checks the page against the goal before finishing — if it isn't met you'll be told what's missing and should keep going.";
  readonly inputSchema = doneInputSchema;

  async execute(input: DoneInput, ctx: ToolContext): Promise<ToolResult> {
    const { summary } = input;
    ctx.setStatus("validating");

    const activeId = ctx.tab.id;
    const pages = await Promise.all(
      ctx.window.allTabs.map(async (tab) => {
        const content = await readPageContent(tab);
        return {
          id: tab.id,
          active: tab.id === activeId,
          title: content.title,
          url: content.url,
          text: content.text,
        };
      })
    );

    const evidence = {
      snapshotText: await ctx.registry.observe(ctx.tab),
      pages,
    };
    const verdict = await validateGoal(ctx.llm, ctx.goal, evidence, summary);

    ctx.run.criteria = ctx.run.criteria.map((criterion, i) => {
      const v =
        verdict.criteria.length === ctx.run.criteria.length
          ? verdict.criteria[i]
          : verdict.criteria.find((x) => x.criterion === criterion.text);
      return { text: criterion.text, met: v ? v.met : criterion.met };
    });

    if (verdict.complete || ctx.run.criteria.length === 0) {
      ctx.run.criteria = ctx.run.criteria.map((criterion) => ({ text: criterion.text, met: true }));
      ctx.run.summary = summary;
      ctx.setStatus("done");
      return reply("Goal reached", "Validated: the goal is met. Task complete.");
    }

    ctx.setStatus("running");

    const unmet = verdict.criteria
      .filter((criterion) => !criterion.met)
      .map((criterion) => `- ${criterion.criterion}`)
      .join("\n");
    return look(
      "Not done yet — continuing",
      [
        `The goal is NOT fully met yet, so keep going.`,
        verdict.feedback ? `What's missing: ${verdict.feedback}` : "",
        unmet ? `Unmet criteria:\n${unmet}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
}

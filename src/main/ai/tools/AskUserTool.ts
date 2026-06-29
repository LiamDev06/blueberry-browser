import { z } from "zod";
import { BrowserTool, reply, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";

const askUserInputSchema = z.object({
  question: z
    .string()
    .describe("The question to put to the user, phrased naturally and in the first person."),
  options: z
    .array(z.string())
    .describe(
      "Suggested answers the user can pick from with one click. Offer these whenever there are clear choices. Leave empty for an open-ended question. The user can always type their own answer regardless."
    )
    .optional(),
});

type AskUserInput = z.infer<typeof askUserInputSchema>;

export class AskUserTool extends BrowserTool<AskUserInput> {
  readonly name = "ask_user";
  readonly description =
    "Ask the user a question whenever their input would meaningfully change what you do — the request is ambiguous, there are several reasonable options, a wrong guess would waste real effort, missing details only they have (a size, date, account), or before something consequential. Ask at genuine decision points rather than pushing ahead on an assumption. Provide `options` for clear choices; the user can also type their own answer. Execution pauses until they respond, then you get their answer. You don't need to ask about things you can confirm yourself by looking at the page.";
  readonly inputSchema = askUserInputSchema;

  async execute(input: AskUserInput, ctx: ToolContext): Promise<ToolResult> {
    const options = input.options ?? [];

    const answer = await ctx.askUser(input.question, options);

    if (ctx.isAborted()) {
      return reply(
        "Question dismissed",
        "The user stopped the task without answering."
      );
    }

    if (!answer.trim()) {
      return reply(
        "No answer given",
        "The user didn't provide an answer. Use your best judgment to proceed, or ask again only if it's essential."
      );
    }

    return reply(
      "Got the user's answer",
      `You asked: "${input.question}"\n\nThe user answered:\n${answer}`
    );
  }
}

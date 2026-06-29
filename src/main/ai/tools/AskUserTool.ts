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
    "Ask the user a question the moment you don't have a definitive, unambiguous answer for what to do next. DO NOT GUESS. If the request leaves any real choice open — which option, which item, what details (a size, date, account), how to handle an edge case, anything where a reasonable person could pick differently — stop and ask. The only times you proceed without asking are when the request itself makes the answer unambiguous, or when you can settle it for certain by looking at the page. If you catch yourself about to assume, infer, or pick 'the most likely' option, that is exactly when to ask instead — a quick question is always cheaper than doing the wrong thing. Provide `options` for clear choices; the user can also type their own answer. Execution pauses until they respond, then you get their answer.";
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

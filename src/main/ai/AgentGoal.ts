import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

const taskGoalSchema = z.object({
  goal: z.string().describe("One sentence capturing the user's underlying intent."),
  criteria: z
    .array(z.string())
    .describe("1-3 intent-level outcomes that define success."),
});
export type TaskGoal = z.infer<typeof taskGoalSchema>;

const validationSchema = z.object({
  criteria: z.array(
    z.object({
      criterion: z.string(),
      met: z.boolean(),
      note: z.string().describe("Brief evidence or what's missing."),
    })
  ),
  complete: z.boolean().describe("True if the goal's intent is satisfied."),
  feedback: z
    .string()
    .describe("If not complete, what's missing and what to do next."),
});
export type Validation = z.infer<typeof validationSchema>;

export async function generateGoal(
  model: LanguageModel,
  query: string,
  startUrl: string
): Promise<TaskGoal> {

  function constructSystemPrompt(): string {
    return [
      "You convert a user's browser request into a concrete goal and a SHORT checklist (1-3 items) of success criteria.",
      "Track the user's UNDERLYING INTENT — the end goal — not the literal wording.",
      "Criteria must be outcome-based and judged by what the page shows, NOT by brittle specifics.",
      "Do NOT require an exact URL or domain. A relevant sub-page or equivalent page counts (e.g. 'on the Codex page' is satisfied by openai.com/codex).",
      "Prefer content-based outcomes, e.g. 'The page is the product's pricing page showing plan prices'.",
      "Keep it minimal: only what genuinely defines done.",
    ].join("\n");
  }

  function constructUserPrompt(): string {
    return `User request: ${query}\nThe browser currently starts at: ${startUrl}`;
  }

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: taskGoalSchema }),
      system: constructSystemPrompt(),
      prompt: constructUserPrompt(),
    });

    return { goal: output.goal, criteria: output.criteria.slice(0, 4) };
  } catch (error) {
    console.error("Goal generation failed:", error);
    return { goal: query, criteria: [] };
  }
}

type Evidence = {
  snapshotText: string;
  pageText: string;
}

export async function validateGoal(
  model: LanguageModel,
  goal: TaskGoal,
  evidence: Evidence,
  summary: string
): Promise<Validation> {
  if (goal.criteria.length === 0) {
    return { criteria: [], complete: true, feedback: "" };
  }

  function constructSystemPrompt(): string {
    return [
      "You are a fair validator for a browser agent. Judge whether the CURRENT page satisfies the goal's INTENT.",
      "Judge SEMANTICALLY, by page content and the goal's meaning — NOT by literal URL/string matching.",
      "Give reasonable benefit of the doubt: a relevant sub-page, an equivalent page, or a page whose content clearly serves the goal MEETS the criterion. For example, if the goal is to be on the Codex page, openai.com/codex satisfies it even if the goal mentioned openai.com.",
      "Only mark a criterion not met if the page clearly does NOT serve the user's intent.",
      "Return the SAME criteria in the SAME order you are given. Set complete=true when the overall intent is achieved.",
    ].join("\n");
  }

  function constructUserPrompt(): string {
    return [
      `Goal (the user's intent): ${goal.goal}`,
      "",
      `Success criteria:`,
      ...goal.criteria.map((criterion, i) => `${i + 1}. ${criterion}`),
      "",
      `The agent says: "${summary}"`,
      "",
      `--- Current page evidence ---`,
      evidence.snapshotText,
      "",
      `Page text (truncated):`,
      evidence.pageText || "(none)",
    ].join("\n");
  }

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: validationSchema }),
      system: constructSystemPrompt(),
      prompt: constructUserPrompt(),
    });

    return output;
  } catch (error) {
    console.error("Goal validation failed:", error);

    return {
      criteria: goal.criteria.map((criterion) => ({ criterion: criterion, met: true, note: "validator unavailable" })),
      complete: true,
      feedback: "",
    };
  }
}

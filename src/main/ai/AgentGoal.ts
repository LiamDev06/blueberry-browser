import { z } from "zod";
import { LLMClient } from "./LLMClient";

const taskGoalSchema = z.object({
  goal: z.string().describe("One sentence capturing the user's underlying intent."),
  criteria: z
    .array(z.string())
    .describe(
      "Success criteria. Emit ONE criterion per distinct item the request names (e.g. one per person/product); otherwise 1-3 intent-level outcomes that define success."
    ),
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
  llm: LLMClient,
  query: string,
  startUrl: string
): Promise<TaskGoal> {

  function constructSystemPrompt(): string {
    return [
      "You convert a user's browser request into a concrete goal and a checklist of success criteria.",
      "Track the user's UNDERLYING INTENT — the end goal — not the literal wording.",
      "Criteria must be outcome-based and judged semantically, NOT by brittle specifics like an exact URL or domain.",
      "",
      "Recognize the task TYPE:",
      "- NAVIGATION ('go to the pricing page'): the outcome is being on the right page. A relevant sub-page or equivalent page counts (e.g. 'on the Codex page' is satisfied by openai.com/codex). Prefer content-based outcomes, e.g. 'The page is the product's pricing page showing plan prices'.",
      "- INFORMATION ('find X', 'what is Y', 'compare A and B'): the outcome is OBTAINING the information. Do NOT phrase these as 'a page that shows ...' — a single page rarely holds the answer, and the agent may need several separate searches.",
      "",
      "DECOMPOSE multiple targets: when the request names several distinct items (two people, three products), emit ONE criterion PER item — never bundle them into one. They are looked up separately, often on different pages.",
      "Keep it minimal: only what genuinely defines done.",
      "",
      "Example — request: 'find the X handle for Elon Musk and Sam Altman'",
      "goal: 'Find the X (Twitter) handle for both Elon Musk and Sam Altman'",
      "criteria: [\"Elon Musk's X handle has been identified\", \"Sam Altman's X handle has been identified\"]",
    ].join("\n");
  }

  function constructUserPrompt(): string {
    return `User request: ${query}\nThe browser currently starts at: ${startUrl}`;
  }

  try {
    const output = await llm.generate(
      constructSystemPrompt(),
      constructUserPrompt(),
      taskGoalSchema
    );

    return { goal: output.goal, criteria: output.criteria.slice(0, 6) };
  } catch (error) {
    console.error("Goal generation failed:", error);
    return { goal: query, criteria: [] };
  }
}

type PageEvidence = {
  id: string;
  active: boolean;
  title: string;
  url: string;
  text: string;
};

type Evidence = {
  snapshotText: string;
  pages: PageEvidence[];
}

export async function validateGoal(
  llm: LLMClient,
  goal: TaskGoal,
  evidence: Evidence,
  summary: string
): Promise<Validation> {
  if (goal.criteria.length === 0) {
    return { criteria: [], complete: true, feedback: "" };
  }

  function constructSystemPrompt(): string {
    return [
      "You are a fair validator for a browser agent. Judge whether the open pages satisfy the goal's INTENT.",
      "Judge SEMANTICALLY, by page content and the goal's meaning — NOT by literal URL/string matching.",
      "The agent can work across multiple tabs. Evidence from EVERY open tab is provided below, not just the active one. A criterion is met if ANY open tab satisfies it — do NOT require all evidence to live on a single page. For a task that spans pages (e.g. comparing two products), it is complete when the relevant pages are each open in their own tab and together cover the goal.",
      "Give reasonable benefit of the doubt: a relevant sub-page, an equivalent page, or a page whose content clearly serves the goal MEETS the criterion. For example, if the goal is to be on the Codex page, openai.com/codex satisfies it even if the goal mentioned openai.com.",
      "For INFORMATION criteria, a criterion is met when the requested fact appears in an open tab's text OR is clearly established by the evidence (including the agent's reported answer when a relevant source tab is open). Different facts may live in different tabs or have been found sequentially.",
      "Judge each criterion INDEPENDENTLY. Do NOT mark them all complete just because most are. Only mark a criterion not met if NO open tab serves the user's intent for it.",
      "Return the SAME criteria in the SAME order you are given. Set complete=true only when EVERY criterion's intent is achieved.",
    ].join("\n");
  }

  function constructUserPrompt(): string {
    const pageSections = evidence.pages.flatMap((page) => [
      `# Tab ${page.id}${page.active ? " (active)" : ""}`,
      `Title: ${page.title}`,
      `URL: ${page.url}`,
      `Text (truncated): ${page.text || "(none)"}`,
      "",
    ]);

    return [
      `Goal (the user's intent): ${goal.goal}`,
      "",
      `Success criteria:`,
      ...goal.criteria.map((criterion, i) => `${i + 1}. ${criterion}`),
      "",
      `The agent says: "${summary}"`,
      "",
      `--- Open pages (${evidence.pages.length} tab${evidence.pages.length === 1 ? "" : "s"}) ---`,
      ...pageSections,
      `--- Interactive elements on the active tab ---`,
      evidence.snapshotText,
    ].join("\n");
  }

  try {
    return await llm.generate(
      constructSystemPrompt(),
      constructUserPrompt(),
      validationSchema
    );
  } catch (error) {
    console.error("Goal validation failed:", error);

    return {
      criteria: goal.criteria.map((criterion) => ({ criterion: criterion, met: true, note: "validator unavailable" })),
      complete: true,
      feedback: "",
    };
  }
}

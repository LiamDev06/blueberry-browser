import { z } from "zod";
import { BrowserTool, fail, reply, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";
import runJsScript from "../../page/scripts/run-js.js?raw";

const MAX_RESULT_CHARS = 20000;
const JS_TIMEOUT_MS = 10000;

const runJsInputSchema = z.object({
  purpose: z
    .string()
    .describe(
      "A short, human-readable summary of what this script does, e.g. 'Extract all product prices'. Shown to the user."
    ),
  code: z
    .string()
    .describe(
      "JavaScript to run in the page. Use `return` to send data back, and `await` for async work. Return only JSON-serializable values (objects, arrays, strings, numbers) — not DOM nodes."
    ),
});

type RunJsInput = z.infer<typeof runJsInputSchema>;

type ScriptOutcome =
  | { ok: true; value: string; truncated: boolean }
  | { ok: false; error: string };

export class RunJsTool extends BrowserTool<RunJsInput> {
  readonly name = "run_js";
  readonly description =
    "Run JavaScript directly in the active page and get its return value back. Reach for this whenever a task would otherwise take many click/scroll/read steps: extracting structured data (every row of a table, all links matching a pattern, prices across a list), querying the DOM with real logic, or making same-origin fetch calls. Your code runs inside an async function, so use `return` to hand back data and `await` for async work; return only JSON-serializable values. The page is NOT re-observed afterward, so if your script changes the page and you need to see it, follow up with a screenshot. For clicking, typing, or other state-changing actions prefer the dedicated tools, and ask the user first when anything is ambiguous.";
  readonly inputSchema = runJsInputSchema;

  async execute(input: RunJsInput, ctx: ToolContext): Promise<ToolResult> {
    const purpose = input.purpose.trim();
    const title = purpose ? `Ran script: ${purpose}` : "Ran a script";
    const script = buildScript(input.code);

    let outcome: ScriptOutcome;
    try {
      outcome = await withTimeout(ctx.tab.runJs(script), JS_TIMEOUT_MS);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return fail(title, `The script could not run: ${detail}`);
    }

    if (!outcome || typeof outcome !== "object" || !("ok" in outcome)) {
      return reply(title, `Script returned: ${String(outcome)}`);
    }

    if (!outcome.ok) {
      return fail(title, `The script threw an error: ${outcome.error}`);
    }

    const heading = outcome.truncated
      ? `Result (truncated to the first ${MAX_RESULT_CHARS} characters):`
      : "Result:";
    return reply(title, `${heading}\n${outcome.value}`);
  }
}

function buildScript(code: string): string {
  const run = `async () => {\n${code}\n}`;
  return `(${runJsScript})(${run}, ${MAX_RESULT_CHARS})`;
}

// Frees the agent loop if a script never resolves, so one bad script can't wedge a run forever.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

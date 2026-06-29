import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { BrowserTool, look, fail, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";
import {
  applyResolvedOps,
  readRemixModel,
  resolveRemixOps,
  type ContentRegion,
  type RemixAction,
  type RemixModel,
  type RemixOp,
  type RemixTarget,
} from "../../page/remix";

const ALLOWED_TAGS = [
  "section", "div", "h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "strong",
  "em", "b", "i", "blockquote", "a", "code", "pre", "br", "hr", "span",
  "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td",
];

const remixInputSchema = z.object({
  instruction: z
    .string()
    .describe(
      "How to transform the page, e.g. \"simplify like I'm 12\", \"summarize the key points\", \"translate the article to Spanish\", \"rewrite just the comments politely\"."
    ),
});

type RemixInput = z.infer<typeof remixInputSchema>;

const remixPlanSchema = z.object({
  title: z
    .string()
    .describe(
      "A short 2–4 word label for this remix that describes the result, e.g. \"Simplified summary\", \"Spanish translation\", \"Polite comments\"."
    ),
  edits: z
    .array(
      z.object({
        action: z
          .enum(["replace", "append", "prepend", "before", "after", "remove"])
          .describe(
            "append/prepend = add your HTML as the last/first child of the target. after/before = insert it as a sibling just after/before the target. replace = overwrite the target's content. remove = delete the target."
          ),
        target: z
          .string()
          .describe("A content block number, or \"main\" for the whole content area."),
        html: z
          .string()
          .describe("Clean semantic HTML for this edit. Use an empty string for the remove action."),
      })
    )
    .describe("The minimal set of edits that satisfies the instruction."),
});

export class RemixTool extends BrowserTool<RemixInput> {
  readonly name = "remix";
  readonly description =
    "Edit the CURRENT page in place while keeping the site's own look and layout. Use it to add new content (e.g. a summary section or bullet points), tweak or rewrite a specific part (e.g. simplify one section, translate the comments), or transform the whole article (simplify, summarize, translate). It changes only what the instruction asks for and leaves the rest of the page exactly as it was. Use this when the user wants to change the page itself, not when they're just asking a question about it. Pass the requested change as the instruction.";
  readonly inputSchema = remixInputSchema;

  async execute(input: RemixInput, ctx: ToolContext): Promise<ToolResult> {
    const model = await readRemixModel(ctx.tab);

    if (!model) {
      return fail(
        "Couldn't remix",
        "Couldn't read this page's content to edit — take a fresh look."
      );
    }

    ctx.overlay?.startRemix();
    try {
      const plan = await ctx.llm.generate(
        buildSystemPrompt(),
        buildInPlacePrompt(input.instruction, model, ctx.tab.title, ctx.tab.url),
        remixPlanSchema
      );

      const ops = toOps(plan.edits ?? [], model.regions);
      if (ops.length === 0) {
        return fail(
          "Couldn't remix",
          "The model didn't return any edits to apply."
        );
      }

      const resolved = resolveRemixOps(ops);
      const result = await applyResolvedOps(ctx.tab, resolved);
      if (!result.ok) {
        return fail(
          "Couldn't remix",
          "The parts of the page to edit are no longer there — take a fresh look."
        );
      }

      const label = plan.title?.trim() || input.instruction;
      ctx.remixStore.add(ctx.tab.url, ctx.tab.title, label, resolved);

      return look(
        `Remixed ${ctx.tab.title || "page"}`,
        `${summarizeOps(ops)} per: ${input.instruction}`
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return fail("Couldn't remix", `The remix request failed: ${reason}`);
    } finally {
      ctx.overlay?.endRemix();
    }
  }
}

type RemixEdit = {
  action: RemixAction;
  target: string;
  html: string;
};

function toOps(edits: RemixEdit[], regions: ContentRegion[]): RemixOp[] {
  return edits.flatMap((edit): RemixOp[] => {
    const target = parseTarget(edit.target);
    if (!target) {
      return [];
    }
    if (target.kind === "region" && !regions.some((r) => r.id === target.id)) {
      return [];
    }
    if (edit.action === "remove") {
      return [{ action: "remove", target, html: "" }];
    }

    const html = sanitizeFragment(edit.html);
    if (!html) {
      return [];
    }
    return [{ action: edit.action, target, html }];
  });
}

function parseTarget(raw: string): RemixTarget | null {
  const value = raw.trim().toLowerCase();
  if (value === "main") {
    return { kind: "main" };
  }
  const id = Number(value.replace(/[^\d]/g, ""));
  return Number.isInteger(id) && id > 0 ? { kind: "region", id } : null;
}

function summarizeOps(ops: RemixOp[]): string {
  const onlyAdds = ops.every(
    (op) => op.action !== "replace" && op.action !== "remove"
  );
  const rewroteMain = ops.some(
    (op) => op.action === "replace" && op.target.kind === "main"
  );

  if (rewroteMain) {
    return "Rewrote the page";
  }
  if (onlyAdds) {
    return "Added to the page";
  }
  return "Edited the page";
}

function sanitizeFragment(html: string): string {
  const unwrapped = html.replace(/```html?/gi, "").replace(/```/g, "").trim();
  return sanitizeHtml(unwrapped, {
    allowedTags: ALLOWED_TAGS,
    // Allow class everywhere so reused content keeps the site's own styling.
    allowedAttributes: { "*": ["class"], a: ["href"], img: ["src", "alt"] },
    allowedSchemes: ["http", "https", "mailto"],
  });
}

function buildSystemPrompt(): string {
  return [
    "You are a page-remixing engine inside a web browser.",
    "You edit the page the user is viewing by returning a list of edits against its existing content. Your HTML is injected into the LIVE page and inherits the site's own fonts, colors, and layout.",
    "",
    "The main content is split into numbered blocks. Each edit targets a block by its number, or `main` for the whole content area, with an action:",
    "- append / prepend — add your HTML as the last / first child of the target",
    "- after / before — insert your HTML as a sibling right after / before the target block",
    "- replace — overwrite the target's content with your HTML",
    "- remove — delete the target block",
    "",
    "Rules — follow exactly:",
    "- Make the SMALLEST set of edits that satisfies the instruction. NEVER reproduce blocks you are not changing.",
    "- To CHANGE or REWRITE existing content (a paragraph, a section, a chunk), `replace` the block(s) that contain it — replace as many blocks as needed, and leave every other block untouched.",
    "- To ADD new content, use append/prepend/after/before with ONLY the new HTML. To add at the TOP, prepend to `main` (or insert before block 1).",
    "- Only target `main` when the user clearly wants the WHOLE content area transformed (e.g. \"simplify the entire article\", \"translate everything\").",
    "- MATCH THE SITE'S LOOK: each block is shown as its real markup. Reuse the SAME tags and the SAME class names you see there so your content inherits the site's existing styling and blends in. When replacing a block, mirror its structure and classes; when adding, copy the markup pattern of nearby blocks.",
    `- Use only these tags: ${ALLOWED_TAGS.join(", ")} (plus class attributes copied from the page).`,
    "- Do NOT add inline styles, colors, backgrounds, or fonts — rely on the page's own CSS via the classes you reuse.",
    "- No <html>, <head>, <body>, <script>, or <style> tags.",
    "- Stay faithful to the source — do not invent facts.",
    "- Also return a short 2–4 word `title` that names the result, so the user can recognize this remix later.",
  ].join("\n");
}

function buildInPlacePrompt(
  instruction: string,
  model: RemixModel,
  title: string,
  url: string
): string {
  const header = [
    `Instruction: ${instruction}`,
    `Page title: ${title || "(untitled)"}`,
    `Page URL: ${url}`,
    "",
  ];

  if (model.regions.length === 0) {
    return [
      ...header,
      "The page is a single content block. Target it with `main`.",
      "",
      "Its current markup (reuse these tags and class names):",
      model.mainHtml,
    ].join("\n");
  }

  const blocks = model.regions.map((region) =>
    [`[${region.id}]`, region.html || `<${region.tag}>${region.preview}…`].join("\n")
  );
  return [
    ...header,
    "The page's main content is made of these blocks, shown as their current markup. Target a block by its number, or use `main` for the whole content area:",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}

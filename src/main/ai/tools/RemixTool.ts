import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { BrowserTool, look, fail, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";
import { replaceDocument } from "../../page/actions";
import { readPageContent } from "../../page/observer";
import {
  applyRemixOps,
  readRemixModel,
  type ContentRegion,
  type PageTheme,
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
      return this.remixWholeDocument(input, ctx);
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

      const result = await applyRemixOps(ctx.tab, ops);
      if (!result.ok) {
        return fail(
          "Couldn't remix",
          "The parts of the page to edit are no longer there — take a fresh look."
        );
      }

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

  private async remixWholeDocument(
    input: RemixInput,
    ctx: ToolContext
  ): Promise<ToolResult> {
    const page = await readPageContent(ctx.tab, MAX_FALLBACK_CHARS);
    if (!page.text) {
      return fail("Couldn't remix", "The page had no readable text to rewrite.");
    }

    ctx.overlay?.startRemix();
    try {
      const fragment = await ctx.llm.generate(
        buildFallbackSystemPrompt(),
        buildFallbackPrompt(input.instruction, page.title, page.url, page.text)
      );

      await replaceDocument(ctx.tab, buildFallbackDocument(sanitizeFragment(fragment)));
      return look(
        `Remixed ${page.title || "page"}`,
        `Rewrote the page per: ${input.instruction}`
      );
    } finally {
      ctx.overlay?.endRemix();
    }
  }
}

const MAX_FALLBACK_CHARS = 16000;

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

function buildFallbackSystemPrompt(): string {
  return [
    "You are a page-remixing engine inside a web browser.",
    "You are given the text of the page the user is viewing and an instruction for how to transform it.",
    "Rewrite the main content to follow the instruction (e.g. simplify, summarize, translate).",
    "",
    "Output rules — follow exactly:",
    "- Output ONLY an HTML fragment. No <html>, <head>, <body>, <script>, or <style> tags.",
    `- Use only these tags: ${ALLOWED_TAGS.join(", ")}.`,
    "- Begin with a single <h1> containing a title for the remixed page.",
    "- Keep it faithful to the source — do not invent facts.",
    "- Do not wrap the output in markdown code fences.",
  ].join("\n");
}

function buildFallbackPrompt(
  instruction: string,
  title: string,
  url: string,
  text: string
): string {
  return [
    `Instruction: ${instruction}`,
    `Page title: ${title || "(untitled)"}`,
    `Page URL: ${url}`,
    "",
    "Page content:",
    text,
  ].join("\n");
}

function buildFallbackDocument(fragment: string): string {
  const theme: PageTheme = {
    background: "#faf9f7",
    foreground: "#1a1a1a",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: "18px",
    linkColor: "#6b4eff",
    isDark: false,
  };

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; background: ${theme.background}; }
      #blueberry-remix {
        max-width: 720px;
        margin: 0 auto;
        padding: 48px 24px 96px;
        font-family: ${theme.fontFamily};
        color: ${theme.foreground};
        line-height: 1.7;
        font-size: ${theme.fontSize};
      }
      #blueberry-remix h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 .5em; }
      #blueberry-remix h2 { font-size: 1.4rem; margin: 1.6em 0 .4em; }
      #blueberry-remix h3 { font-size: 1.15rem; margin: 1.4em 0 .3em; }
      #blueberry-remix p { margin: 0 0 1em; }
      #blueberry-remix ul, #blueberry-remix ol { margin: 0 0 1em; padding-left: 1.4em; }
      #blueberry-remix li { margin: .35em 0; }
      #blueberry-remix a { color: ${theme.linkColor}; }
      #blueberry-remix blockquote {
        margin: 1em 0; padding-left: 1em;
        border-left: 3px solid ${theme.linkColor}; color: #555;
      }
      .blueberry-remix-badge {
        display: inline-block; font-size: 13px; font-weight: 600;
        color: ${theme.linkColor}; letter-spacing: .04em;
        text-transform: uppercase; margin-bottom: 24px;
      }
    </style>
  </head>
  <body>
    <main id="blueberry-remix">
      <div class="blueberry-remix-badge">✨ Remixed</div>
      ${fragment}
    </main>
  </body>
</html>`;
}

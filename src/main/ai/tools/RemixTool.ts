import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { BrowserTool, look, fail, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";
import { applyRemix, replaceDocument, type RemixTarget } from "../../page/actions";
import { readRemixModel, readPageContent } from "../../page/observer";
import type { ContentRegion, PageTheme, RemixModel } from "../../page/types";

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "b", "i",
  "blockquote", "a", "code", "pre", "br", "hr", "span", "figure", "figcaption",
  "table", "thead", "tbody", "tr", "th", "td",
];

const remixInputSchema = z.object({
  instruction: z
    .string()
    .describe(
      "How to transform the page, e.g. \"simplify like I'm 12\", \"summarize the key points\", \"translate the article to Spanish\", \"rewrite just the comments politely\"."
    ),
});

type RemixInput = z.infer<typeof remixInputSchema>;

type RemixPlan = {
  target: RemixTarget;
  fragment: string;
};

export class RemixTool extends BrowserTool<RemixInput> {
  readonly name = "remix";
  readonly description =
    "Rewrite the CURRENT page in place — simplify, summarize, shorten, translate, or explain-like-I'm-5 — while keeping the site's own look and layout. It can rewrite the whole article or just one part (e.g. only the comments) and leaves everything it doesn't touch exactly as it was. Use this when the user wants to change how this page reads, not when they're just asking a question about it. Pass the requested transformation as the instruction.";
  readonly inputSchema = remixInputSchema;

  async execute(input: RemixInput, ctx: ToolContext): Promise<ToolResult> {
    const model = await readRemixModel(ctx.tab);

    if (!model) {
      return this.remixWholeDocument(input, ctx);
    }

    ctx.overlay?.startRemix();
    try {
      const raw = await ctx.llm.generate(
        buildSystemPrompt(),
        buildInPlacePrompt(input.instruction, model, ctx.tab.title, ctx.tab.url)
      );

      const plan = planFromResponse(raw, model.regions);
      const result = await applyRemix(ctx.tab, plan.target, plan.fragment);

      if (!result.ok) {
        return this.remixWholeDocument(input, ctx);
      }

      const where =
        plan.target.kind === "region" ? "part of the page" : "the page";
      return look(
        `Remixed ${ctx.tab.title || "page"}`,
        `Rewrote ${where} in place per: ${input.instruction}`
      );
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

function planFromResponse(raw: string, regions: ContentRegion[]): RemixPlan {
  const lines = raw.replace(/```html?/gi, "").replace(/```/g, "").split("\n");

  let target: RemixTarget = { kind: "main" };
  let bodyStart = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    const match = line.match(/^SCOPE:\s*(page|region)(?:\s+(\d+))?/i);
    if (match) {
      const id = match[2] ? Number(match[2]) : NaN;
      if (
        match[1].toLowerCase() === "region" &&
        regions.some((region) => region.id === id)
      ) {
        target = { kind: "region", id };
      }
      bodyStart = index + 1;
    }
    break;
  }

  const fragment = sanitizeFragment(lines.slice(bodyStart).join("\n"));
  return { target, fragment };
}

function sanitizeFragment(html: string): string {
  const unwrapped = html.replace(/```html?/gi, "").replace(/```/g, "").trim();
  return sanitizeHtml(unwrapped, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href"], img: ["src", "alt"] },
    allowedSchemes: ["http", "https", "mailto"],
  });
}

function buildSystemPrompt(): string {
  return [
    "You are a page-remixing engine inside a web browser.",
    "Your rewritten HTML is injected back into the live page, so it inherits the site's own fonts, colors, and layout.",
    "",
    "Output format — follow exactly:",
    "- The FIRST line must be a scope directive: either `SCOPE: page` to rewrite the whole main content, or `SCOPE: region <id>` to rewrite only one block.",
    "- Choose `region` when the instruction targets a specific part (e.g. just the comments, only the first section); otherwise choose `page`.",
    "- After the directive, output ONLY an HTML fragment — the new content for that scope.",
    "",
    "HTML rules — follow exactly:",
    `- Use only these tags: ${ALLOWED_TAGS.join(", ")}.`,
    "- Do NOT add inline styles, colors, backgrounds, fonts, or wrapper layout — the page already styles these tags. Output clean semantic HTML only.",
    "- Do not output <html>, <head>, <body>, <script>, or <style> tags, and do not wrap the output in markdown code fences.",
    "- Stay faithful to the source — transform it, but do not invent facts.",
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
      "The page has a single content block; use `SCOPE: page`.",
      "",
      "Main content:",
      model.mainText,
    ].join("\n");
  }

  const blocks = model.regions.map((region) =>
    [`[${region.id}] <${region.tag}>`, region.text || `${region.preview}…`].join("\n")
  );
  return [
    ...header,
    "The page's main content is made of these blocks (use a block id with `SCOPE: region <id>` to rewrite just one):",
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

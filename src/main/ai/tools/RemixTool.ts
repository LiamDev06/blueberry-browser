import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { BrowserTool, ok, type ToolResult } from "../BrowserTool";
import type { ToolContext } from "../ToolContext";
import { replaceDocument } from "../../page/actions";
import { readPageContent } from "../../page/observer";
import type { PageContent } from "../../page/types";
import remixTemplate from "./remix.template.html?raw";

const CONTENT_PLACEHOLDER = "{remix_content}";
const ALLOWED_TAGS = [
  "h1", "h2", "h3", "p", "ul", "ol", "li", "strong", "em", "blockquote", "a",
];
const MAX_PAGE_CHARS = 16000;

const remixInputSchema = z.object({
  instruction: z
    .string()
    .describe(
      "How to transform the page, e.g. \"simplify like I'm 12\", \"summarize the key points\", \"translate to Spanish\"."
    ),
});

type RemixInput = z.infer<typeof remixInputSchema>;

export class RemixTool extends BrowserTool<RemixInput> {
  readonly name = "remix";
  readonly description =
    "Rewrite the CURRENT page in place so it's easier to read — simplify, summarize, shorten, translate, or explain-like-I'm-5. Use this when the user wants to change how this page reads (not when they're just asking a question about it). Pass the requested transformation as the instruction.";
  readonly inputSchema = remixInputSchema;

  async execute(input: RemixInput, ctx: ToolContext): Promise<ToolResult> {
    const page = await readPageContent(ctx.tab, MAX_PAGE_CHARS);
    const fragment = await ctx.llm.generate(
      buildRemixSystemPrompt(),
      buildRemixPrompt(input.instruction, page)
    );
    await replaceDocument(ctx.tab, buildRemixDocument(fragment));

    return ok(
      `Remixed "${page.title || "page"}"`,
      `Rewrote the page in place per: ${input.instruction}`
    );
  }
}

function buildRemixSystemPrompt(): string {
  return [
    "You are a page-remixing engine inside a web browser.",
    "You are given the text of the web page the user is currently viewing and an instruction for how to transform it.",
    "Rewrite the page's main content to follow the instruction (e.g. simplify, summarize, translate).",
    "",
    "Output rules — follow exactly:",
    "- Output ONLY an HTML fragment. No <html>, <head>, <body>, <script>, or <style> tags.",
    `- Use only these tags: ${ALLOWED_TAGS.join(", ")}.`,
    "- Begin with a single <h1> containing a title for the remixed page.",
    "- Keep it faithful to the source — do not invent facts.",
    "- Do not wrap the output in markdown code fences.",
  ].join("\n");
}

function buildRemixPrompt(instruction: string, page: PageContent): string {
  return [
    `Instruction: ${instruction}`,
    `Page title: ${page.title || "(untitled)"}`,
    `Page URL: ${page.url}`,
    "",
    "Page content:",
    page.text,
  ].join("\n");
}

function buildRemixDocument(fragmentHtml: string): string {
  return remixTemplate.replace(CONTENT_PLACEHOLDER, () => sanitizeFragment(fragmentHtml));
}

function sanitizeFragment(html: string): string {
  // in case the model wraps its output in ```html
  function unwrapCodeFences(html: string): string {
    return html.replace(/```html?/gi, "").replace(/```/g, "").trim();
  }

  return sanitizeHtml(unwrapCodeFences(html), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
  });
}

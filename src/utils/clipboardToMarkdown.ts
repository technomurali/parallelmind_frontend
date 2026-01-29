import DOMPurify from "dompurify";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const turndownService = new TurndownService({
  codeBlockStyle: "fenced",
  emDelimiter: "_",
  strongDelimiter: "**",
});

turndownService.use(gfm);

turndownService.addRule("fencedCodeBlock", {
  filter: (node: Node) => {
    if (node.nodeName !== "PRE") return false;
    const first = node.firstChild as HTMLElement | null;
    return !!first && first.nodeName === "CODE";
  },
  replacement: (_content: string, node: Node) => {
    const codeElement = (node.firstChild as HTMLElement) ?? null;
    const rawCode = codeElement?.textContent ?? "";
    const className = codeElement?.getAttribute("class") ?? "";
    const dataLang = codeElement?.getAttribute("data-language") ?? "";
    const match =
      className.match(/language-([a-z0-9_-]+)/i) ??
      className.match(/lang-([a-z0-9_-]+)/i);
    const lang = dataLang || match?.[1] || "";
    return `\n\n\`\`\`${lang}\n${rawCode}\n\`\`\`\n\n`;
  },
});

const normalizeMarkdown = (value: string): string => {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
};

export const htmlToMarkdownPreserveSpacing = (html: string): string => {
  const clean = sanitizeHtml(html);
  return turndownService.turndown(clean);
};

export const htmlToMarkdown = (html: string): string => {
  const clean = sanitizeHtml(html);
  const markdown = turndownService.turndown(clean);
  return normalizeMarkdown(markdown);
};

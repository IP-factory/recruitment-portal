/**
 * Task 24G (15A) — rich role description parsing.
 *
 * Long role descriptions support lightweight Markdown-style formatting
 * (headings, bold, italic, bullet/numbered lists, links) without ever
 * involving raw HTML. This module parses a description into a typed AST; the
 * renderer (`components/foundation/RichDescription.tsx`) maps the AST to
 * React elements, so no markup is ever injected as HTML.
 *
 * Backward compatible: plain-text descriptions without any syntax parse into
 * ordinary paragraph blocks and render exactly as before.
 */

export type RichInline =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: RichInline[] }
  | { kind: "italic"; children: RichInline[] }
  | { kind: "link"; href: string; children: RichInline[] };

export type RichBlock =
  | { kind: "heading"; level: 1 | 2 | 3; children: RichInline[] }
  | { kind: "paragraph"; children: RichInline[] }
  | { kind: "bulletList"; items: RichInline[][] }
  | { kind: "numberedList"; items: RichInline[][] };

/** Only safe link targets are preserved; anything else renders as text. */
function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed) && !trimmed.includes("<") && !trimmed.includes(">");
}

/**
 * Parse inline formatting: `**bold**`, `*italic*`, `[label](https://...)`.
 * Unbalanced or malformed markers are emitted as literal text so an author
 * can never break the rendering.
 */
export function parseRichInlines(source: string): RichInline[] {
  const output: RichInline[] = [];
  let textBuffer = "";
  const flushText = () => {
    if (textBuffer) output.push({ kind: "text", text: textBuffer });
    textBuffer = "";
  };

  let index = 0;
  while (index < source.length) {
    const character = source[index];

    // Bold: **...**
    if (character === "*" && source[index + 1] === "*") {
      const closing = source.indexOf("**", index + 2);
      if (closing > index + 2) {
        flushText();
        output.push({ kind: "bold", children: parseRichInlines(source.slice(index + 2, closing)) });
        index = closing + 2;
        continue;
      }
    }

    // Italic: *...*
    if (character === "*") {
      const closing = source.indexOf("*", index + 1);
      if (closing > index + 1 && source[closing - 1] !== "*" && source[closing + 1] !== "*") {
        flushText();
        output.push({ kind: "italic", children: parseRichInlines(source.slice(index + 1, closing)) });
        index = closing + 1;
        continue;
      }
    }

    // Link: [label](href)
    if (character === "[") {
      const labelEnd = source.indexOf("]", index + 1);
      if (labelEnd > index && source[labelEnd + 1] === "(") {
        const hrefEnd = source.indexOf(")", labelEnd + 2);
        if (hrefEnd > labelEnd + 2) {
          const label = source.slice(index + 1, labelEnd).trim();
          const href = source.slice(labelEnd + 2, hrefEnd).trim();
          if (label && isSafeHref(href)) {
            flushText();
            output.push({ kind: "link", href, children: parseRichInlines(label) });
            index = hrefEnd + 1;
            continue;
          }
        }
      }
    }

    textBuffer += character;
    index += 1;
  }
  flushText();
  return output;
}

const HEADING_PATTERN = /^(#{1,3})\s+(.+)$/;
const BULLET_PATTERN = /^[-*]\s+(.+)$/;
const NUMBERED_PATTERN = /^\d+[.)]\s+(.+)$/;

/**
 * Parse a full description into blocks. Blank lines separate blocks; list items
 * on consecutive lines merge into a single list block.
 */
export function parseRichDescription(source: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  const lines = (source ?? "").replace(/\r\n/g, "\n").split("\n");

  let paragraphLines: string[] = [];
  let listKind: "bulletList" | "numberedList" | null = null;
  let listItems: RichInline[][] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push({ kind: "paragraph", children: parseRichInlines(paragraphLines.join(" ").trim()) });
    paragraphLines = [];
  };
  const flushList = () => {
    if (!listKind || !listItems.length) return;
    blocks.push({ kind: listKind, items: listItems });
    listKind = null;
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = trimmed.match(HEADING_PATTERN);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", level: Math.min(heading[1].length, 3) as 1 | 2 | 3, children: parseRichInlines(heading[2].trim()) });
      continue;
    }

    const bullet = trimmed.match(BULLET_PATTERN);
    const numbered = bullet ? null : trimmed.match(NUMBERED_PATTERN);
    if (bullet || numbered) {
      flushParagraph();
      const detected = bullet ? "bulletList" : "numberedList";
      if (listKind && listKind !== detected) flushList();
      listKind = detected;
      listItems.push(parseRichInlines((bullet ?? numbered)![1].trim()));
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }
  flushParagraph();
  flushList();
  return blocks;
}

/**
 * True when the source contains at least one recognized formatting marker —
 * used to decide whether long descriptions render expanded by default.
 */
export function isRichlyFormatted(source: string): boolean {
  return parseRichDescription(source).some(
    (block) => block.kind !== "paragraph" || block.children.some((inline) => inline.kind !== "text"),
  );
}

/**
 * Task 24G (15A) — rich description parser tests.
 *
 * The parser turns admin-authored Markdown-lite text into a typed AST that the
 * applicant UI renders as React elements. It must stay backward compatible
 * with plain text and never produce unsafe link targets.
 */
import { describe, expect, it } from "vitest";
import { isRichlyFormatted, parseRichDescription, parseRichInlines } from "./richDescription";

describe("parseRichInlines", () => {
  it("parses bold and italic markers", () => {
    const inlines = parseRichInlines("Join a **bold** and *driven* team.");
    expect(inlines).toEqual([
      { kind: "text", text: "Join a " },
      { kind: "bold", children: [{ kind: "text", text: "bold" }] },
      { kind: "text", text: " and " },
      { kind: "italic", children: [{ kind: "text", text: "driven" }] },
      { kind: "text", text: " team." },
    ]);
  });

  it("parses safe links", () => {
    const inlines = parseRichInlines("See [our site](https://example.com) for details.");
    const link = inlines.find((inline) => inline.kind === "link");
    expect(link).toBeDefined();
    if (link && link.kind === "link") {
      expect(link.href).toBe("https://example.com");
      expect(link.children).toEqual([{ kind: "text", text: "our site" }]);
    }
  });

  it("drops unsafe link targets and keeps the label as plain text", () => {
    const inlines = parseRichInlines("Click [trap](javascript:alert(1)) here.");
    expect(inlines.some((inline) => inline.kind === "link")).toBe(false);
    expect(inlines.map((inline) => ("text" in inline ? inline.text : "")).join("")).toContain("trap");
  });
});

describe("parseRichDescription", () => {
  it("renders plain text unchanged as paragraphs (backward compatible)", () => {
    const blocks = parseRichDescription("A simple line.\nAnother simple line.");
    expect(blocks).toHaveLength(1);
    const block = blocks[0];
    expect(block.kind).toBe("paragraph");
    if (block.kind === "paragraph") {
      expect(block.children.map((inline) => ("text" in inline ? inline.text : ""))).toEqual(["A simple line. Another simple line."]);
    }
  });

  it("parses headings at levels 1 to 3", () => {
    const blocks = parseRichDescription("# One\n## Two\n### Three");
    expect(blocks).toEqual([
      { kind: "heading", level: 1, children: [{ kind: "text", text: "One" }] },
      { kind: "heading", level: 2, children: [{ kind: "text", text: "Two" }] },
      { kind: "heading", level: 3, children: [{ kind: "text", text: "Three" }] },
    ]);
  });

  it("groups consecutive bullet lines into one list", () => {
    const blocks = parseRichDescription("- First\n- Second\n* Third");
    expect(blocks).toHaveLength(1);
    const block = blocks[0];
    expect(block.kind).toBe("bulletList");
    if (block.kind === "bulletList") {
      expect(block.items).toHaveLength(3);
    }
  });

  it("groups consecutive numbered lines into one list", () => {
    const blocks = parseRichDescription("1. First\n2. Second");
    expect(blocks).toHaveLength(1);
    const block = blocks[0];
    expect(block.kind).toBe("numberedList");
    if (block.kind === "numberedList") {
      expect(block.items).toHaveLength(2);
    }
  });

  it("separates paragraphs around blank lines", () => {
    const blocks = parseRichDescription("First paragraph.\n\nSecond paragraph.");
    expect(blocks).toHaveLength(2);
    expect(blocks.every((block) => block.kind === "paragraph")).toBe(true);
  });

  it("supports inline formatting inside headings and list items", () => {
    const blocks = parseRichDescription("## The **team**\n- *Remote* friendly");
    const heading = blocks[0];
    expect(heading.kind).toBe("heading");
    const list = blocks[1];
    expect(list.kind).toBe("bulletList");
    if (list.kind === "bulletList") {
      expect(list.items[0].some((inline) => inline.kind === "italic")).toBe(true);
    }
  });

  it("never emits raw markup tokens in text nodes", () => {
    const blocks = parseRichDescription("## Heading\n**bold** and *italic* and [link](https://example.com)");
    const collect = (value: unknown): string => {
      if (Array.isArray(value)) return value.map(collect).join("");
      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (typeof record.text === "string") return record.text;
        return collect(record.children ?? record.items ?? []);
      }
      return "";
    };
    const text = collect(blocks);
    expect(text).not.toContain("**");
    expect(text).not.toContain("##");
    expect(text).not.toContain("](");
  });
});

describe("isRichlyFormatted", () => {
  it("detects formatting markers", () => {
    expect(isRichlyFormatted("## Responsibilities")).toBe(true);
    expect(isRichlyFormatted("- Bullet point")).toBe(true);
    expect(isRichlyFormatted("**Bold** start")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(isRichlyFormatted("Just a plain description of the role.")).toBe(false);
    expect(isRichlyFormatted("")).toBe(false);
  });
});

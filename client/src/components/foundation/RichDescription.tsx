/**
 * Task 24G (15A) — controlled rich description renderer.
 *
 * Maps the parsed description AST (`lib/richDescription.ts`) to React
 * elements. Everything renders as ordinary React text nodes and elements, so
 * no raw markup or Markdown symbols can leak into the applicant UI and
 * plain-text descriptions render exactly as before.
 */
import { parseRichDescription, type RichBlock, type RichInline } from "@/lib/richDescription";
import type { ReactNode } from "react";

function renderInlines(inlines: RichInline[], keyPrefix: string): ReactNode[] {
  return inlines.map((inline, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (inline.kind) {
      case "bold":
        return <strong className="font-semibold" key={key}>{renderInlines(inline.children, key)}</strong>;
      case "italic":
        return <em key={key}>{renderInlines(inline.children, key)}</em>;
      case "link":
        return <a className="font-medium text-portal-blue underline-offset-2 hover:underline" href={inline.href} key={key} rel="noopener noreferrer" target="_blank">{renderInlines(inline.children, key)}</a>;
      default:
        return <span key={key}>{inline.text}</span>;
    }
  });
}

function renderBlock(block: RichBlock, index: number): ReactNode {
  const key = `block-${index}`;
  switch (block.kind) {
    case "heading":
      if (block.level === 1) return <h3 className="mt-7 text-lg font-semibold tracking-[-0.02em] text-primary first:mt-0" key={key}>{renderInlines(block.children, key)}</h3>;
      if (block.level === 2) return <h4 className="mt-6 text-base font-semibold tracking-[-0.015em] text-primary first:mt-0" key={key}>{renderInlines(block.children, key)}</h4>;
      return <h5 className="mt-5 text-sm font-semibold text-primary first:mt-0" key={key}>{renderInlines(block.children, key)}</h5>;
    case "bulletList":
      return <ul className="mt-4 space-y-2 first:mt-0" key={key}>{block.items.map((item, itemIndex) => <li className="flex gap-2.5 text-[14px] leading-6 text-foreground" key={`${key}-${itemIndex}`}><span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-portal-blue" />{renderInlines(item, `${key}-${itemIndex}`)}</li>)}</ul>;
    case "numberedList":
      return <ol className="mt-4 space-y-2 first:mt-0" key={key}>{block.items.map((item, itemIndex) => <li className="flex gap-2.5 text-[14px] leading-6 text-foreground" key={`${key}-${itemIndex}`}><span className="mt-px shrink-0 text-[13px] font-semibold text-portal-blue">{itemIndex + 1}.</span>{renderInlines(item, `${key}-${itemIndex}`)}</li>)}</ol>;
    default:
      return <p className="mt-4 text-[14px] leading-6 text-foreground first:mt-0" key={key}>{renderInlines(block.children, key)}</p>;
  }
}

/** Render a rich description from its stored plain-text/Markdown-lite source. */
export function RichDescription({ source, className }: { source: string; className?: string }) {
  const trimmed = source?.trim() ?? "";
  if (!trimmed) return null;
  const blocks = parseRichDescription(trimmed);
  return <div className={className}>{blocks.map(renderBlock)}</div>;
}

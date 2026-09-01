/**
 * Task 24G (15A) — rich role description editor for Admins.
 *
 * Admins format the long role description with a toolbar instead of writing
 * markup by hand. The stored value stays plain text (Markdown-lite: headings,
 * bold, italic, bullets, numbered lists, links) which the applicant UI renders
 * through the controlled `RichDescription` renderer — raw markup never leaks
 * to applicants and the value remains backward compatible with plain text.
 */
import { RichDescription } from "@/components/foundation/RichDescription";
import { Bold, Heading2, Italic, Link2, List, ListOrdered } from "lucide-react";
import { useRef, useState } from "react";

interface RichDescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function RichDescriptionEditor({ value, onChange }: RichDescriptionEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");

  const focusEditor = () => requestAnimationFrame(() => textareaRef.current?.focus());

  const applyInlineWrap = (marker: string, placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    const selected = value.slice(selectionStart, selectionEnd) || placeholder;
    onChange(value.slice(0, selectionStart) + marker + selected + marker + value.slice(selectionEnd));
    focusEditor();
  };

  const applyLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart } = textarea;
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    focusEditor();
  };

  const applyListPrefixes = (makePrefix: (index: number) => string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    const blockStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    let blockEnd = value.indexOf("\n", selectionEnd);
    if (blockEnd === -1) blockEnd = value.length;
    const lines = value.slice(blockStart, blockEnd).split("\n");
    const prefixed = lines.map((line, index) => `${makePrefix(index)}${line.replace(/^(\s*)(?:[-*]\s+|\d+[.)]\s+)/, "$1")}`).join("\n");
    onChange(value.slice(0, blockStart) + prefixed + value.slice(blockEnd));
    focusEditor();
  };

  const applyLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    const selected = value.slice(selectionStart, selectionEnd) || "Link label";
    onChange(`${value.slice(0, selectionStart)}[${selected}](https://)${value.slice(selectionEnd)}`);
    focusEditor();
  };

  const toolbarButtons = [
    { icon: Heading2, label: "Heading", onClick: () => applyLinePrefix("## ") },
    { icon: Bold, label: "Bold", onClick: () => applyInlineWrap("**", "bold text") },
    { icon: Italic, label: "Italic", onClick: () => applyInlineWrap("*", "italic text") },
    { icon: List, label: "Bulleted list", onClick: () => applyListPrefixes(() => "- ") },
    { icon: ListOrdered, label: "Numbered list", onClick: () => applyListPrefixes((index) => `${index + 1}. `) },
    { icon: Link2, label: "Link", onClick: applyLink },
  ];

  return <div className="overflow-hidden rounded-lg border border-border bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-portal-surface px-3 py-2">
      <div className="flex items-center gap-1">
        {toolbarButtons.map((button) => <button aria-label={button.label} className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white hover:text-primary disabled:opacity-40" disabled={mode === "preview"} key={button.label} onClick={button.onClick} title={button.label} type="button"><button.icon className="size-4" /></button>)}
      </div>
      <div className="flex items-center gap-1 rounded-md border border-border bg-white p-0.5">
        {(["write", "preview"] as const).map((option) => <button className={`rounded px-3 py-1 text-[12px] font-semibold transition-colors ${mode === option ? "bg-primary text-white" : "text-muted-foreground hover:text-primary"}`} key={option} onClick={() => setMode(option)} type="button">{option === "write" ? "Write" : "Preview"}</button>)}
      </div>
    </div>
    {mode === "write" ? (
      <textarea
        className="min-h-[220px] w-full resize-y bg-white px-3.5 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:outline-none"
        onChange={(event) => onChange(event.target.value)}
        placeholder={"Describe the role in detail.\n\nUse the toolbar above for headings, bold, italic, lists and links — no HTML is needed."}
        ref={textareaRef}
        value={value}
      />
    ) : (
      <div className="min-h-[220px] px-4 py-3.5">
        {value.trim() ? <RichDescription source={value} /> : <p className="text-[14px] text-muted-foreground">Nothing to preview yet. Switch to Write and add the role description.</p>}
      </div>
    )}
  </div>;
}

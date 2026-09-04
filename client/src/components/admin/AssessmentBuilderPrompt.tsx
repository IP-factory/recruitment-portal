/**
 * AI Assessment Builder guidance section.
 *
 * Renders beside the "Download CSV Template" / "Import Questions from CSV"
 * actions on any assessment CSV setup surface. Contains:
 *   - Short explanatory copy
 *   - "Copy AI Prompt" button with clipboard logic, copied state and error feedback
 *   - Subtle helper text noting which AI assistants are supported
 *
 * The actual prompt text lives in lib/assessmentBuilderPrompt.ts — do not
 * duplicate it here or in the pages that consume this component.
 */
import { XCEPTIONAL_ASSESSMENT_BUILDER_PROMPT } from "@/lib/assessmentBuilderPrompt";
import { FoundationButton } from "@/components/foundation/ui";
import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";

type CopyState = "idle" | "copied" | "error";

/**
 * "Copy AI Prompt" button.
 *
 * Copies XCEPTIONAL_ASSESSMENT_BUILDER_PROMPT to the clipboard.
 * - Idle:   "Copy AI Prompt"   (ClipboardCopy icon)
 * - Copied: "Copied"           (Check icon, green tint) — resets after 2 s
 * - Error:  shows inline error message, button returns to idle
 *
 * The button is keyboard-accessible (inherits FoundationButton focus ring)
 * and the copied state is communicated both visually and via aria-label.
 */
export function CopyAIPromptButton() {
  const [state, setState] = useState<CopyState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCopy = async () => {
    setErrorMsg(null);
    try {
      await navigator.clipboard.writeText(XCEPTIONAL_ASSESSMENT_BUILDER_PROMPT);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setErrorMsg("Unable to copy to clipboard. Please copy the prompt manually.");
      setState("error");
      // Return to idle after showing the error so the user can retry.
      setTimeout(() => setState("idle"), 4000);
    }
  };

  const isCopied = state === "copied";

  return (
    <div>
      <FoundationButton
        aria-label={isCopied ? "Assessment Builder Prompt copied to clipboard" : "Copy the Xceptional Assessment Builder Prompt to clipboard"}
        className={isCopied ? "border-[#2d7a4f] bg-[#e9f6ee] text-[#2d7a4f] hover:border-[#2d7a4f] hover:bg-[#e9f6ee]" : ""}
        onClick={() => { void handleCopy(); }}
        variant="secondary"
      >
        {isCopied ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <ClipboardCopy aria-hidden="true" className="size-4" />
        )}
        {isCopied ? "Copied" : "Copy AI Prompt"}
      </FoundationButton>
      {state === "error" && errorMsg && (
        <p className="mt-2 text-[13px] font-medium text-status-error-strong" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  );
}

/**
 * Full "Need help building your assessment?" guidance section.
 *
 * Drop this component directly below the Download CSV Template button/section
 * and above the Import Questions from CSV action. It is self-contained and
 * requires no props.
 */
export function AssessmentBuilderGuidance() {
  return (
    <div className="rounded-lg border border-[#d9e5f0] bg-[#f3f8fc] px-4 py-4">
      <p className="text-[13px] font-semibold text-primary">Need help building your assessment?</p>
      <p className="mt-1 max-w-prose text-[13px] leading-6 text-muted-foreground">
        Download the template and provide it, the role Job Description and your draft questions to
        your preferred AI assistant using the Xceptional Assessment Builder Prompt.
      </p>
      <div className="mt-3">
        <CopyAIPromptButton />
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">
        Works with ChatGPT, Claude and other AI assistants that support file uploads.
      </p>
    </div>
  );
}

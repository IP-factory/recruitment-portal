/**
 * Quiet Authority Add Question placeholder: preserves the protected Question Bank workflow boundary until question creation is explicitly scoped.
 */
import { AdminShell } from "@/components/admin/AdminShell";
import { FoundationButton } from "@/components/foundation/ui";
import { useLocation } from "wouter";

export default function AdminQuestionNewPlaceholder() {
  const [, setLocation] = useLocation();
  return <AdminShell title="Question Bank"><section><p className="text-[12px] font-medium text-muted-foreground">Question Bank</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-primary">Add question</h2><article className="mt-5 max-w-2xl rounded-xl border border-border bg-white p-5 shadow-none sm:p-6"><p className="text-sm leading-6 text-muted-foreground">Question creation and scoring configuration will be added in the next stage.</p><FoundationButton className="mt-6" onClick={() => setLocation("/admin/questions")} variant="secondary">Back to Question Bank</FoundationButton></article></section></AdminShell>;
}

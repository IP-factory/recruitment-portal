/**
 * Quiet Authority admin placeholder: clean protected sections that establish navigation without pre-empting future management functionality.
 */
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminPlaceholder({ title }: { title: string }) {
  return <AdminShell title={title}><section className="max-w-[720px]"><p className="text-[12px] font-medium text-muted-foreground">Administration</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-primary">{title}</h2><div className="mt-6 rounded-xl border border-border bg-white p-6"><p className="text-[15px] text-muted-foreground">This section will be built in a later stage.</p></div></section></AdminShell>;
}

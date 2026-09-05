import { AdminShell } from "@/components/admin/AdminShell";
import { adminHelpSections } from "@/lib/adminHelp";
import { ArrowRight, BookOpen } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";

export default function AdminHelp() {
  const [, params] = useRoute("/admin/help/:section");
  const requestedSection = params?.section ?? "getting-started";
  const section = adminHelpSections.find((item) => item.id === requestedSection);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [requestedSection]);

  return <AdminShell title="Help">
    <section>
      <p className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground"><BookOpen className="size-4" aria-hidden="true" />Admin manual</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-primary">Help & guidance</h2>
      <p className="mt-2 max-w-3xl text-[15px] leading-6 text-muted-foreground">Learn how to configure recruitment, review applications and make informed screening decisions.</p>
    </section>
    <div className="mt-7 grid items-start gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-border bg-white p-4 xl:sticky xl:top-6">
        <h3 className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">In this manual</h3>
        <nav aria-label="Help sections" className="mt-3 grid gap-1 sm:grid-cols-2 xl:grid-cols-1">
          {adminHelpSections.map((item) => <Link key={item.id} href={`/admin/help/${item.id}`} aria-current={section?.id === item.id ? "page" : undefined} className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${section?.id === item.id ? "bg-portal-blue-soft text-primary" : "text-muted-foreground hover:bg-portal-surface hover:text-primary"}`}>{item.title}</Link>)}
        </nav>
      </aside>
      <article aria-labelledby="help-section-title" className="min-w-0 rounded-xl border border-border bg-white p-5 sm:p-7">
        <h3 id="help-section-title" ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-[-0.025em] text-primary focus:outline-none">{section?.title ?? "Help section not found"}</h3>
        {section ? <>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{section.introduction}</p>
          {section.href && <Link href={section.href} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-portal-blue hover:underline">Open {section.href === "/admin/settings" ? "Settings" : section.title}<ArrowRight className="size-4" aria-hidden="true" /></Link>}
          {section.steps && <section className="mt-6 rounded-lg border border-border bg-portal-surface p-5"><h4 className="text-sm font-semibold text-primary">Step by step</h4><ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6 text-foreground">{section.steps.map((step) => <li key={step} className="pl-1">{step}</li>)}</ol></section>}
          <div className="mt-6 divide-y divide-border">{section.topics.map((topic) => <section key={topic.title} className="py-5 first:pt-0 last:pb-0"><h4 className="text-base font-semibold text-primary">{topic.title}</h4><p className="mt-2 text-sm leading-7 text-muted-foreground">{topic.text}</p></section>)}</div>
        </> : <p className="mt-3 text-sm leading-7 text-muted-foreground">Choose a section from the help navigation to continue.</p>}
      </article>
    </div>
  </AdminShell>;
}

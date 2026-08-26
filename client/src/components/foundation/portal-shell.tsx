/**
 * Quiet Authority internal portal shell: a light, operational frame ready for future applicant and admin content.
 */
import { Bell, BriefcaseBusiness, ChevronDown, LayoutDashboard, Settings } from "lucide-react";
import { toast } from "sonner";
import { AlignmentMark } from "./navigation";

const processAccent = "/manus-storage/recruitment-portal-process-accent_d92d6697.png";

export function PortalShell() {
  const links = [
    { label: "Dashboard", icon: LayoutDashboard, active: true },
    { label: "Applications", icon: BriefcaseBusiness, active: false },
    { label: "Settings", icon: Settings, active: false },
  ];
  const placeholder = (item: string) => toast.info(`${item} is not available in this foundation preview.`);

  return (
    <div className="min-h-screen bg-portal-surface lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-white lg:flex">
        <div className="flex h-[72px] items-center border-b border-border px-6">
          <a className="flex items-center gap-2.5 text-primary" href="/ui-kit"><AlignmentMark /><span className="text-[15px] font-semibold tracking-[-0.02em]">Recruitment Portal</span></a>
        </div>
        <nav className="flex-1 px-3 py-5" aria-label="Internal portal navigation">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Workspace</p>
          <div className="space-y-1">
            {links.map(({ label, icon: Icon, active }) => <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-portal-blue-soft text-primary" : "text-muted-foreground hover:bg-portal-surface hover:text-foreground"}`} key={label} onClick={() => placeholder(label)} type="button"><Icon className="size-4" />{label}</button>)}
          </div>
        </nav>
        <button className="m-3 flex items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-portal-surface" onClick={() => placeholder("Profile settings")} type="button">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">RP</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">Portal User</span><span className="block truncate text-xs text-muted-foreground">user@company.com</span></span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-[72px] items-center justify-between border-b border-border bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3 lg:hidden"><AlignmentMark /><span className="text-[15px] font-semibold text-primary">Recruitment Portal</span></div>
          <p className="hidden text-sm font-medium text-muted-foreground lg:block">Portal workspace</p>
          <button aria-label="Notifications" className="rounded-lg p-2 text-muted-foreground hover:bg-portal-surface hover:text-primary" onClick={() => placeholder("Notifications")} type="button"><Bell className="size-5" /></button>
        </header>
        <main className="relative min-h-[calc(100vh-72px)] overflow-hidden p-5 sm:p-8 lg:p-10">
          <img alt="" className="pointer-events-none absolute -right-8 bottom-0 hidden w-[520px] opacity-25 lg:block" src={processAccent} />
          <section className="relative mx-auto max-w-5xl border-y border-border py-8 sm:py-11">
            <div className="grid gap-8 lg:grid-cols-[150px_minmax(0,1fr)] lg:gap-10">
              <aside className="hidden border-r border-border pr-6 lg:block"><span className="section-kicker">01 / Portal shell</span><div className="mt-6 flex items-center gap-3 text-primary"><AlignmentMark /><span className="h-px flex-1 bg-border" /></div></aside>
              <div className="min-w-0">
                <span className="section-kicker lg:hidden">01 / Portal shell</span>
                <div className="border-l-2 border-primary pl-5 sm:pl-6">
                  <h1 className="text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[38px]">Portal Page</h1>
                  <p className="mt-3 max-w-lg text-[15px] leading-7 text-muted-foreground">Future portal content will appear here.</p>
                </div>
                <div className="mt-10 h-px w-full bg-border" />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

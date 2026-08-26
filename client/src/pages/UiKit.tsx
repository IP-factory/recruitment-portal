/**
 * Quiet Authority UI kit: an asymmetrical dossier-style review page for reusable recruitment portal components.
 */
import { PublicFooter, PublicNavigation } from "@/components/foundation/navigation";
import {
  AlertPanel,
  CandidateTable,
  ConfirmationModal,
  EmptyState,
  FieldFrame,
  FileUploadBox,
  FoundationButton,
  FoundationInput,
  FoundationSelect,
  FoundationTextarea,
  LoadingStates,
  ProgressStepper,
  SearchField,
  SpecimenCard,
  StatusBadge,
} from "@/components/foundation/ui";
import { Check, ChevronRight, ExternalLink, Inbox, Radio, SquareCheckBig } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const gridAccent = "/manus-storage/recruitment-portal-grid-accent_5a3dbf2c.png";
const processAccent = "/manus-storage/recruitment-portal-process-accent_d92d6697.png";

function SectionHeader({ index, title, description }: { index: string; title: string; description: string }) {
  return (
    <div className="mb-6 flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="section-kicker">{index}</span>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-primary sm:text-[30px]">{title}</h2>
      </div>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function ColourSwatch({ label, value, style }: { label: string; value: string; style: string }) {
  return <div className="min-w-[145px] flex-1"><div className={`h-16 rounded-lg border border-border ${style}`} /><p className="mt-3 text-sm font-medium text-foreground">{label}</p><p className="mt-0.5 text-[13px] text-muted-foreground">{value}</p></div>;
}

export default function UiKit() {
  const [modalOpen, setModalOpen] = useState(false);
  const notify = (label: string) => toast.info(`${label} is a visual placeholder for a future workflow.`);

  return (
    <div className="min-h-screen bg-white text-foreground">
      <PublicNavigation />
      <main>
        <section className="relative overflow-hidden border-b border-border bg-portal-surface">
          <img alt="" className="pointer-events-none absolute bottom-0 right-0 hidden h-full w-auto max-w-[58%] object-cover opacity-65 lg:block" src={gridAccent} />
          <div className="portal-container relative grid min-h-[260px] items-end gap-8 py-12 sm:py-14 lg:grid-cols-[145px_minmax(0,1fr)] lg:py-16">
            <aside className="hidden self-stretch border-r border-border pr-6 lg:block"><span className="section-kicker">Design reference</span></aside>
            <div className="max-w-3xl">
              <span className="section-kicker">Recruitment Portal / v0.1</span>
              <h1 className="mt-3 text-[38px] font-semibold leading-[1.08] tracking-[-0.045em] text-primary sm:text-[42px]">Platform Foundation</h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">A reusable visual system for a structured recruitment application and assessment platform. This review page contains presentation-only component examples; no applicant or platform functionality is included.</p>
              <div className="mt-7 flex flex-wrap gap-3"><FoundationButton onClick={() => notify("Start Application")}>Start Application <ChevronRight className="size-4" /></FoundationButton><FoundationButton onClick={() => notify("Component reference")} variant="secondary">Component reference</FoundationButton><a className="inline-flex items-center gap-1.5 self-center text-sm font-medium text-portal-blue hover:text-primary hover:underline" href="/portal">View portal shell <ExternalLink className="size-3.5" /></a></div>
            </div>
          </div>
        </section>

        <div className="portal-container grid gap-10 py-10 sm:py-14 lg:grid-cols-[145px_minmax(0,1fr)] lg:gap-10">
          <aside className="hidden lg:block"><div className="sticky top-8 border-r border-border pr-6"><p className="section-kicker">Index</p><nav className="mt-4 space-y-2 text-[13px] leading-5 text-muted-foreground" aria-label="UI kit sections">{["Typography", "Colours", "Buttons", "Fields", "Cards", "Status", "Stepper", "Table", "Feedback", "States"].map((item, index) => <a className="block transition-colors hover:text-primary" href={`#${item.toLowerCase()}`} key={item}>0{index + 1} / {item}</a>)}</nav></div></aside>

          <div className="min-w-0 space-y-14 sm:space-y-16">
            <section id="typography"><SectionHeader description="Inter is applied as the restrained interface typeface. Headings use modest semibold weight and compact tracking." index="01 / Foundation" title="Typography" /><div className="space-y-7 rounded-xl border border-border bg-white p-6 sm:p-8"><div><span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">H1 / 42px</span><p className="mt-2 text-[36px] font-semibold tracking-[-0.045em] text-primary sm:text-[42px]">Clarity at every stage.</p></div><div><span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">H2 / 32px</span><p className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-primary">Review a stronger candidate picture.</p></div><div className="grid gap-5 border-t border-border pt-6 sm:grid-cols-2"><div><p className="text-lg font-semibold text-primary">H4 / 18px</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Body text is designed for long-form reading and clear supporting explanation without visual heaviness.</p></div><div><p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Caption / 13px</p><p className="mt-2 text-sm text-foreground">Application reference: RP-2026-0048</p></div></div></div></section>

            <section id="colours"><SectionHeader description="White working surfaces and muted neutrals place the emphasis on information. Portal Navy signals active decisions and primary actions." index="02 / System" title="Colours" /><div className="flex flex-wrap gap-4"><ColourSwatch label="Portal Navy" style="bg-primary" value="#16263D" /><ColourSwatch label="Supporting Blue" style="bg-portal-blue" value="#436C9E" /><ColourSwatch label="Working Surface" style="bg-portal-surface" value="#F7F8FA" /><ColourSwatch label="Border" style="bg-border" value="#E4E7EC" /><ColourSwatch label="Primary Text" style="bg-foreground" value="#1D2733" /></div></section>

            <section id="buttons"><SectionHeader description="Button variants cover primary, secondary, tertiary, destructive, disabled, and loading states in small, medium, and large sizes." index="03 / Actions" title="Buttons" /><div className="space-y-5"><SpecimenCard><div className="flex flex-wrap items-center gap-3"><FoundationButton size="sm">Primary</FoundationButton><FoundationButton>Primary</FoundationButton><FoundationButton size="lg">Primary</FoundationButton><FoundationButton variant="secondary">Secondary</FoundationButton><FoundationButton variant="tertiary">Text action</FoundationButton><FoundationButton variant="destructive">Remove</FoundationButton></div></SpecimenCard><SpecimenCard className="flex flex-wrap items-center gap-3"><FoundationButton disabled>Disabled</FoundationButton><FoundationButton loading>Saving</FoundationButton><FoundationButton onClick={() => notify("Button interaction")} variant="secondary"><Check className="size-4" /> Confirm</FoundationButton></SpecimenCard></div></section>

            <section id="fields"><SectionHeader description="Field primitives preserve a clear label-to-control relationship, visible focus treatment, helper text, and concise error messaging." index="04 / Inputs" title="Form fields" /><div className="grid gap-5 sm:grid-cols-2"><FieldFrame helper="Use the name shown in official documents." label="Full name" required><FoundationInput placeholder="e.g. Taylor Morgan" /></FieldFrame><FieldFrame error="Enter a valid work email address." label="Email address" required><FoundationInput error placeholder="name@company.com" type="email" /></FieldFrame><FieldFrame label="Preferred role"><FoundationSelect defaultValue=""><option disabled value="">Select a role</option><option value="analyst">Data Analyst</option><option value="coordinator">People Coordinator</option></FoundationSelect></FieldFrame><FieldFrame helper="A short note is enough for this component example." label="Supporting note"><FoundationTextarea placeholder="Add any relevant context..." /></FieldFrame><div className="space-y-4 sm:col-span-2"><SearchField /><div className="flex flex-col gap-4 rounded-lg border border-border bg-portal-surface p-4 sm:flex-row sm:items-center sm:gap-8"><label className="flex items-center gap-2.5 text-sm text-foreground"><input className="size-4 rounded border-input accent-primary" type="checkbox" />I agree to the privacy notice</label><div className="flex items-center gap-4"><span className="text-sm text-muted-foreground">Application type</span><label className="flex items-center gap-2 text-sm text-foreground"><input className="size-4 accent-primary" defaultChecked name="application-type" type="radio" />Standard</label><label className="flex items-center gap-2 text-sm text-foreground"><input className="size-4 accent-primary" name="application-type" type="radio" />Referral</label></div></div></div><div className="sm:col-span-2"><FileUploadBox /></div></div></section>

            <section id="cards"><SectionHeader description="The card is a professional surface, not a decorative container. Variants create emphasis only when required by the workflow." index="05 / Surfaces" title="Cards" /><div className="grid gap-4 lg:grid-cols-3"><SpecimenCard><span className="section-kicker">Standard</span><h3 className="mt-3 text-lg font-semibold text-primary">Candidate summary</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">A neutral surface for discrete content groups.</p></SpecimenCard><SpecimenCard onClick={() => notify("Clickable card")} variant="clickable"><span className="section-kicker">Clickable</span><h3 className="mt-3 text-lg font-semibold text-primary">Review application</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">A quiet hover and focus affordance marks navigation.</p></SpecimenCard><SpecimenCard variant="highlighted"><span className="section-kicker">Highlighted</span><h3 className="mt-3 text-lg font-semibold text-primary">Assessment due</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">A low-contrast blue wash carries a gentle priority cue.</p></SpecimenCard></div></section>

            <section id="status"><SectionHeader description="Status badges use low-saturation fills and darker labels so they remain informative without overpowering candidate information." index="06 / Workflow" title="Status badges" /><SpecimenCard><div className="flex flex-wrap gap-2.5">{(["In Progress", "Submitted", "Under Review", "Shortlisted", "Interview", "Rejected"] as const).map((status) => <StatusBadge key={status} status={status} />)}</div></SpecimenCard></section>

            <section id="stepper"><SectionHeader description="The future application stepper keeps orientation visible across Profile, Experience, CV, Assessment, and Review." index="07 / Wayfinding" title="Progress stepper" /><div className="relative overflow-hidden rounded-xl border border-border bg-white p-6 sm:p-9"><img alt="" className="pointer-events-none absolute -bottom-6 right-0 hidden w-[360px] opacity-30 lg:block" src={processAccent} /><div className="relative"><ProgressStepper current={2} /></div></div></section>

            <section id="table"><SectionHeader description="The table pattern pairs a compact search and filter bar with clear headings, generous row height, and minimal visual decoration." index="08 / Administration" title="Candidate table" /><CandidateTable onPlaceholder={notify} /></section>

            <section id="feedback"><SectionHeader description="Muted alert styles communicate outcome and next steps. The modal follows the same clear hierarchy for confirmation moments." index="09 / Feedback" title="Alerts & modal" /><div className="space-y-3"><AlertPanel type="success" /><AlertPanel type="warning" /><AlertPanel type="error" /><AlertPanel type="info" /></div><SpecimenCard className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-foreground">Confirmation modal</p><p className="mt-1 text-[13px] text-muted-foreground">A 470px dialog for critical future actions.</p></div><FoundationButton onClick={() => setModalOpen(true)} variant="secondary">Open modal example</FoundationButton></SpecimenCard></section>

            <section id="states"><SectionHeader description="Loading and empty patterns maintain a composed experience while content is pending or a collection has not yet started." index="10 / Continuity" title="Loading & empty states" /><LoadingStates /><div className="mt-4"><EmptyState onAction={() => notify("Start Application")} /></div></section>
          </div>
        </div>
      </main>
      <PublicFooter />
      <ConfirmationModal onClose={() => setModalOpen(false)} open={modalOpen} />
    </div>
  );
}

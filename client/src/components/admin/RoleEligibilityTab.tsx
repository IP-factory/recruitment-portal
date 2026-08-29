/**
 * Task 24E — Admin eligibility configuration tab.
 *
 * Each recruitment role owns its own gate set; nothing here assumes a shared
 * G1–G7 structure. Gates can be added, edited and removed per role, with the
 * generic configuration shape (inputType, options, pass rule, blocking flag,
 * supporting values) validated server-side.
 */
import { DataErrorState, DataLoadingState } from "@/components/AsyncStates";
import { FoundationButton, FoundationInput } from "@/components/foundation/ui";
import { useAdminEligibility } from "@/hooks/useRecruitmentData";
import {
  createAdminEligibilityGate,
  deleteAdminEligibilityGate,
  updateAdminEligibilityGate,
  GATE_INPUT_TYPES,
  GATE_STATUSES,
  RecruitmentApiError,
  type AdminEligibilityGate,
  type EligibilityGateConfiguration,
  type EligibilityGateInput,
  type EligibilityGateOption,
  type GateInputType,
} from "@/lib/recruitmentApi";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

const INPUT_TYPE_LABELS: Record<GateInputType, string> = {
  YES_NO: "Yes / No",
  SINGLE_SELECT: "Single select",
  APPLICATION_FIELD: "Derived from applicant information",
  DATE: "Date / availability",
  COMPENSATION: "Compensation range",
  FREE_TEXT: "Free text",
};

function describeConfiguration(gate: AdminEligibilityGate): string {
  const config = gate.configuration;
  const parts: string[] = [];
  if (config.inputType === "APPLICATION_FIELD") parts.push(`Field: ${config.fieldKey ?? "—"}`, config.minimumYears !== undefined ? `Minimum ${config.minimumYears} years` : "");
  if (config.inputType === "YES_NO" && config.passRule?.match) parts.push(`Pass answer: ${config.passRule.match}`);
  if (config.latestStartDate) parts.push(`Deadline: ${config.latestStartDate}`);
  if (config.minimumAmount !== undefined && config.maximumAmount !== undefined) parts.push(`Band: ${config.minimumAmount.toLocaleString()} – ${config.maximumAmount.toLocaleString()} ${config.currency ?? ""}`.trim());
  if (config.inputType === "SINGLE_SELECT") parts.push(`${config.options?.length ?? 0} options`);
  return parts.filter(Boolean).join(" · ");
}

type GateFormState = {
  reference: string;
  name: string;
  description: string;
  status: string;
  displayOrder: string;
  inputType: GateInputType;
  isBlocking: boolean;
  passMatch: string;
  minimumYears: string;
  latestStartDate: string;
  minimumAmount: string;
  maximumAmount: string;
  currency: string;
  options: EligibilityGateOption[];
};

function toFormState(gate: AdminEligibilityGate | null, nextOrder: number): GateFormState {
  const config = gate?.configuration;
  return {
    reference: gate?.reference ?? "",
    name: gate?.name ?? "",
    description: gate?.description ?? "",
    status: gate?.status ?? "Active",
    displayOrder: String(gate?.displayOrder ?? nextOrder),
    inputType: config?.inputType ?? "YES_NO",
    isBlocking: config?.isBlocking !== false,
    passMatch: config?.passRule?.match ?? "yes",
    minimumYears: config?.minimumYears !== undefined ? String(config.minimumYears) : "",
    latestStartDate: config?.latestStartDate ?? "",
    minimumAmount: config?.minimumAmount !== undefined ? String(config.minimumAmount) : "",
    maximumAmount: config?.maximumAmount !== undefined ? String(config.maximumAmount) : "",
    currency: config?.currency ?? "",
    options: config?.options ?? [],
  };
}

function buildConfiguration(form: GateFormState): EligibilityGateConfiguration {
  const base: EligibilityGateConfiguration = { inputType: form.inputType, label: form.name, isBlocking: form.isBlocking };
  if (form.inputType === "YES_NO") {
    base.passRule = { match: form.passMatch.trim() || "yes" };
    if (form.latestStartDate) base.latestStartDate = form.latestStartDate;
    if (form.minimumAmount && form.maximumAmount) {
      base.minimumAmount = Number(form.minimumAmount);
      base.maximumAmount = Number(form.maximumAmount);
      if (form.currency) base.currency = form.currency;
    }
  }
  if (form.inputType === "SINGLE_SELECT") base.options = form.options;
  if (form.inputType === "APPLICATION_FIELD") {
    base.fieldKey = "relevantExperience";
    base.minimumYears = Number(form.minimumYears || 0);
  }
  return base;
}

function GateEditor({ gate, nextOrder, onCancel, onSaved, roleSlug }: { gate: AdminEligibilityGate | null; nextOrder: number; onCancel: () => void; onSaved: () => void; roleSlug: string }) {
  const [form, setForm] = useState<GateFormState>(() => toFormState(gate, nextOrder));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <Key extends keyof GateFormState>(key: Key, value: GateFormState[Key]) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    const input: EligibilityGateInput = {
      reference: form.reference.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      status: form.status as EligibilityGateInput["status"],
      displayOrder: Number(form.displayOrder) || nextOrder,
      configuration: buildConfiguration(form),
    };
    try {
      if (gate) await updateAdminEligibilityGate(gate.id, input);
      else await createAdminEligibilityGate(roleSlug, input);
      onSaved();
    } catch (err) {
      setError(err instanceof RecruitmentApiError ? err.message : "Unable to save the gate.");
    } finally {
      setSaving(false);
    }
  };

  return <article className="mt-5 rounded-xl border border-portal-blue/30 bg-white p-5">
    <h4 className="text-base font-semibold text-primary">{gate ? `Edit gate ${gate.reference}` : "Add eligibility gate"}</h4>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="block text-[13px] font-medium text-primary">Gate code<input className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm" maxLength={16} onChange={(event) => set("reference", event.target.value)} placeholder="e.g. G1" value={form.reference} /></label>
      <label className="block text-[13px] font-medium text-primary">Display label<input className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm" onChange={(event) => set("name", event.target.value)} placeholder="e.g. Right to work" value={form.name} /></label>
      <label className="block text-[13px] font-medium text-primary sm:col-span-2">Question text<textarea className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm" onChange={(event) => set("description", event.target.value)} rows={2} value={form.description} /></label>
      <label className="block text-[13px] font-medium text-primary">Input type
        <select className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm" onChange={(event) => set("inputType", event.target.value as GateInputType)} value={form.inputType}>
          {GATE_INPUT_TYPES.filter((type) => ["YES_NO", "SINGLE_SELECT", "APPLICATION_FIELD"].includes(type)).map((type) => <option key={type} value={type}>{INPUT_TYPE_LABELS[type]}</option>)}
        </select>
      </label>
      <label className="block text-[13px] font-medium text-primary">Status
        <select className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm" onChange={(event) => set("status", event.target.value)} value={form.status}>
          {GATE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
      <label className="block text-[13px] font-medium text-primary">Display order<input className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm" min={1} onChange={(event) => set("displayOrder", event.target.value)} type="number" value={form.displayOrder} /></label>
      <label className="flex items-center gap-2 pt-6 text-[13px] font-medium text-primary"><input checked={form.isBlocking} className="size-4 accent-[#436C9E]" onChange={(event) => set("isBlocking", event.target.checked)} type="checkbox" />Blocking gate (failure closes the application)</label>

      {form.inputType === "YES_NO" ? <>
        <label className="block text-[13px] font-medium text-primary">Pass answer<input className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm" onChange={(event) => set("passMatch", event.target.value)} placeholder="yes" value={form.passMatch} /></label>
        <label className="block text-[13px] font-medium text-primary">Deadline date (optional)<FoundationInput onChange={(event) => set("latestStartDate", event.target.value)} type="date" value={form.latestStartDate} /></label>
        <label className="block text-[13px] font-medium text-primary">Minimum amount (optional)<FoundationInput onChange={(event) => set("minimumAmount", event.target.value)} placeholder="6000000" type="number" value={form.minimumAmount} /></label>
        <label className="block text-[13px] font-medium text-primary">Maximum amount (optional)<FoundationInput onChange={(event) => set("maximumAmount", event.target.value)} placeholder="9600000" type="number" value={form.maximumAmount} /></label>
      </> : null}

      {form.inputType === "APPLICATION_FIELD" ? <label className="block text-[13px] font-medium text-primary">Minimum years<input className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm" min={0} onChange={(event) => set("minimumYears", event.target.value)} placeholder="3" type="number" value={form.minimumYears} /></label> : null}
    </div>

    {form.inputType === "SINGLE_SELECT" ? <div className="mt-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Options</p>
      <div className="mt-2 space-y-2">
        {form.options.map((option, index) => <div className="grid gap-2 sm:grid-cols-[1fr_2fr_140px_36px]" key={index}>
          <input className="rounded-lg border border-border px-3 py-2 text-sm" onChange={(event) => set("options", form.options.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, value: event.target.value } : candidate))} placeholder="value" value={option.value} />
          <input className="rounded-lg border border-border px-3 py-2 text-sm" onChange={(event) => set("options", form.options.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, text: event.target.value } : candidate))} placeholder="Option text shown to the applicant" value={option.text} />
          <select className="rounded-lg border border-border bg-white px-3 py-2 text-sm" onChange={(event) => set("options", form.options.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, outcome: event.target.value as EligibilityGateOption["outcome"] } : candidate))} value={option.outcome}>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
            <option value="PASS_WITH_FLAG">Pass with flag</option>
          </select>
          <button aria-label="Remove option" className="flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-status-error-strong" onClick={() => set("options", form.options.filter((_, candidateIndex) => candidateIndex !== index))} type="button"><Trash2 className="size-4" /></button>
        </div>)}
      </div>
      <FoundationButton className="mt-3" onClick={() => set("options", [...form.options, { value: "", text: "", outcome: "PASS" }])} size="sm" type="button" variant="secondary">Add option</FoundationButton>
    </div> : null}

    {error ? <p className="mt-4 rounded-lg border border-status-error-strong bg-status-error-soft px-3 py-2 text-[13px] text-status-error-strong">{error}</p> : null}
    <div className="mt-5 flex gap-3">
      <FoundationButton disabled={saving} onClick={save} type="button">{saving ? "Saving..." : gate ? "Save gate" : "Add gate"}</FoundationButton>
      <FoundationButton onClick={onCancel} type="button" variant="secondary">Cancel</FoundationButton>
    </div>
  </article>;
}

export function RoleEligibilityTab({ roleSlug }: { roleSlug: string }) {
  const eligibilityState = useAdminEligibility(roleSlug);
  const [editingGate, setEditingGate] = useState<AdminEligibilityGate | null>(null);
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const gates = eligibilityState.data?.gates ?? [];
  const nextOrder = useMemo(() => gates.reduce((max, gate) => Math.max(max, gate.displayOrder), 0) + 1, [gates]);

  const refresh = useCallback(() => {
    setEditingGate(null);
    setAdding(false);
    eligibilityState.reload();
  }, [eligibilityState]);

  const removeGate = async (gate: AdminEligibilityGate) => {
    setActionError(null);
    try {
      await deleteAdminEligibilityGate(gate.id);
      eligibilityState.reload();
    } catch (error) {
      setActionError(error instanceof RecruitmentApiError ? error.message : "Unable to delete the gate.");
    }
  };

  return <section>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h3 className="text-xl font-semibold tracking-[-0.025em] text-primary">Eligibility configuration</h3>
        <p className="mt-1 text-sm text-muted-foreground">Configure this role&rsquo;s eligibility gates. Each role has its own independent gate set — gates, questions and pass rules are never shared between roles.</p>
      </div>
      <FoundationButton onClick={() => { setAdding(true); setEditingGate(null); }} type="button" variant="secondary"><Plus className="size-4" />Add gate</FoundationButton>
    </div>

    {eligibilityState.status === "loading" ? <div className="mt-6"><DataLoadingState label="Loading eligibility gates" /></div> : null}
    {eligibilityState.status === "error" ? <div className="mt-6"><DataErrorState message={eligibilityState.error ?? "Unable to load eligibility gates."} onRetry={eligibilityState.reload} /></div> : null}
    {actionError ? <p className="mt-4 rounded-lg border border-status-error-strong bg-status-error-soft px-3 py-2 text-[13px] text-status-error-strong">{actionError}</p> : null}

    {eligibilityState.status === "ready" ? <>
      {gates.length === 0 && !adding ? <article className="mt-5 rounded-xl border border-border bg-white p-6"><h4 className="text-base font-semibold text-primary">No eligibility gates configured</h4><p className="mt-2 text-sm text-muted-foreground">Add the first gate to configure eligibility for this role.</p></article> : null}
      {gates.length ? <article className="mt-5 overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-left">
          <thead className="border-b border-border bg-surface-muted">
            <tr>{["Order", "Code", "Gate", "Input type", "Blocking", "Status", "Actions"].map((heading) => <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground" key={heading}>{heading}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {gates.map((gate) => <tr key={gate.id}>
              <td className="px-4 py-4 text-sm text-muted-foreground">{gate.displayOrder}</td>
              <td className="px-4 py-4 text-sm font-semibold text-primary">{gate.reference}</td>
              <td className="px-4 py-4"><p className="text-sm font-medium text-primary">{gate.name}</p><p className="mt-0.5 max-w-md text-[12px] text-muted-foreground">{gate.description}</p>{describeConfiguration(gate) ? <p className="mt-0.5 text-[12px] text-portal-blue">{describeConfiguration(gate)}</p> : null}</td>
              <td className="whitespace-nowrap px-4 py-4 text-[13px] text-muted-foreground">{INPUT_TYPE_LABELS[gate.configuration.inputType] ?? gate.configuration.inputType}</td>
              <td className="px-4 py-4 text-[13px] text-muted-foreground">{gate.configuration.isBlocking === false ? "Non-blocking" : "Blocking"}</td>
              <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${gate.status === "Active" ? "bg-status-success-soft text-status-success-strong" : gate.status === "Inactive" ? "bg-surface-muted text-muted-foreground" : "bg-[#fffaf0] text-[#765d22]"}`}>{gate.status}</span></td>
              <td className="whitespace-nowrap px-4 py-4 text-right"><button className="text-[13px] font-medium text-portal-blue hover:underline" onClick={() => { setEditingGate(gate); setAdding(false); }} type="button">Edit</button><button className="ml-3 text-[13px] font-medium text-status-error-strong hover:underline" onClick={() => removeGate(gate)} type="button">Delete</button></td>
            </tr>)}
          </tbody>
        </table>
      </article> : null}
    </> : null}

    {adding ? <GateEditor gate={null} nextOrder={nextOrder} onCancel={() => setAdding(false)} onSaved={refresh} roleSlug={roleSlug} /> : null}
    {editingGate ? <GateEditor gate={editingGate} nextOrder={nextOrder} onCancel={() => setEditingGate(null)} onSaved={refresh} roleSlug={roleSlug} /> : null}
  </section>;
}

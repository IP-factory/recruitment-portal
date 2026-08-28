/**
 * Quiet Authority Recruitment Role form — Task 24C-1: create and edit persist
 * through the Admin recruitment API to TiDB. The server re-validates input
 * and returns safe error messages; the UI never stores roles locally.
 */
import { AdminShell } from "@/components/admin/AdminShell";
import { DataErrorState, DataLoadingState } from "@/components/AsyncStates";
import { FieldFrame, FoundationButton, FoundationInput, FoundationSelect, FoundationTextarea } from "@/components/foundation/ui";
import { useAdminRole } from "@/hooks/useRecruitmentData";
import { createAdminRole, EMPLOYMENT_TYPES, ROLE_STATUSES, updateAdminRole, type EmploymentType, type RecruitmentRoleInput, type RoleStatus } from "@/lib/recruitmentApi";
import { ArrowLeft, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

type FormValues = RecruitmentRoleInput;
type FormErrors = Partial<Record<keyof FormValues | "dates", string>>;
const employmentTypes: EmploymentType[] = [...EMPLOYMENT_TYPES];
const roleStatuses: RoleStatus[] = [...ROLE_STATUSES];
const emptyValues: FormValues = { title: "", department: "", location: "", employmentType: "Full-time", shortDescription: "", fullDescription: "", status: "Draft", openingDate: null, closingDate: null };

export default function AdminRoleForm({ roleSlug }: { roleSlug?: string }) {
  const [, setLocation] = useLocation();
  const existingRole = useAdminRole(roleSlug);
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (roleSlug && existingRole.status === "ready" && existingRole.data) {
      const role = existingRole.data;
      setValues({ title: role.title, department: role.department, location: role.location, employmentType: role.employmentType, shortDescription: role.shortDescription, fullDescription: role.fullDescription, status: role.status, openingDate: role.openingDate, closingDate: role.closingDate });
    }
    if (!roleSlug) setValues(emptyValues);
    setErrors({});
    setServerError(null);
  }, [roleSlug, existingRole.status, existingRole.data]);
  const setValue = <Key extends keyof FormValues>(key: Key, value: FormValues[Key]) => setValues((current) => ({ ...current, [key]: value }));
  const validate = () => {
    const next: FormErrors = {};
    if (!values.title.trim()) next.title = "Enter a role title.";
    if (!values.department.trim()) next.department = "Enter a department.";
    if (!values.location.trim()) next.location = "Enter a location.";
    if (!values.employmentType) next.employmentType = "Select an employment type.";
    if (!values.shortDescription.trim()) next.shortDescription = "Enter a short role description.";
    if (!values.status) next.status = "Select a role status.";
    if (values.openingDate && values.closingDate && values.closingDate < values.openingDate) next.dates = "Closing date must be after the opening date.";
    setErrors(next);
    return !Object.keys(next).length;
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate() || saving) return;
    setSaving(true);
    setServerError(null);
    try {
      const role = roleSlug && existingRole.data ? await updateAdminRole(existingRole.data.id, values) : await createAdminRole(values);
      setLocation(`/admin/roles/${role.slug}`);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to save the recruitment role.");
      setSaving(false);
    }
  };
  const heading = roleSlug ? "Edit recruitment role" : "Create recruitment role";
  // Cancelling an edit returns to the role detail; a new role has no detail yet.
  const cancelTarget = roleSlug ? `/admin/roles/${roleSlug}` : "/admin/roles";
  if (roleSlug && existingRole.status === "loading") return <AdminShell title="Recruitment Roles"><div className="mt-6"><DataLoadingState label="Loading recruitment role" /></div></AdminShell>;
  if (roleSlug && (existingRole.status === "error" || !existingRole.data)) return <AdminShell title="Recruitment Roles"><section className="py-8"><h2 className="text-2xl font-semibold tracking-[-0.03em] text-primary">{existingRole.status === "error" ? "Role unavailable" : "Role not found"}</h2><p className="mt-2 text-sm text-muted-foreground">{existingRole.error ?? "The requested recruitment role could not be found."}</p>{existingRole.status === "error" ? <div className="mt-6"><DataErrorState message={existingRole.error ?? "Unable to load the recruitment role."} onRetry={existingRole.reload} /></div> : <FoundationButton className="mt-6" onClick={() => setLocation("/admin/roles")} variant="secondary">Back to recruitment roles</FoundationButton>}</section></AdminShell>;
  return <AdminShell title="Recruitment Roles"><button className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary" onClick={() => setLocation(cancelTarget)} type="button"><ArrowLeft className="size-4" />{roleSlug ? "Back to role" : "Back to recruitment roles"}</button><section className="mt-5"><h2 className="text-3xl font-semibold tracking-[-0.035em] text-primary">{heading}</h2><p className="mt-2 max-w-2xl text-[15px] leading-6 text-muted-foreground">Set up the core information applicants will see when applying for this role.</p></section><div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)]"><form className="rounded-xl border border-border bg-white p-5 shadow-none sm:p-6" noValidate onSubmit={save}><section><h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Role information</h3><div className="mt-6 grid gap-5 sm:grid-cols-2"><FieldFrame error={errors.title} label="Role title" required><FoundationInput error={Boolean(errors.title)} onChange={(event) => setValue("title", event.target.value)} placeholder="e.g. Business Development Officer" value={values.title} /></FieldFrame><FieldFrame error={errors.department} label="Department" required><FoundationInput error={Boolean(errors.department)} onChange={(event) => setValue("department", event.target.value)} placeholder="e.g. Business Development" value={values.department} /></FieldFrame><FieldFrame error={errors.location} label="Location" required><FoundationInput error={Boolean(errors.location)} onChange={(event) => setValue("location", event.target.value)} placeholder="e.g. Abuja or Remote" value={values.location} /></FieldFrame><FieldFrame error={errors.employmentType} label="Employment type" required><FoundationSelect onChange={(event) => setValue("employmentType", event.target.value as EmploymentType)} value={values.employmentType}>{employmentTypes.map((item) => <option key={item} value={item}>{item}</option>)}</FoundationSelect></FieldFrame></div><div className="mt-5"><FieldFrame error={errors.shortDescription} helper="A concise summary shown on the role-selection page." label="Short description" required><FoundationTextarea error={Boolean(errors.shortDescription)} onChange={(event) => setValue("shortDescription", event.target.value)} placeholder="Describe the opportunity briefly." value={values.shortDescription} /></FieldFrame></div><div className="mt-5"><FieldFrame helper="Provide additional context about the opportunity." label="Role description"><FoundationTextarea onChange={(event) => setValue("fullDescription", event.target.value)} placeholder="Add optional role context." value={values.fullDescription} /></FieldFrame></div></section><section className="mt-7 border-t border-border pt-6"><h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Application settings</h3><div className="mt-6 grid gap-5 sm:grid-cols-2"><FieldFrame error={errors.status} label="Role status" required><FoundationSelect onChange={(event) => setValue("status", event.target.value as RoleStatus)} value={values.status}>{roleStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</FoundationSelect></FieldFrame><div className="hidden sm:block" /><FieldFrame label="Application opening date"><FoundationInput onChange={(event) => setValue("openingDate", event.target.value || null)} type="date" value={values.openingDate ?? ""} /></FieldFrame><FieldFrame label="Application closing date"><FoundationInput onChange={(event) => setValue("closingDate", event.target.value || null)} type="date" value={values.closingDate ?? ""} /></FieldFrame></div>{errors.dates ? <p className="mt-3 text-[13px] text-status-error-strong">{errors.dates}</p> : null}</section>{serverError ? <div className="mt-5"><DataErrorState message={serverError} /></div> : null}<div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between"><FoundationButton onClick={() => setLocation(cancelTarget)} variant="secondary">Cancel</FoundationButton><FoundationButton disabled={saving} type="submit">{saving ? "Saving…" : roleSlug ? "Save changes" : "Save role"}</FoundationButton></div></form><aside className="h-fit rounded-xl border border-border bg-white p-5 shadow-none"><div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-portal-blue-soft text-portal-blue"><Info className="size-4" /></span><div><h3 className="text-base font-semibold text-primary">Role setup</h3><p className="mt-2 text-[13px] leading-6 text-muted-foreground">Role details are stored in the recruitment database and validated on the server before saving.</p></div></div><div className="mt-5 border-t border-border pt-5"><h4 className="text-sm font-semibold text-primary">Publishing guidance</h4><p className="mt-2 text-[13px] leading-6 text-muted-foreground">Open roles are visible to applicants. Closed roles remain visible but cannot accept applications. Draft and archived roles are kept out of the public opportunities page.</p></div><div className="mt-5 border-t border-border pt-5"><h4 className="text-sm font-semibold text-primary">Assessment</h4><p className="mt-2 text-[13px] leading-6 text-muted-foreground">Assessment configuration will be added in a later stage.</p></div></aside></div></AdminShell>;
}

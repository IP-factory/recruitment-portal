/**
 * Quiet Authority candidate placeholder: preserves the protected Admin context while reserving detailed review for the next stage.
 */
import { AdminShell } from "@/components/admin/AdminShell";
import { FoundationButton } from "@/components/foundation/ui";
import { adminApplications } from "@/lib/adminMockData";
import { useLocation, useRoute } from "wouter";

export default function AdminCandidatePlaceholder() {
  const [, params] = useRoute("/admin/applications/:candidateId");
  const [, setLocation] = useLocation();
  const application = adminApplications.find((candidate) => candidate.id === params?.candidateId);
  return <AdminShell title="Applications"><section><p className="text-[12px] font-medium text-muted-foreground">Application</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-primary">{application?.candidateName ?? "Application not found"}</h2><p className="mt-2 text-[15px] leading-6 text-muted-foreground">{application ? "The detailed candidate review experience will be built in the next stage." : "This application is not available in the frontend demo."}</p><FoundationButton className="mt-6" onClick={() => setLocation("/admin/applications")} variant="secondary">Back to applications</FoundationButton></section></AdminShell>;
}

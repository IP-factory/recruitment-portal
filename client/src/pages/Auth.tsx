/**
 * Quiet Authority auth routing placeholder: a deliberately minimal transition state before authentication is introduced.
 */
import { AlignmentMark, PublicFooter, PublicNavigation } from "@/components/foundation/navigation";
import { FoundationButton, SpecimenCard } from "@/components/foundation/ui";
import { useLocation } from "wouter";

export default function Auth() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-white text-foreground">
      <PublicNavigation />
      <main className="portal-container flex min-h-[calc(100vh-360px)] flex-1 items-center justify-center py-16 sm:py-20">
        <SpecimenCard className="w-full max-w-[500px] p-7 text-center shadow-none sm:p-9">
          <div className="mx-auto flex w-fit items-center gap-2"><AlignmentMark className="size-5" /><p className="section-kicker">Application access</p></div>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-primary">Applicant sign in</h1>
          <p className="mx-auto mt-4 max-w-sm text-[15px] leading-7 text-muted-foreground">Account creation and sign-in will be added in the next stage of the application experience.</p>
          <FoundationButton className="mt-7" onClick={() => setLocation("/apply")} variant="secondary">Back to opportunities</FoundationButton>
        </SpecimenCard>
      </main>
      <PublicFooter />
    </div>
  );
}

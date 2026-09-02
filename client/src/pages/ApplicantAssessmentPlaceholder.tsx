/**
 * Task 24D-1 — Assessment introduction page.
 *
 * Serves as a preparation step before the assessment questions. Loads the
 * assessment configuration from TiDB to confirm it is available before the
 * applicant begins.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton } from "@/components/foundation/ui";
import { fetchLiveAssessment } from "@/lib/applicationApi";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const BEFORE_YOU_BEGIN = [
  `You will answer {count} role-related questions based on your experience and how you would approach common commercial situations.`,
  "Choose the response that most accurately reflects what you have done or would most likely do.",
  "Read each question carefully and complete the assessment based on your own experience and judgement.",
  "You will have an opportunity to review your responses before final submission.",
] as const;

export default function ApplicantAssessmentPlaceholder() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);

  useEffect(() => {
    fetchLiveAssessment()
      .then((data) => {
        setQuestionCount(data.questionCount);
        if (data.completed) {
          setLocation("/apply/business-development-officer/review");
          return;
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load your assessment.");
        setLoading(false);
      });
  }, [setLocation]);

  const countLabel = questionCount > 0 ? String(questionCount) : "a series of";

  return (
    <ApplicationShell activeStep={2} showSummary>
      <section>
        <p className="section-kicker">Step 3 of 4</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">Business Development Assessment</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">
          This short role-specific assessment helps us understand your experience, commercial judgement and approach to common Business Development situations.
        </p>

        <div className="mt-8 rounded-xl border border-border bg-white p-7 shadow-none sm:p-8">
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />Loading your assessment...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-status-error-strong bg-status-error-soft px-4 py-3 text-sm text-status-error-strong">{error}</div>
          ) : (
            <>
              <section aria-labelledby="before-begin-title">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-primary" id="before-begin-title">Before you begin</h2>
                <ul className="mt-5 space-y-3">
                  {BEFORE_YOU_BEGIN.map((item) => (
                    <li className="flex gap-3 text-[14px] leading-6 text-muted-foreground" key={item}>
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-portal-blue" aria-hidden="true" />
                      <span>
                        {item.replace("{count}", countLabel)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm font-semibold text-primary">
                  There are no visible scores while completing the assessment. Focus on selecting the response that best represents you.
                </p>
              </section>

              <div className="mt-8 flex justify-end border-t border-border pt-6">
                <FoundationButton
                  className="w-full sm:w-auto"
                  onClick={() => setLocation("/apply/business-development-officer/assessment/questions")}
                  size="lg"
                >
                  Start assessment
                </FoundationButton>
              </div>
            </>
          )}
        </div>
      </section>
    </ApplicationShell>
  );
}

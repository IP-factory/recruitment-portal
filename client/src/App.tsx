/** Quiet Authority routes: the internal UI-kit review and a visual-only portal shell. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminAuthProvider, AdminRouteGuard } from "@/contexts/AdminAuthContext";
import type { ReactNode } from "react";
import Apply from "@/pages/Apply";
import ApplicantCvPlaceholder from "@/pages/ApplicantCvPlaceholder";
import ApplicantAssessmentPlaceholder from "@/pages/ApplicantAssessmentPlaceholder";
import ApplicantAssessmentQuestionsPlaceholder from "@/pages/ApplicantAssessmentQuestionsPlaceholder";
import ApplicantAssessmentComplete from "@/pages/ApplicantAssessmentComplete";
import ApplicantReviewPlaceholder from "@/pages/ApplicantReviewPlaceholder";
import ApplicantSubmissionOutcome from "@/pages/ApplicantSubmissionOutcome";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminHelp from "@/pages/AdminHelp";
import AdminApplications from "@/pages/AdminApplications";
import AdminCandidatePlaceholder from "@/pages/AdminCandidatePlaceholder";
import AdminLogin from "@/pages/AdminLogin";
import AdminPlaceholder from "@/pages/AdminPlaceholder";
import AdminRoleDetail from "@/pages/AdminRoleDetail";
import AdminRoleForm from "@/pages/AdminRoleForm";
import AdminRoles from "@/pages/AdminRoles";
import AdminQuestionBank from "@/pages/AdminQuestionBank";
import AdminQuestionDetail from "@/pages/AdminQuestionDetail";
import AdminQuestionForm from "@/pages/AdminQuestionForm";
import AdminAssessmentDetail from "@/pages/AdminAssessmentDetail";
import AdminAssessments from "@/pages/AdminAssessments";
import AdminAssessmentBuilder from "@/pages/AdminAssessmentBuilder";
import AdminAssessmentCsvImport from "@/pages/AdminAssessmentCsvImport";
import AdminAssessmentPreview from "@/pages/AdminAssessmentPreview";
import AdminScreening from "@/pages/AdminScreening";
import ApplicantInformation from "@/pages/ApplicantInformation";
import ApplicantRoleIntroduction from "@/pages/ApplicantRoleIntroduction";
import ApplicantEligibilityCloseout from "@/pages/ApplicantEligibilityCloseout";
import { ApplicantEligibilityGuard } from "@/components/application/ApplicantEligibilityGuard";
import Auth from "@/pages/Auth";
import AuthCreateAccount from "@/pages/AuthCreateAccount";
import AuthForgotPassword from "@/pages/AuthForgotPassword";
import AuthSignIn from "@/pages/AuthSignIn";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import Portal from "@/pages/Portal";
import UiKit from "@/pages/UiKit";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

/**
 * Task 24B route/session-level Admin protection: every `/admin/*` route
 * resolves the real server session before rendering. The login route shares
 * the session provider but is never guarded.
 */
function AdminRoute({ children }: { children: ReactNode }) {
  return <AdminAuthProvider><AdminRouteGuard>{children}</AdminRouteGuard></AdminAuthProvider>;
}

function Router() {
  return (
    <Switch>
      <Route component={Home} path="/" />
      <Route path="/admin/login">{() => <AdminAuthProvider><AdminLogin /></AdminAuthProvider>}</Route>
      <Route path="/admin">{() => <AdminRoute><AdminDashboard /></AdminRoute>}</Route>
      <Route path="/admin/screening">{() => <AdminRoute><AdminScreening /></AdminRoute>}</Route>
      <Route path="/admin/applications/:candidateId">{() => <AdminRoute><AdminCandidatePlaceholder /></AdminRoute>}</Route>
      <Route path="/admin/applications">{() => <AdminRoute><AdminApplications /></AdminRoute>}</Route>
      <Route path="/admin/roles/new">{() => <AdminRoute><AdminRoleForm /></AdminRoute>}</Route>
      <Route path="/admin/roles/:roleSlug/edit">{(params) => <AdminRoute><AdminRoleForm roleSlug={params.roleSlug} /></AdminRoute>}</Route>
      <Route path="/admin/roles/:roleSlug/assessment/import">{() => <AdminRoute><AdminAssessmentCsvImport /></AdminRoute>}</Route>
      <Route path="/admin/roles/:roleSlug">{() => <AdminRoute><AdminRoleDetail /></AdminRoute>}</Route>
      <Route path="/admin/roles">{() => <AdminRoute><AdminRoles /></AdminRoute>}</Route>
      <Route path="/admin/assessments/:assessmentSlug/edit">{() => <AdminRoute><AdminAssessmentBuilder /></AdminRoute>}</Route>
      <Route path="/admin/assessments/business-development-officer-assessment-v2/preview">{() => <AdminRoute><AdminAssessmentPreview /></AdminRoute>}</Route>
      <Route path="/admin/assessments/:assessmentSlug">{() => <AdminRoute><AdminAssessmentDetail /></AdminRoute>}</Route>
      <Route path="/admin/assessments">{() => <AdminRoute><AdminAssessments /></AdminRoute>}</Route>
      <Route path="/admin/questions/new">{() => <AdminRoute><AdminQuestionForm /></AdminRoute>}</Route>
      <Route path="/admin/questions/:questionId/edit">{(params) => <AdminRoute><AdminQuestionForm questionId={params.questionId} /></AdminRoute>}</Route>
      <Route path="/admin/questions/:questionId/duplicate">{(params) => <AdminRoute><AdminQuestionForm duplicateFromId={params.questionId} /></AdminRoute>}</Route>
      <Route path="/admin/questions/:questionId">{() => <AdminRoute><AdminQuestionDetail /></AdminRoute>}</Route>
      <Route path="/admin/questions">{() => <AdminRoute><AdminQuestionBank /></AdminRoute>}</Route>
      <Route path="/admin/settings">{() => <AdminRoute><AdminPlaceholder title="Settings" /></AdminRoute>}</Route>
      <Route path="/admin/help/:section">{() => <AdminRoute><AdminHelp /></AdminRoute>}</Route>
      <Route path="/admin/help">{() => <AdminRoute><AdminHelp /></AdminRoute>}</Route>
      <Route component={Apply} path="/apply" />
      {/* Task 24G — the DB-driven role introduction page precedes the information step. */}
      <Route component={ApplicantRoleIntroduction} path="/apply/business-development-officer" />
      <Route component={ApplicantInformation} path="/apply/business-development-officer/information" />
      <Route component={ApplicantEligibilityCloseout} path="/apply/business-development-officer/eligibility" />
      <Route path="/apply/business-development-officer/cv">{() => <ApplicantEligibilityGuard><ApplicantCvPlaceholder /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/business-development-officer/assessment">{() => <ApplicantEligibilityGuard><ApplicantAssessmentPlaceholder /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/business-development-officer/assessment/questions">{() => <ApplicantEligibilityGuard><ApplicantAssessmentQuestionsPlaceholder /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/business-development-officer/assessment/complete">{() => <ApplicantEligibilityGuard><ApplicantAssessmentComplete /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/business-development-officer/review">{() => <ApplicantEligibilityGuard><ApplicantReviewPlaceholder /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/business-development-officer/submitted">{() => <ApplicantSubmissionOutcome />}</Route>
      <Route path="/apply/business-development-manager/assessment/complete"><Redirect to="/apply/business-development-officer/assessment/complete" /></Route>
      <Route path="/apply/business-development-manager/assessment/questions"><Redirect to="/apply/business-development-officer/assessment/questions" /></Route>
      <Route path="/apply/business-development-manager/assessment"><Redirect to="/apply/business-development-officer/assessment" /></Route>
      <Route path="/apply/business-development-manager/review"><Redirect to="/apply/business-development-officer/review" /></Route>
      <Route path="/apply/business-development-manager/submitted"><Redirect to="/apply/business-development-officer/submitted" /></Route>
      <Route path="/apply/business-development-manager/cv"><Redirect to="/apply/business-development-officer/cv" /></Route>
      <Route path="/apply/business-development-manager/information"><Redirect to="/apply/business-development-officer/information" /></Route>
      <Route path="/apply/business-development-manager"><Redirect to="/apply/business-development-officer" /></Route>
      {/* Task 24G — generic applicant flow for any DB-driven role slug. */}
      <Route path="/apply/:roleSlug/information">{() => <ApplicantInformation />}</Route>
      <Route path="/apply/:roleSlug/eligibility">{() => <ApplicantEligibilityCloseout />}</Route>
      <Route path="/apply/:roleSlug/cv">{() => <ApplicantEligibilityGuard><ApplicantCvPlaceholder /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/:roleSlug/assessment">{() => <ApplicantEligibilityGuard><ApplicantAssessmentPlaceholder /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/:roleSlug/assessment/questions">{() => <ApplicantEligibilityGuard><ApplicantAssessmentQuestionsPlaceholder /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/:roleSlug/assessment/complete">{() => <ApplicantEligibilityGuard><ApplicantAssessmentComplete /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/:roleSlug/review">{() => <ApplicantEligibilityGuard><ApplicantReviewPlaceholder /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/:roleSlug/submitted">{() => <ApplicantSubmissionOutcome />}</Route>
      <Route path="/apply/:roleSlug">{() => <ApplicantRoleIntroduction />}</Route>
      <Route component={Auth} path="/auth" />
      <Route component={AuthSignIn} path="/auth/sign-in" />
      <Route component={AuthCreateAccount} path="/auth/create-account" />
      <Route component={AuthForgotPassword} path="/auth/forgot-password" />
      <Route component={UiKit} path="/ui-kit" />
      <Route component={Portal} path="/portal" />
      <Route component={NotFound} path="/404" />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

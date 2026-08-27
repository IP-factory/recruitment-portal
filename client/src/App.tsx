/** Quiet Authority routes: the internal UI-kit review and a visual-only portal shell. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Apply from "@/pages/Apply";
import ApplicantCvPlaceholder from "@/pages/ApplicantCvPlaceholder";
import ApplicantAssessmentPlaceholder from "@/pages/ApplicantAssessmentPlaceholder";
import ApplicantAssessmentQuestionsPlaceholder from "@/pages/ApplicantAssessmentQuestionsPlaceholder";
import ApplicantAssessmentComplete from "@/pages/ApplicantAssessmentComplete";
import ApplicantReviewPlaceholder from "@/pages/ApplicantReviewPlaceholder";
import ApplicantSubmitted from "@/pages/ApplicantSubmitted";
import AdminDashboard from "@/pages/AdminDashboard";
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
import AdminAssessmentPreview from "@/pages/AdminAssessmentPreview";
import AdminScreening from "@/pages/AdminScreening";
import ApplicantInformation from "@/pages/ApplicantInformation";
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

function Router() {
  return (
    <Switch>
      <Route component={Home} path="/" />
      <Route component={AdminLogin} path="/admin/login" />
      <Route component={AdminDashboard} path="/admin" />
      <Route component={AdminScreening} path="/admin/screening" />
      <Route component={AdminCandidatePlaceholder} path="/admin/applications/:candidateId" />
      <Route component={AdminApplications} path="/admin/applications" />
      <Route path="/admin/roles/new">{() => <AdminRoleForm />}</Route>
      <Route path="/admin/roles/:roleSlug/edit">{(params) => <AdminRoleForm roleSlug={params.roleSlug} />}</Route>
      <Route component={AdminRoleDetail} path="/admin/roles/:roleSlug" />
      <Route component={AdminRoles} path="/admin/roles" />
      <Route component={AdminAssessmentBuilder} path="/admin/assessments/:assessmentSlug/edit" />
      <Route component={AdminAssessmentPreview} path="/admin/assessments/business-development-officer-assessment-v2/preview" />
      <Route component={AdminAssessmentDetail} path="/admin/assessments/:assessmentSlug" />
      <Route component={AdminAssessments} path="/admin/assessments" />
      <Route path="/admin/questions/new">{() => <AdminQuestionForm />}</Route>
      <Route path="/admin/questions/:questionId/edit">{(params) => <AdminQuestionForm questionId={params.questionId} />}</Route>
      <Route component={AdminQuestionDetail} path="/admin/questions/:questionId" />
      <Route component={AdminQuestionBank} path="/admin/questions" />
      <Route path="/admin/settings">{() => <AdminPlaceholder title="Settings" />}</Route>
      <Route component={Apply} path="/apply" />
      <Route component={ApplicantInformation} path="/apply/business-development-officer" />
      <Route component={ApplicantEligibilityCloseout} path="/apply/business-development-officer/eligibility" />
      <Route path="/apply/business-development-officer/cv">{() => <ApplicantEligibilityGuard><ApplicantCvPlaceholder /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/business-development-officer/assessment">{() => <ApplicantEligibilityGuard><ApplicantAssessmentPlaceholder /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/business-development-officer/assessment/questions">{() => <ApplicantEligibilityGuard><ApplicantAssessmentQuestionsPlaceholder /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/business-development-officer/assessment/complete">{() => <ApplicantEligibilityGuard><ApplicantAssessmentComplete /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/business-development-officer/review">{() => <ApplicantEligibilityGuard><ApplicantReviewPlaceholder /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/business-development-officer/submitted">{() => <ApplicantEligibilityGuard><ApplicantSubmitted /></ApplicantEligibilityGuard>}</Route>
      <Route path="/apply/business-development-manager/assessment/complete"><Redirect to="/apply/business-development-officer/assessment/complete" /></Route>
      <Route path="/apply/business-development-manager/assessment/questions"><Redirect to="/apply/business-development-officer/assessment/questions" /></Route>
      <Route path="/apply/business-development-manager/assessment"><Redirect to="/apply/business-development-officer/assessment" /></Route>
      <Route path="/apply/business-development-manager/review"><Redirect to="/apply/business-development-officer/review" /></Route>
      <Route path="/apply/business-development-manager/submitted"><Redirect to="/apply/business-development-officer/submitted" /></Route>
      <Route path="/apply/business-development-manager/cv"><Redirect to="/apply/business-development-officer/cv" /></Route>
      <Route path="/apply/business-development-manager"><Redirect to="/apply/business-development-officer" /></Route>
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

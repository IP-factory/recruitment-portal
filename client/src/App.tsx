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
import ApplicantInformation from "@/pages/ApplicantInformation";
import Auth from "@/pages/Auth";
import AuthCreateAccount from "@/pages/AuthCreateAccount";
import AuthForgotPassword from "@/pages/AuthForgotPassword";
import AuthSignIn from "@/pages/AuthSignIn";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import Portal from "@/pages/Portal";
import UiKit from "@/pages/UiKit";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route component={Home} path="/" />
      <Route component={Apply} path="/apply" />
      <Route component={ApplicantInformation} path="/apply/business-development-manager" />
      <Route component={ApplicantCvPlaceholder} path="/apply/business-development-manager/cv" />
      <Route component={ApplicantAssessmentPlaceholder} path="/apply/business-development-manager/assessment" />
      <Route component={ApplicantAssessmentQuestionsPlaceholder} path="/apply/business-development-manager/assessment/questions" />
      <Route component={ApplicantAssessmentComplete} path="/apply/business-development-manager/assessment/complete" />
      <Route component={ApplicantReviewPlaceholder} path="/apply/business-development-manager/review" />
      <Route component={ApplicantSubmitted} path="/apply/business-development-manager/submitted" />
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

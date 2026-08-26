/** Quiet Authority routes: the internal UI-kit review and a visual-only portal shell. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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

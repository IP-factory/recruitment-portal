/** Quiet Authority auth entrypoint: redirect the legacy auth route to the applicant sign-in screen. */
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Auth() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/auth/sign-in"); }, [setLocation]);
  return null;
}

/**
 * Quiet Authority admin session: browser-only demo credentials and a temporary local session for previewing the admin interface.
 */
export const ADMIN_DEMO_EMAIL = "admin@gmail.com";
export const ADMIN_DEMO_PASSWORD = "123456";
export const ADMIN_SESSION_STORAGE_KEY = "recruitment-portal:admin-demo-session";

export function isAdminAuthenticated() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === "active";
}

export function signInAdmin(email: string, password: string) {
  const valid = email.trim().toLowerCase() === ADMIN_DEMO_EMAIL && password === ADMIN_DEMO_PASSWORD;
  if (valid && typeof window !== "undefined") window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, "active");
  return valid;
}

export function signOutAdmin() {
  if (typeof window !== "undefined") window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

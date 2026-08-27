/**
 * Quiet Authority admin shell: a structured, desktop-sidebar workspace that contracts into a deliberate mobile navigation drawer.
 */
import { AlignmentMark } from "@/components/foundation/navigation";
import { FoundationButton } from "@/components/foundation/ui";
import { isAdminAuthenticated, signOutAdmin } from "@/lib/adminSession";
import { BriefcaseBusiness, ClipboardList, FileText, LayoutDashboard, LibraryBig, ListChecks, LogOut, Menu, Settings, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const navigation = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Applications", href: "/admin/applications", icon: FileText },
  { label: "Screening", href: "/admin/screening", icon: ListChecks },
  { label: "Recruitment Roles", href: "/admin/roles", icon: BriefcaseBusiness },
  { label: "Assessments", href: "/admin/assessments", icon: ClipboardList },
  { label: "Question Bank", href: "/admin/questions", icon: LibraryBig },
] as const;

function BrandLockup() {
  return <div className="flex items-center gap-2.5 text-primary"><AlignmentMark /><div><p className="text-[15px] font-semibold tracking-[-0.02em]">Recruitment Portal</p><p className="mt-0.5 text-[12px] text-muted-foreground">Admin Workspace</p></div></div>;
}

function NavigationList({ location, navigate, close }: { location: string; navigate: (href: string) => void; close?: () => void }) {
  const itemClass = (href: string) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${(location === href || (["/admin/applications", "/admin/screening", "/admin/roles", "/admin/assessments", "/admin/questions"].includes(href) && location.startsWith(`${href}/`))) ? "bg-portal-blue-soft text-primary" : "text-muted-foreground hover:bg-portal-surface hover:text-primary"}`;
  return <nav className="space-y-1" aria-label="Admin navigation">{navigation.map((item) => { const Icon = item.icon; return <button className={itemClass(item.href)} key={item.href} onClick={() => { navigate(item.href); close?.(); }} type="button"><Icon className="size-[18px]" />{item.label}</button>; })}<div className="my-4 border-t border-border" /><button className={itemClass("/admin/settings")} onClick={() => { navigate("/admin/settings"); close?.(); }} type="button"><Settings className="size-[18px]" />Settings</button></nav>;
}

function ProfileBlock({ signOut }: { signOut: () => void }) {
  return <div className="border-t border-border pt-4"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">A</span><div className="min-w-0"><p className="text-sm font-semibold text-primary">Administrator</p><p className="truncate text-[12px] text-muted-foreground">admin@gmail.com</p></div></div><button className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary" onClick={signOut} type="button"><LogOut className="size-3.5" />Sign out</button></div>;
}

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [allowed, setAllowed] = useState(false);
  useEffect(() => { if (!isAdminAuthenticated()) setLocation("/admin/login"); else setAllowed(true); }, [setLocation]);
  const signOut = () => { signOutAdmin(); setLocation("/admin/login"); };
  if (!allowed) return null;
  return <div className="min-h-screen bg-portal-surface text-foreground lg:flex">
    <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-border bg-white p-5 lg:flex"><BrandLockup /><div className="mt-9 flex-1"><NavigationList location={location} navigate={setLocation} /></div><ProfileBlock signOut={signOut} /></aside>
    {menuOpen ? <><button aria-label="Close navigation drawer" className="fixed inset-0 z-40 bg-primary/20 lg:hidden" onClick={() => setMenuOpen(false)} type="button" /><aside className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-white p-5 shadow-[8px_0_24px_rgba(16,24,40,0.12)] lg:hidden"><div className="flex items-start justify-between"><BrandLockup /><button aria-label="Close navigation" className="rounded-md p-2 text-muted-foreground hover:bg-portal-surface hover:text-primary" onClick={() => setMenuOpen(false)} type="button"><X className="size-5" /></button></div><div className="mt-9 flex-1"><NavigationList close={() => setMenuOpen(false)} location={location} navigate={setLocation} /></div><ProfileBlock signOut={signOut} /></aside></> : null}
    <div className="min-w-0 flex-1"><header className="flex h-16 items-center justify-between border-b border-border bg-white px-4 sm:h-[68px] sm:px-6 lg:px-8"><div className="flex items-center gap-3"><button aria-label="Open navigation" className="rounded-md p-2 text-muted-foreground hover:bg-portal-surface hover:text-primary lg:hidden" onClick={() => setMenuOpen(true)} type="button"><Menu className="size-5" /></button><h1 className="text-base font-semibold text-primary">{title}</h1></div><span className="rounded-md bg-portal-blue-soft px-2.5 py-1 text-[12px] font-medium text-primary">Admin</span></header><main className="mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">{children}</main></div>
  </div>;
}

/**
 * Quiet Authority global shell: text-forward branding, fine rules, and restrained public navigation.
 */
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { FoundationButton } from "./ui";

const BRAND_NAME = "Xceptional by IPFactory";
const LOGO_SRC = "/IPF_logo_transparent_original_size.png";

/**
 * IPFactory logo mark. Falls back to the text brand name if the image fails
 * to load so the header/layout never breaks due to a missing asset.
 */
export function BrandLogo({ className = "" }: { className?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (imgFailed) {
    return (
      <span className={`text-[15px] font-semibold tracking-[-0.02em] text-primary ${className}`}>
        {BRAND_NAME}
      </span>
    );
  }
  return (
    <img
      alt={BRAND_NAME}
      className={`max-h-8 w-auto shrink-0 object-contain ${className}`}
      onError={() => setImgFailed(true)}
      src={LOGO_SRC}
    />
  );
}

export function AlignmentMark({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative block size-7 shrink-0 text-primary ${className}`}>
      <span className="absolute left-[3px] top-[3px] size-4 border-l-2 border-t-2 border-current" />
      <span className="absolute bottom-[3px] right-[3px] size-4 border-b-2 border-r-2 border-current" />
      <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 bg-current" />
    </span>
  );
}

const placeholder = (name: string) => toast.info(`${name} is a placeholder in the foundation preview.`);

export function PublicNavigation() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  return (
    <header className="border-b border-border bg-white">
      <div className="portal-container flex h-[72px] items-center justify-between">
        <a aria-label={`${BRAND_NAME} home`} className="flex items-center" href="/">
          <BrandLogo />
        </a>
        <nav aria-label="Public navigation" className="hidden items-center gap-6 md:flex">
          <a className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary" href="/">Home</a>
          <a className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary" href="/#how-it-works">How It Works</a>
          <FoundationButton onClick={() => setLocation("/apply")} size="md">Start Application</FoundationButton>
        </nav>
        <button aria-expanded={open} aria-label="Toggle navigation menu" className="rounded-lg p-2 text-primary hover:bg-portal-surface md:hidden" onClick={() => setOpen((value) => !value)} type="button">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-border bg-white px-4 py-3 shadow-[0_10px_20px_rgba(16,24,40,0.07)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-200 md:hidden">
          <nav aria-label="Mobile public navigation" className="portal-container flex flex-col gap-1 px-0">
            <a className="rounded-md px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-portal-surface" href="/" onClick={() => setOpen(false)}>Home</a>
            <a className="rounded-md px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-portal-surface" href="/#how-it-works" onClick={() => setOpen(false)}>How It Works</a>
            <FoundationButton className="mt-2 w-full" onClick={() => { setOpen(false); setLocation("/apply"); }}>Start Application</FoundationButton>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-portal-surface">
      <div className="portal-container py-12 sm:py-14">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BrandLogo className="max-h-7" />
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">A structured recruitment application and assessment platform.</p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-muted-foreground">
            {['Privacy', 'Terms', 'Contact'].map((item) => <button className="hover:text-primary" key={item} onClick={() => placeholder(item)} type="button">{item}</button>)}
          </nav>
        </div>
        <div className="mt-10 border-t border-border pt-5 text-[13px] text-muted-foreground">© 2026 {BRAND_NAME}. All rights reserved.</div>
      </div>
    </footer>
  );
}

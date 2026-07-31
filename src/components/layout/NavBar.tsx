'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/NotificationBell';

/**
 * `next/link` has no `exports` entry, so TypeScript resolves it to the Pages
 * Router declaration, which does not list the App Router's
 * `unstable_dynamicOnHover`. The component Next actually bundles for the App
 * Router does accept it - and strips it rather than passing it to the anchor -
 * so the prop is declared here instead of reaching into `next/dist`.
 */
const NavLink = Link as React.ComponentType<
  React.ComponentProps<typeof Link> & { unstable_dynamicOnHover?: boolean }
>;

/**
 * The crest, on a light tile.
 *
 * The artwork is a black silhouette on transparency, so it needs a pale
 * backdrop - dropped straight onto the navy header the hair disappears and only
 * the bandana is left floating.
 */
function Crest({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1',
        className,
      )}
    >
      <Image
        src="/logo.png"
        alt=""
        width={64}
        height={64}
        priority
        className="h-full w-full object-contain"
      />
    </span>
  );
}

/**
 * The five links do not fit beside the wordmark, the bell and the sign-out
 * button until roughly 660px of width, so `md` is where the inline row appears.
 * Below it the crest doubles as the menu button and the links move into a sheet.
 */
export function NavBar({
  nickname,
  isAdmin,
  statsHref,
}: {
  nickname: string;
  isAdmin: boolean;
  /**
   * Points straight at the signed-in user's own page. Linking to bare
   * `/statistika` cost a second server round trip, because that route does
   * nothing but look the user up and redirect here.
   */
  statsHref: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  const links = [
    { href: '/pocetna', label: 'Početna', match: '/pocetna' },
    { href: '/ljestvica', label: 'Ljestvica', match: '/ljestvica' },
    { href: '/povijest', label: 'Povijest', match: '/povijest' },
    { href: statsHref, label: 'Statistika', match: '/statistika' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', match: '/admin' }] : []),
  ];

  const isActive = (match: string) =>
    match === '/pocetna' ? pathname === match : pathname.startsWith(match);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-white/8 bg-navy-950/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3">
        {/*
          * Mobile: the crest IS the menu button. The caret is what tells you so -
          * a bare logo reads as a link home, not as something to tap open.
          */}
        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          aria-label={open ? 'Zatvori meni' : 'Otvori meni'}
          aria-expanded={open}
          aria-controls="glavni-meni"
          className="-ml-1 flex shrink-0 items-center gap-1 rounded-xl p-1 transition-colors hover:bg-white/5 md:hidden"
        >
          <Crest className="h-9 w-9" />
          <Caret open={open} />
        </button>

        {/* Wide screens: the crest goes back to being a link home. */}
        <Link href="/pocetna" className="hidden shrink-0 items-center gap-2.5 md:flex">
          <Crest className="h-9 w-9" />
          <span className="text-base font-black tracking-tight">HajPogodi</span>
        </Link>

        <nav
          aria-label="Glavni meni"
          className="ml-2 hidden min-w-0 flex-1 items-center gap-0.5 md:flex"
        >
          {links.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              /*
               * Every one of these pages is dynamic, so the default prefetch can
               * only fetch the loading skeleton. Hovering upgrades it to a full
               * prefetch, data and all, so the server round trip starts on
               * intent rather than on the click. Needs
               * `experimental.dynamicOnHover`, which is set in next.config.ts.
               */
              unstable_dynamicOnHover
              aria-current={isActive(link.match) ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(link.match)
                  ? 'bg-white/10 text-ink'
                  : 'text-ink-muted hover:bg-white/5 hover:text-ink',
              )}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Pushes the bell to the right edge once the inline nav is gone. */}
        <div className="flex-1 md:hidden" />

        {/*
          * `-mr-2.5` mirrors the `-ml-1` on the menu button. Both trailing
          * controls carry `px-2.5`, so without it the bell glyph sat 26px from
          * the right edge while the crest sat 16px from the left - the row read
          * as pushed to one side. Pulling the group out by exactly that padding
          * lands the glyph on 16px, the same gutter the page content uses.
          */}
        <div className="-mr-2.5 flex shrink-0 items-center gap-1 sm:gap-2">
          <NotificationBell />
          <span className="hidden text-sm text-ink-muted lg:block">{nickname}</span>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/prijava' })}
            className="hidden rounded-lg px-2.5 py-2 text-sm text-ink-muted transition-colors hover:bg-white/5 hover:text-ink md:block"
          >
            Odjava
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="glavni-meni"
          aria-label="Glavni meni"
          className="glass-strong absolute inset-x-0 top-full origin-top animate-[--animate-pop] border-t border-white/8 p-3 md:hidden"
        >
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            {nickname}
          </p>

          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <NavLink
                  href={link.href}
                  unstable_dynamicOnHover
                  /*
                   * Closes on the tap rather than when the navigation lands.
                   * The pages are dynamic and take a moment, but `loading.tsx`
                   * already covers that gap with a skeleton - keeping the sheet
                   * open over it would just hide the feedback.
                   */
                  onClick={() => setOpen(false)}
                  aria-current={isActive(link.match) ? 'page' : undefined}
                  className={cn(
                    // Full-width rows at 44px+ so they are thumb-sized rather
                    // than the desktop link's tap target.
                    'block rounded-xl px-3 py-3 text-base font-medium transition-colors',
                    isActive(link.match)
                      ? 'bg-hajduk-red/15 text-ink'
                      : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                  )}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/prijava' })}
            className="mt-1 block w-full rounded-xl border-t border-white/8 px-3 py-3 text-left text-base text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            Odjava
          </button>
        </nav>
      ) : null}
    </header>
  );
}

/** Points down when the sheet is shut, up when it is open. */
function Caret({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={cn(
        'h-3 w-3 text-ink-muted transition-transform duration-200',
        open && 'rotate-180',
      )}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

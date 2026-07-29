'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/NotificationBell';

const LINKS = [
  { href: '/pocetna', label: 'Početna' },
  { href: '/ljestvica', label: 'Ljestvica' },
  { href: '/povijest', label: 'Povijest' },
  { href: '/statistika', label: 'Statistika' },
] as const;

export function NavBar({
  nickname,
  isAdmin,
}: {
  nickname: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  const links = isAdmin ? [...LINKS, { href: '/admin', label: 'Admin' } as const] : LINKS;

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-navy-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/pocetna" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-hajduk-red text-lg font-black text-white">
            H
          </span>
          <span className="hidden text-base font-black tracking-tight sm:block">HajPogodi</span>
        </Link>

        <nav className="ml-2 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {links.map((link) => {
            const active =
              link.href === '/pocetna'
                ? pathname === link.href
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-white/10 text-ink' : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <span className="hidden text-sm text-ink-muted md:block">{nickname}</span>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/prijava' })}
            className="rounded-lg px-2.5 py-2 text-sm text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            Odjava
          </button>
        </div>
      </div>
    </header>
  );
}

import Link from 'next/link';
import { NavBar } from '@/components/layout/NavBar';
import { Providers } from '@/components/providers/Providers';
import { requirePageAdmin } from '@/infrastructure/auth/session';

const TABS = [
  { href: '/admin', label: 'Pregled' },
  { href: '/admin/utakmice', label: 'Utakmice' },
  { href: '/admin/korisnici', label: 'Korisnici' },
  { href: '/admin/prognoze', label: 'Prognoze' },
  { href: '/admin/sezone', label: 'Sezone' },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Authoritative admin check - middleware never inspected the role.
  const admin = await requirePageAdmin();

  return (
    <Providers>
      <div className="flex min-h-dvh flex-col">
        <NavBar nickname={admin.nickname} isAdmin />

        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
              Administracija
            </h1>
            <nav className="mt-3 flex flex-wrap gap-1.5">
              {TABS.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-white/8 hover:text-ink"
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>

          {children}
        </div>
      </div>
    </Providers>
  );
}

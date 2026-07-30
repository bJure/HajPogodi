import { NavBar } from '@/components/layout/NavBar';
import { Providers } from '@/components/providers/Providers';
import { requirePageUser } from '@/infrastructure/auth/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Authoritative check - middleware only redirected early for UX.
  const user = await requirePageUser();

  return (
    <Providers>
      <div className="flex min-h-dvh flex-col">
        <NavBar
          nickname={user.nickname}
          isAdmin={user.role === 'ADMIN'}
          statsHref={`/statistika/${user.id}`}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
        <footer className="border-t border-white/8 py-6 text-center text-xs text-ink-faint">
          HajPogodi · Bodovi ne lažu · Ajmo bijeli ale
        </footer>
      </div>
    </Providers>
  );
}

import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Prijava' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ nastavi?: string }>;
}) {
  const { nastavi } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-[--animate-fade-up]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-hajduk-red text-3xl font-black text-white shadow-xl shadow-hajduk-red/30">
            H
          </div>
          <h1 className="text-3xl font-black tracking-tight text-ink">HajPogodi</h1>
          <p className="mt-2 text-sm text-ink-muted text-balance">
            Prognoziraj točan rezultat Hajdukovih utakmica. Bodovi ne lažu.
          </p>
        </div>

        <Card strong>
          <LoginForm nastavi={nastavi ?? null} />
        </Card>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Račune otvara administrator. Nemaš pristup? Javi se njemu.
        </p>
      </div>
    </main>
  );
}

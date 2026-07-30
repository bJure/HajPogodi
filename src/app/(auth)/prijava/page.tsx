import type { Metadata } from 'next';
import Image from 'next/image';
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
          {/* Light tile for the same reason as the header crest: the artwork is
              a black silhouette and would vanish against the navy background. */}
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-xl shadow-hajduk-red/20">
            <Image
              src="/logo.png"
              alt="HajPogodi"
              width={128}
              height={128}
              priority
              className="h-full w-full object-contain"
            />
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

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="glass-strong w-full max-w-md rounded-[--radius-card] p-6 text-center">
        <p className="text-4xl">🧭</p>
        <h1 className="mt-3 text-xl font-bold text-ink">Ova stranica ne postoji</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Bolje ciljaj. Otprilike kao s tvojim prognozama.
        </p>

        <Link
          href="/pocetna"
          className="mt-5 inline-block rounded-xl bg-hajduk-red px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-hajduk-red-soft"
        >
          Natrag na početnu
        </Link>
      </div>
    </div>
  );
}

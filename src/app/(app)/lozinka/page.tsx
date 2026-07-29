import type { Metadata } from 'next';
import { Card, CardHeader } from '@/components/ui/Card';
import { requirePageUser } from '@/infrastructure/auth/session';
import { PasswordForm } from './PasswordForm';

export const metadata: Metadata = { title: 'Promjena lozinke' };

export default async function PasswordPage() {
  const user = await requirePageUser();

  return (
    <div className="mx-auto max-w-md animate-[--animate-fade-up]">
      <Card strong>
        <CardHeader
          title="Promjena lozinke"
          subtitle={
            user.mustChangePassword
              ? 'Obavezno prije nastavka.'
              : 'Odaberi novu lozinku za svoj račun.'
          }
        />
        <PasswordForm forced={user.mustChangePassword} />
      </Card>
    </div>
  );
}

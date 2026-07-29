import type { Metadata } from 'next';
import { listUsers } from '@/application/services/userService';
import { requirePageAdmin } from '@/infrastructure/auth/session';
import { UserManager } from './UserManager';

export const metadata: Metadata = { title: 'Korisnici' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const admin = await requirePageAdmin();
  const users = await listUsers();

  return <UserManager users={users} currentUserId={admin.id} />;
}

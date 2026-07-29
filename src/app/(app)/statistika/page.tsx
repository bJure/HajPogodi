import { redirect } from 'next/navigation';
import { requirePageUser } from '@/infrastructure/auth/session';

/** `/statistika` means "my statistics". */
export default async function MyStatsRedirect() {
  const user = await requirePageUser();
  redirect(`/statistika/${user.id}`);
}

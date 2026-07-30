import { NextResponse } from 'next/server';
import { pollHintFor } from '@/domain/match/pollHint';
import { withRoute } from '@/lib/api';
import { requireUser } from '@/infrastructure/auth/session';
import {
  matchRepository,
  seasonRepository,
} from '@/infrastructure/repositories/matchRepository';
import { notificationRepository } from '@/infrastructure/repositories/supportRepositories';

export const dynamic = 'force-dynamic';

const LIMIT = 15;

export async function GET() {
  return withRoute('live/obavijesti', async () => {
    const now = new Date();
    const [user, season] = await Promise.all([requireUser(), seasonRepository.findActive()]);

    const [items, unread, next] = await Promise.all([
      notificationRepository.listForUser(user.id, LIMIT),
      notificationRepository.countUnread(user.id),
      season ? matchRepository.findNextOpen(season.id, now) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        createdAt: item.createdAt.toISOString(),
        read: item.readAt !== null,
      })),
      unread,
      pollHint: pollHintFor(next?.kickoffAt ?? null, now),
    });
  });
}

/** Marks everything read - triggered when the user opens the panel. */
export async function POST() {
  return withRoute('live/obavijesti/read', async () => {
    const user = await requireUser();
    await notificationRepository.markAllRead(user.id);
    return NextResponse.json({ ok: true });
  });
}

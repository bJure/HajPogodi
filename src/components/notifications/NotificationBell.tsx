'use client';

import { useEffect, useRef, useState } from 'react';
import { useLiveData } from '@/components/live/useLiveData';
import type { PollHint } from '@/domain/match/pollHint';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

interface NotificationPayload {
  items: NotificationItem[];
  unread: number;
  pollHint: PollHint;
}

const ICONS: Record<string, string> = {
  MATCH_OPEN: '🆕',
  LOCK_SOON: '⏳',
  POINTS_READY: '🧮',
  ACHIEVEMENT: '🏅',
};

export function NotificationBell() {
  const { data, refresh } = useLiveData<NotificationPayload>('/api/live/obavijesti');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  async function toggle() {
    const next = !open;
    setOpen(next);
    // Opening the panel is the read receipt.
    if (next && unread > 0) {
      await fetch('/api/live/obavijesti', { method: 'POST' });
      refresh();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={unread > 0 ? `Obavijesti, ${unread} nepročitanih` : 'Obavijesti'}
        aria-expanded={open}
        className="relative rounded-lg px-2.5 py-2 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
      >
        <span aria-hidden className="text-lg">
          🔔
        </span>
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-hajduk-red px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="glass-strong absolute right-0 top-full z-50 mt-2 w-80 animate-[--animate-pop] rounded-2xl p-2">
          <p className="px-2.5 py-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Obavijesti
          </p>

          {items.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-sm text-ink-muted">
              Još ništa. Bit će kad krene kolo.
            </p>
          ) : (
            <ul className="max-h-80 space-y-0.5 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'rounded-xl px-2.5 py-2.5',
                    item.read ? 'opacity-60' : 'bg-white/5',
                  )}
                >
                  <div className="flex gap-2.5">
                    <span aria-hidden className="text-base leading-none">
                      {ICONS[item.type] ?? '•'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{item.title}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">{item.body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

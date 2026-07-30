'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { POLL_INTERVAL_MS, type PollHint } from '@/domain/match/pollHint';

/**
 * Schedule-aware polling.
 *
 * Replaces a websocket for this workload deliberately: Hajduk plays about twice
 * a week, so a permanently open connection would idle for days to deliver a
 * handful of updates. Instead the server tells us how fast to poll via
 * `pollHint`, we go quiet when the tab is hidden, and we refetch instantly on
 * focus or reconnect - which is when a user would otherwise notice stale data.
 */
export interface LivePayload {
  readonly pollHint?: PollHint;
}

export interface LiveState<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly isLoading: boolean;
  readonly refresh: () => void;
}

export function useLiveData<T extends LivePayload>(url: string, initial: T | null = null): LiveState<T> {
  const [data, setData] = useState<T | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(initial === null);

  const intervalRef = useRef<number>(initial?.pollHint?.intervalMs ?? POLL_INTERVAL_MS.idle);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Guards against a slow response from a previous url overwriting a newer one.
  const requestIdRef = useRef(0);
  // Only the very first poll may be skipped; a later url change must fetch.
  const skipFirstFetch = useRef(initial !== null);

  const fetchNow = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = (await response.json()) as T;
      if (requestId !== requestIdRef.current) return;

      setData(payload);
      setError(null);
      intervalRef.current = payload.pollHint?.intervalMs ?? POLL_INTERVAL_MS.idle;
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (requestId !== requestIdRef.current) return;
      setError(cause instanceof Error ? cause.message : 'Greška pri dohvaćanju podataka');
      // Back off to the slowest cadence so a broken endpoint is not hammered.
      intervalRef.current = POLL_INTERVAL_MS.idle;
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    let cancelled = false;

    const schedule = (delay: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (cancelled) return;
        if (document.visibilityState === 'visible') await fetchNow();
        schedule(intervalRef.current);
      }, delay);
    };

    /*
     * When the server already rendered a payload into the page, the first poll
     * waits for the normal interval instead of firing on mount. Fetching
     * immediately re-ran the exact same database work a second time for every
     * page load - two extra requests on the home page alone, competing with the
     * page's own queries for the connection pool - and replaced the data with an
     * identical copy.
     *
     * Without server data there is nothing to show, so that case still starts
     * at once. The fetch goes through the timer rather than running inline
     * because starting an update synchronously in the effect body would trigger
     * a cascading render, and a zero-delay timeout is equivalent in practice.
     */
    schedule(skipFirstFetch.current ? intervalRef.current : 0);
    skipFirstFetch.current = false;

    const onWake = () => {
      if (document.visibilityState !== 'visible') return;
      schedule(0);
    };

    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
    };
  }, [fetchNow]);

  const refresh = useCallback(() => {
    void fetchNow();
  }, [fetchNow]);

  return { data, error, isLoading, refresh };
}

import { useEffect } from 'react';

const LAST_CHECK_KEY = 'sw_last_update_check';

function wasCheckedToday(): boolean {
  const raw = localStorage.getItem(LAST_CHECK_KEY);
  if (!raw) return false;
  const lastCheck = new Date(parseInt(raw, 10));
  const now = new Date();
  return lastCheck.toDateString() === now.toDateString();
}

async function doUpdateCheck(): Promise<void> {
  try {
    if (!navigator.serviceWorker) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    await reg.update();
    localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
  } catch {
    // Update-check mislukt (bijv. offline) — stilletjes negeren
  }
}

function msUntilNext19(): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(19, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

export function useSwUpdateCheck(): void {
  useEffect(() => {
    // Bij opstarten: als de 19:00-check vandaag nog niet is uitgevoerd, doe het nu
    if (!wasCheckedToday()) {
      doUpdateCheck();
    }

    // Elke dag om 19:00 een update-check plannen
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      doUpdateCheck();
      intervalId = setInterval(doUpdateCheck, 24 * 60 * 60 * 1000);
    }, msUntilNext19());

    return () => {
      clearTimeout(timeoutId);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, []);
}

import { useState, useEffect, useCallback } from 'react';

type ThemePref = 'light' | 'dark' | 'auto';

const SEOUL = { lat: 37.5665, lng: 126.9780 };

async function fetchSunTimes(lat: number, lng: number): Promise<{ sunrise: Date; sunset: Date } | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(
      `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${today}&formatted=0`,
      { cache: 'default' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK') return null;
    return {
      sunrise: new Date(data.results.sunrise),
      sunset: new Date(data.results.sunset),
    };
  } catch {
    return null;
  }
}

function isDaytime(sunrise: Date, sunset: Date): boolean {
  const now = Date.now();
  return now >= sunrise.getTime() && now < sunset.getTime();
}

async function resolveAutoDark(): Promise<boolean> {
  const coords = await new Promise<{ lat: number; lng: number }>((resolve) => {
    if (!navigator.geolocation) {
      resolve(SEOUL);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(SEOUL),
      { timeout: 4000 }
    );
  });

  const sun = await fetchSunTimes(coords.lat, coords.lng);
  if (!sun) {
    // Fallback: dark between 19:00 and 07:00 KST
    const kstHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();
    return kstHour >= 19 || kstHour < 7;
  }
  return !isDaytime(sun.sunrise, sun.sunset);
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => {
    const stored = localStorage.getItem('theme') as ThemePref | null;
    if (stored === 'dark' || stored === 'light' || stored === 'auto') return stored;
    return 'auto';
  });

  const [isDark, setIsDark] = useState(() => {
    // Synchronous initial guess while async resolves
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Resolve auto theme asynchronously
  useEffect(() => {
    if (pref !== 'auto') return;
    let cancelled = false;
    resolveAutoDark().then((dark) => {
      if (!cancelled) setIsDark(dark);
    });
    return () => { cancelled = true; };
  }, [pref]);

  // Apply to DOM
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
  }, [isDark]);

  // Persist pref
  useEffect(() => {
    localStorage.setItem('theme', pref);
    if (pref !== 'auto') setIsDark(pref === 'dark');
  }, [pref]);

  const toggle = useCallback(() => {
    // Manual toggle → lock to opposite of current
    setPref(isDark ? 'light' : 'dark');
  }, [isDark]);

  const setAuto = useCallback(() => {
    setPref('auto');
  }, []);

  return { isDark, isAuto: pref === 'auto', toggle, setAuto };
}

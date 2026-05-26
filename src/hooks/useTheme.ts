import { useState, useEffect, useCallback, useRef } from 'react';

const SEOUL = { lat: 37.5665, lng: 126.9780 };
const RECHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

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
  const sr = sunrise.getTime();
  const ss = sunset.getTime();
  // The API returns sunrise/sunset for a UTC calendar date. For locations far
  // east of UTC (e.g. KST, UTC+9) those two instants are "crossed" (sunrise >
  // sunset), so daytime is everything outside the night window [sunset, sunrise).
  if (sr <= ss) return now >= sr && now < ss;
  return now < ss || now >= sr;
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
    const kstHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();
    return kstHour >= 19 || kstHour < 7;
  }
  return !isDaytime(sun.sunrise, sun.sunset);
}

export function useTheme() {
  const [isDark, setIsDark] = useState(false);
  // null = following auto, boolean = active manual override
  const overrideRef = useRef<boolean | null>(null);
  // last auto-resolved value, used to detect a real sunrise/sunset transition
  const lastAutoRef = useRef<boolean | null>(null);

  const applyAuto = useCallback(() => {
    resolveAutoDark().then((dark) => {
      const prevAuto = lastAutoRef.current;
      lastAutoRef.current = dark;
      if (overrideRef.current === null) {
        // Following auto.
        setIsDark(dark);
        return;
      }
      // A manual override is active: keep it until the auto state actually
      // flips (a sunrise/sunset boundary is crossed), then hand back to auto.
      if (prevAuto !== null && prevAuto !== dark) {
        overrideRef.current = null;
        setIsDark(dark);
      }
    });
  }, []);

  // Initial resolve + hourly recheck
  useEffect(() => {
    applyAuto();
    const id = setInterval(applyAuto, RECHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [applyAuto]);

  // Apply to DOM
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      overrideRef.current = next;
      return next;
    });
  }, []);

  return { isDark, toggle };
}

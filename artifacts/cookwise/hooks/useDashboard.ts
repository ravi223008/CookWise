/**
 * useDashboard
 *
 * Provides live-updating context data for the AI Daily Dashboard:
 *   - Current time (refreshed every 30 s)
 *   - Dinner countdown (target: 7 PM local)
 *   - Current weather via Open-Meteo (free, no API key) + browser / expo-location
 *
 * All values are read-only; no side effects beyond the interval and a single
 * weather fetch on mount.
 */

import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

// ── Weather ───────────────────────────────────────────────────────────────────

export interface WeatherInfo {
  emoji: string;
  label: string;
  tempC: number;
}

function wmoToInfo(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "Clear" };
  if (code <= 2) return { emoji: "⛅", label: "Partly cloudy" };
  if (code === 3) return { emoji: "☁️", label: "Overcast" };
  if (code <= 49) return { emoji: "🌫️", label: "Foggy" };
  if (code <= 59) return { emoji: "🌦️", label: "Drizzle" };
  if (code <= 69) return { emoji: "🌧️", label: "Rainy" };
  if (code <= 79) return { emoji: "❄️", label: "Snowy" };
  if (code <= 82) return { emoji: "🌧️", label: "Showers" };
  if (code <= 86) return { emoji: "🌨️", label: "Snow showers" };
  return { emoji: "⛈️", label: "Thunderstorm" };
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Minutes until the next 7 PM dinner slot. */
function minutesToDinner(now: Date): number {
  const target = new Date(now);
  target.setHours(19, 0, 0, 0);
  if (now >= target) target.setDate(target.getDate() + 1);
  return Math.max(0, Math.floor((target.getTime() - now.getTime()) / 60_000));
}

function formatCountdown(mins: number): string {
  if (mins === 0) return "Dinner time!";
  if (mins < 60) return `${mins}m to dinner`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h to dinner` : `${h}h ${m}m`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface DashboardInfo {
  now: Date;
  timeLabel: string;
  dinnerCountdown: string;
  /** null while fetching or if unavailable */
  weather: WeatherInfo | null;
  weatherLoading: boolean;
}

export function useDashboard(): DashboardInfo {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // ── Live clock — tick every 30 s ──
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Weather — fetch once per mount; abort on unmount / Strict Mode cleanup ──
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        let lat: number, lon: number;

        if (Platform.OS === "web") {
          // Web: use the browser Geolocation API
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator?.geolocation) {
              reject(new Error("Geolocation unavailable"));
              return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 6_000,
              maximumAge: 10 * 60_000,
            });
          });
          // If aborted while awaiting geolocation, bail out.
          if (controller.signal.aborted) return;
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
        } else {
          // Native: use expo-location
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (controller.signal.aborted) return;
          if (status !== "granted") {
            setWeatherLoading(false);
            return;
          }
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
          if (controller.signal.aborted) return;
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
        }

        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
          `&current=temperature_2m,weathercode&temperature_unit=celsius`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Weather fetch failed");
        const data = (await res.json()) as {
          current: { temperature_2m: number; weathercode: number };
        };
        const { emoji, label } = wmoToInfo(data.current.weathercode);
        setWeather({ emoji, label, tempC: Math.round(data.current.temperature_2m) });
      } catch (err: unknown) {
        // Suppress abort errors (cleanup / Strict Mode); fail silently otherwise.
        if (err instanceof Error && err.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setWeatherLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  const mins = minutesToDinner(now);

  return {
    now,
    timeLabel: formatTime(now),
    dinnerCountdown: formatCountdown(mins),
    weather,
    weatherLoading,
  };
}

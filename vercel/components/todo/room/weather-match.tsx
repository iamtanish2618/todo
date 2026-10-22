"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CloudSun, Loader2 } from "lucide-react";
import { timeWeather, type RoomWeather } from "./cinema-config";

/** Explicit opt-in, coarse coordinates, one request. No location is stored or sent to Todo. */
export function WeatherMatch({
  scene,
  sceneVersion,
  onChoose,
}: {
  scene: RoomWeather;
  sceneVersion: number;
  onChoose: (weather: RoomWeather) => void;
}) {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const request = useRef(0),
    abort = useRef<AbortController | null>(null),
    cache = useRef<{ at: number; weather: RoomWeather } | null>(null);
  useEffect(() => {
    request.current++;
    abort.current?.abort();
    setBusy(false);
  }, [scene, sceneVersion]);
  useEffect(
    () => () => {
      request.current++;
      abort.current?.abort();
    },
    [],
  );
  const match = () => {
    if (busy) return;
    if (cache.current && Date.now() - cache.current.at < 900000) {
      onChoose(cache.current.weather);
      setNotice("Using recent local weather.");
      return;
    }
    if (!navigator.geolocation) {
      setNotice("Location isn’t available. Your scene stays as it is.");
      return;
    }
    const id = ++request.current;
    setBusy(true);
    setNotice("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (request.current !== id) return;
        const controller = new AbortController();
        abort.current = controller;
        const latitude = (
            Math.round(position.coords.latitude * 10) / 10
          ).toFixed(1),
          longitude = (Math.round(position.coords.longitude * 10) / 10).toFixed(
            1,
          );
        const timeout = setTimeout(() => controller.abort(), 8000);
        void fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=weather_code,is_day&forecast_days=1`,
          {
            signal: controller.signal,
            credentials: "omit",
            referrerPolicy: "no-referrer",
          },
        )
          .then((response) => {
            if (!response.ok) throw new Error("Weather unavailable");
            return response.json() as Promise<{
              current?: { weather_code?: number; is_day?: number };
            }>;
          })
          .then((data) => {
            if (request.current !== id) return;
            const code = data.current?.weather_code;
            if (
              typeof code !== "number" ||
              typeof data.current?.is_day !== "number"
            )
              throw new Error("No current weather");
            const weather: RoomWeather =
              (code >= 71 && code <= 77) || code === 85 || code === 86
                ? "snow"
                : (code >= 51 && code <= 67) || code >= 80
                  ? "rain"
                  : data.current.is_day
                    ? timeWeather() === "sunset"
                      ? "sunset"
                      : "morning"
                    : "night";
            cache.current = { at: Date.now(), weather };
            setBusy(false);
            setNotice("Your window matches the weather nearby.");
            onChoose(weather);
          })
          .catch(() => {
            if (request.current === id) {
              setBusy(false);
              setNotice("Weather couldn’t load. Your scene stays as it is.");
            }
          })
          .finally(() => clearTimeout(timeout));
      },
      () => {
        if (request.current === id) {
          setBusy(false);
          setNotice("No problem. Choose any scene you like.");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 900000 },
    );
  };
  return (
    <details className="cinema-weather-match">
      <summary>Weather nearby</summary>
      <p>
        Optional: share a rounded location with{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>{" "}
        once. Location isn’t saved.
      </p>
      <Button variant="outline" disabled={busy} onClick={match}>
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <CloudSun size={13} />
        )}
        Use local weather
      </Button>
      {notice ? <p role="status">{notice}</p> : null}
    </details>
  );
}

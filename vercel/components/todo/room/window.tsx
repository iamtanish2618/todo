import { useId } from "react";
import { ROOM_CONFIG as C } from "./config";
import type { RoomWeather } from "./cinema-config";

/** Clip only the four glass panes. Woodwork stays registered to the original artwork. */
export function RoomWindow({
  sky,
  weather,
}: {
  sky: "day" | "night" | "evening";
  weather: RoomWeather;
}) {
  const id = `glass-${useId().replace(/:/g, "")}`;
  return (
    <>
      <svg className="room-glass-defs" width="0" height="0" aria-hidden="true">
        <defs>
          <clipPath id={id} clipPathUnits="objectBoundingBox">
            <path d="M.273 .269V.211C.273 .149 .324 .09 .395 .077V.269Z" />
            <path d="M.408 .077C.48 .081 .529 .148 .531 .211V.269H.408Z" />
            <path d="M.273 .287H.395V.423H.273Z" />
            <path d="M.408 .287H.531V.423H.408Z" />
          </clipPath>
        </defs>
      </svg>
      <div
        className="room-window-world"
        data-sky={sky}
        data-weather={weather}
        style={{ clipPath: `url(#${id})` }}
        role="img"
        aria-label={
          weather === "snow"
            ? "Snow falling outside"
            : weather === "sunset"
              ? "A soft sunset outside"
              : sky === "day"
                ? "A sunny morning outside"
                : sky === "evening"
                  ? "A rainy evening outside"
                  : "A moonlit night outside"
        }
      >
        <img
          className="room-morning-sky"
          src={C.dayImage}
          width={1536}
          height={1024}
          alt=""
          aria-hidden="true"
        />
        <img
          className="room-evening-sky"
          src={C.eveningImage}
          width={1536}
          height={1024}
          alt=""
          aria-hidden="true"
        />
        <div className="cinema-sunset-sky" />
        <div className="cinema-snow-sky" />
        <div className="cinema-window-reflection" />
        <div className="cinema-window-frost" />
        <div className="window-rain-haze" />
      </div>
      <div
        className="room-morning-light"
        data-morning={sky === "day"}
        aria-hidden="true"
      />
    </>
  );
}

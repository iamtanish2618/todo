import { useId } from "react";
import { ROOM_CONFIG as C } from "./config";

/** Clip only the four glass panes. Woodwork stays registered to the original artwork. */
export function RoomWindow({ sky }: { sky: "day" | "night" | "evening" }) {
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
        style={{ clipPath: `url(#${id})` }}
        role="img"
        aria-label={
          sky === "day"
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
        <div className="window-rain-haze" />
        <div className="window-rain-drops" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37 + 7) % 100}%`,
                animationDelay: `${i * -0.61}s`,
                animationDuration: `${2.8 + (i % 6) * 0.37}s`,
                height: `${5 + (i % 4) * 2}px`,
              }}
            />
          ))}
        </div>
        <div className="window-rain-beads" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 31 + 13) % 100}%`,
                top: `${(i * 23 + 9) % 78}%`,
                animationDelay: `${i * -1.7}s`,
                animationDuration: `${10 + i * 0.7}s`,
              }}
            />
          ))}
        </div>
      </div>
      <div
        className="room-morning-light"
        data-morning={sky === "day"}
        aria-hidden="true"
      />
    </>
  );
}

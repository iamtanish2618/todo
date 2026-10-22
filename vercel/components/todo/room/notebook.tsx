import { useId } from "react";

/** Curved paper, stacked page edges and a cloth cover share the tabletop perspective. */
export function DeskNotebook() {
  const id = useId().replace(/:/g, "");
  return (
    <div className="desk-book" aria-hidden="true">
      <span className="cinema-turning-page">
        <i />
      </span>
      <svg viewBox="0 0 360 140">
        <defs>
          <linearGradient id={`${id}-paper`} x1="0" y1="0" x2=".2" y2="1">
            <stop stopColor="#fff7df" />
            <stop offset="1" stopColor="#e7dbc0" />
          </linearGradient>
          <linearGradient id={`${id}-left`}>
            <stop stopColor="#f5ead0" />
            <stop offset=".75" stopColor="#fff8e8" />
            <stop offset="1" stopColor="#baa98b" />
          </linearGradient>
          <linearGradient id={`${id}-right`}>
            <stop stopColor="#b9a98e" />
            <stop offset=".1" stopColor="#efe3cb" />
            <stop offset=".65" stopColor="#fff8e5" />
            <stop offset="1" stopColor="#e8dbbd" />
          </linearGradient>
          <radialGradient id={`${id}-shadow`}>
            <stop stopColor="#332115" stopOpacity=".32" />
            <stop offset="1" stopColor="#332115" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse
          cx="184"
          cy="118"
          rx="173"
          ry="19"
          fill={`url(#${id}-shadow)`}
        />
        <path d="M29 26L177 36L327 24L351 115L188 131L14 114Z" fill="#657871" />
        <path
          d="M25 29Q101 12 179 32Q255 9 329 27L346 108L188 125L18 108Z"
          fill="#c5b69a"
        />
        <path
          d="M20 105Q96 98 186 119Q265 102 346 105L346 111Q263 108 188 126Q94 104 18 111Z"
          fill="#d7c8aa"
        />
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M20 ${106 + i * 2}Q101 ${100 + i * 2} 187 ${121 + i * 2}Q267 ${104 + i * 2} 346 ${107 + i * 2}`}
            stroke="#998b74"
            strokeOpacity=".28"
            strokeWidth=".7"
            fill="none"
          />
        ))}
        <path
          d="M30 21Q108 5 179 30L187 117Q103 96 19 105Z"
          fill={`url(#${id}-left)`}
        />
        <path
          d="M179 30Q253 9 327 20L346 105Q264 99 187 117Z"
          fill={`url(#${id}-right)`}
        />
        <path
          d="M31 21Q112 8 179 30Q253 12 327 20"
          fill="none"
          stroke="#fffdf1"
          strokeWidth="2"
        />
        <path
          d="M179 31L187 115"
          fill="none"
          stroke="#a89980"
          strokeWidth="1.3"
        />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g
            key={i}
            stroke="#acaa97"
            strokeWidth=".65"
            strokeOpacity=".34"
            fill="none"
          >
            <path
              d={`M43 ${39 + i * 10}Q103 ${30 + i * 10} ${166 + i} ${46 + i * 10}`}
            />
            <path
              d={`M201 ${45 + i * 10}Q258 ${29 + i * 10} ${316 + i * 2} ${38 + i * 10}`}
            />
          </g>
        ))}
        <g
          className="desk-book-ink"
          stroke="#776c57"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity=".5"
          fill="none"
        >
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              className="desk-ink-line"
              style={{ animationDelay: `${i * 5}s` }}
              d={`M48 ${44 + i * 11}q4 -4 7 0t8 0q3 -5 6 0t7 0m5 0q4 -5 7 0t8 0t7 0m5 0q4 -4 7 0t8 0t7 0m5 0q4 -3 7 0t7 0`}
            />
          ))}
        </g>
        <path
          d="M182 114L181 135L190 130L194 134L190 116"
          fill="#c68b6c"
          opacity=".8"
        />
        <path
          d="M188 118Q261 102 344 105"
          fill="none"
          stroke="#fff8e4"
          strokeWidth="1.4"
        />
      </svg>
    </div>
  );
}

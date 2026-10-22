import { useId } from "react";

/** Glazed stoneware with an elliptical rim, inset coffee, and a weighted foot. */
export function CeramicMug({ held = false }: { held?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="room-ceramic-mug" viewBox="0 0 120 128" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-glaze`} x1="0" x2="1">
          <stop stopColor="#817e71" />
          <stop offset=".18" stopColor="#c9c5b7" />
          <stop offset=".42" stopColor="#f1ede1" />
          <stop offset=".72" stopColor="#d8d3c3" />
          <stop offset="1" stopColor="#a39d8d" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fcf7e8" />
          <stop offset="1" stopColor="#afa893" />
        </linearGradient>
        <radialGradient id={`${id}-coffee`}>
          <stop stopColor="#574031" />
          <stop offset=".7" stopColor="#382820" />
          <stop offset="1" stopColor="#201b17" />
        </radialGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop stopColor="#291d15" stopOpacity=".27" />
          <stop offset="1" stopColor="#291d15" stopOpacity="0" />
        </radialGradient>
      </defs>
      {!held ? (
        <g className="ceramic-saucer">
          <ellipse
            cx="53"
            cy="114"
            rx="49"
            ry="11"
            fill={`url(#${id}-shadow)`}
          />
          <ellipse cx="53" cy="107" rx="45" ry="10" fill="#c3bdac" />
          <ellipse cx="53" cy="104" rx="45" ry="9" fill="#e3dece" />
          <ellipse
            cx="53"
            cy="104"
            rx="30"
            ry="5.5"
            fill="#bdb5a0"
            opacity=".45"
          />
        </g>
      ) : null}
      <g className="ceramic-vessel">
        <path
          d="M85 42C118 34 122 84 88 87"
          fill="none"
          stroke="#928b7b"
          strokeWidth="10"
        />
        <path
          d="M85 40C114 35 120 79 88 83"
          fill="none"
          stroke="#ddd7c6"
          strokeWidth="7"
        />
        <path
          d="M18 31L23 91C26 108 79 108 84 91L89 31Z"
          fill={`url(#${id}-glaze)`}
        />
        <path
          d="M26 90C35 97 71 99 81 90L80 98C67 108 37 106 27 98Z"
          fill="#9c9582"
          opacity=".38"
        />
        <ellipse cx="53.5" cy="32" rx="35.5" ry="12" fill={`url(#${id}-rim)`} />
        <ellipse cx="53.5" cy="32" rx="29" ry="8" fill="#aaa18b" />
        <ellipse
          cx="53.5"
          cy="34"
          rx="28"
          ry="6.8"
          fill={`url(#${id}-coffee)`}
        />
        <path
          d="M28 31C35 26 67 25 79 31"
          fill="none"
          stroke="#fff9df"
          strokeWidth="1.1"
          opacity=".65"
        />
        <path
          d="M33 48L35 82"
          stroke="#fffdf1"
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".26"
        />
        <path
          d="M24 40C38 46 71 46 84 40"
          fill="none"
          stroke="#fff9ea"
          strokeWidth=".8"
          opacity=".4"
        />
      </g>
    </svg>
  );
}

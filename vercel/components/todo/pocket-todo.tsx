import { Heart } from "lucide-react";

export function PocketTodo({
  female,
  happy,
}: {
  female: boolean;
  happy: boolean;
}) {
  return (
    <div
      className={`pocket-todo ${happy ? "pocket-happy" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 112" fill="none">
        <ellipse cx="50" cy="105" rx="28" ry="4" fill="#654f34" opacity=".09" />
        <path
          d="M20 65C8 62 7 81 15 87L26 80M80 65C92 62 93 81 85 87L74 80"
          fill="#42474a"
        />
        <ellipse cx="50" cy="66" rx="33" ry="38" fill="#353b3e" />
        <path
          d="M25 59C25 39 43 39 50 49C57 39 75 39 75 59V79C75 101 25 101 25 79Z"
          fill="#fff8ec"
        />
        <ellipse cx="38" cy="61" rx="4" ry={happy ? 1.6 : 5} fill="#263238" />
        <ellipse cx="62" cy="61" rx="4" ry={happy ? 1.6 : 5} fill="#263238" />
        <path
          d={happy ? "M44 72Q50 83 56 72Z" : "M44 72Q50 66 56 72Q50 79 44 72Z"}
          fill="#e3a15d"
        />
        <ellipse
          cx="29"
          cy="72"
          rx="6"
          ry="3"
          fill="#e9a8a9"
          opacity={happy ? 0.9 : 0.5}
        />
        <ellipse
          cx="71"
          cy="72"
          rx="6"
          ry="3"
          fill="#e9a8a9"
          opacity={happy ? 0.9 : 0.5}
        />
        <path
          d="M21 42Q21 12 50 12Q79 12 79 42"
          fill={female ? "#d9a4b8" : "#a4bccd"}
        />
        <rect
          x="18"
          y="34"
          width="64"
          height="12"
          rx="6"
          fill={female ? "#e9bdcc" : "#c2d6e1"}
        />
        <circle cx="50" cy="12" r="9" fill="#fffaf3" />
        <path
          d="M22 85Q50 96 78 85"
          stroke={female ? "#d9a4b8" : "#a4bccd"}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M65 89L67 104"
          stroke={female ? "#d9a4b8" : "#a4bccd"}
          strokeWidth="11"
          strokeLinecap="round"
        />
      </svg>
      {happy ? (
        <Heart className="pocket-heart" size={17} fill="currentColor" />
      ) : null}
    </div>
  );
}

import { useId } from "react";
/** Attached shoulder pivots keep the rounded flippers connected during each stroke or sip. */
export function WorkingFlippers({ pose }: { pose: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className="todo-flipper-rig"
      viewBox="0 0 1536 1024"
      aria-hidden="true"
      data-action={pose}
    >
      <defs>
        <linearGradient id={`${id}-fur`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#625b54" />
          <stop offset=".5" stopColor="#413d39" />
          <stop offset="1" stopColor="#2e2d2a" />
        </linearGradient>
        <linearGradient id={`${id}-cup`}>
          <stop stopColor="#c8c8b5" />
          <stop offset=".4" stopColor="#fff8dd" />
          <stop offset=".8" stopColor="#e9e3cc" />
          <stop offset="1" stopColor="#bebda9" />
        </linearGradient>
        <pattern
          id={`${id}-fur-lines`}
          width="64"
          height="64"
          patternUnits="userSpaceOnUse"
        >
          <image
            href="/art/room-todo-idle.png"
            x="-180"
            y="-525"
            width="768"
            height="768"
            preserveAspectRatio="none"
          />
        </pattern>
      </defs>
      <g className="todo-writing-rig">
        <g className="todo-write-left">
          <path
            d="M651 509Q636 515 642 535Q657 561 683 583Q701 594 714 578Q722 567 707 553L679 521Q663 506 651 509Z"
            fill={`url(#${id}-fur)`}
          />
          <path
            d="M651 509Q636 515 642 535Q657 561 683 583Q701 594 714 578Q722 567 707 553L679 521Q663 506 651 509Z"
            fill={`url(#${id}-fur-lines)`}
            opacity=".6"
          />
          <g className="todo-held-pencil">
            <path d="M685 551L690 548L725 600L720 603Z" fill="#e2b452" />
            <path d="M690 548L692 551L725 600L723 601Z" fill="#ffe1a0" />
            <path d="M720 603L725 600L727 610Z" fill="#dbc39a" />
            <path d="M725 605L727 610L723 607Z" fill="#50463a" />
            <path
              d="M685 551L681 545Q682 540 686 541L690 548Z"
              fill="#cb8d83"
            />
          </g>
          <path
            d="M682 557Q700 549 709 565Q711 579 699 582Q687 579 682 570Z"
            fill={`url(#${id}-fur)`}
          />
          <path
            d="M682 557Q700 549 709 565Q711 579 699 582Q687 579 682 570Z"
            fill={`url(#${id}-fur-lines)`}
            opacity=".6"
          />
        </g>
        <g className="todo-write-right">
          <path
            d="M863 510Q879 516 871 538L849 582Q840 602 822 595Q811 589 819 573L838 528Q847 508 863 510Z"
            fill={`url(#${id}-fur)`}
          />
          <path
            d="M863 510Q879 516 871 538L849 582Q840 602 822 595Q811 589 819 573L838 528Q847 508 863 510Z"
            fill={`url(#${id}-fur-lines)`}
            opacity=".6"
          />
        </g>
      </g>
      <g className="todo-coffee-rig">
        <g className="todo-sip-left">
          <path
            d="M652 511Q638 529 659 546L716 558Q739 565 747 546Q750 536 732 530L681 517Q662 505 652 511Z"
            fill={`url(#${id}-fur)`}
          />

          <path
            d="M652 511Q638 529 659 546L716 558Q739 565 747 546Q750 536 732 530L681 517Q662 505 652 511Z"
            fill={`url(#${id}-fur-lines)`}
            opacity=".6"
          />
        </g>
        <g className="todo-sip-right">
          <path
            d="M863 511Q878 527 861 543L812 559Q791 567 783 546Q780 536 796 529L838 515Q856 505 863 511Z"
            fill={`url(#${id}-fur)`}
          />

          <path
            d="M863 511Q878 527 861 543L812 559Q791 567 783 546Q780 536 796 529L838 515Q856 505 863 511Z"
            fill={`url(#${id}-fur-lines)`}
            opacity=".6"
          />
        </g>
        <g className="todo-sip-cup">
          <path
            d="M788 521Q820 516 820 539Q820 557 791 553"
            fill="none"
            stroke="#d9d5bd"
            strokeWidth="9"
          />
          <path
            d="M729 512L735 561Q761 580 789 560L796 512Z"
            fill={`url(#${id}-cup)`}
          />
          <ellipse cx="762" cy="513" rx="34" ry="11" fill="#fff9e5" />
          <ellipse cx="762" cy="513" rx="28" ry="7" fill="#5d4733" />
          <path
            className="todo-cup-steam steam-a"
            d="M753 491Q745 480 753 467"
            stroke="#fff4d5"
            strokeWidth="1.6"
            fill="none"
            opacity=".35"
          />
          <path
            className="todo-cup-steam steam-b"
            d="M770 492Q780 477 771 462"
            stroke="#fff4d5"
            strokeWidth="1.4"
            fill="none"
            opacity=".3"
          />
        </g>
      </g>
    </svg>
  );
}

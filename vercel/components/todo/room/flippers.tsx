import { useId } from "react";
import { CeramicMug } from "./mug";
import { ROOM_CONFIG as C } from "./config";
/** Attached shoulder pivots keep the rounded flippers connected during each stroke or sip. */
export function WorkingFlippers({
  pose,
  female,
}: {
  pose: string;
  female: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const furSource = female
    ? C.focusedPose.replace(".png", "-pink.png")
    : C.focusedPose;
  return (
    <svg
      className="todo-flipper-rig"
      viewBox="0 0 1536 1024"
      aria-hidden="true"
      data-action={pose}
    >
      <defs>
        {/* Actual character fur, softly masked at the shoulder instead of a flat fill. */}
        <linearGradient
          id={`${id}-shoulder`}
          x1="0"
          y1="490"
          x2="0"
          y2="530"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="black" />
          <stop offset=".7" stopColor="white" />
        </linearGradient>
        <filter
          id={`${id}-feather`}
          x="-.08"
          y="-.08"
          width="1.16"
          height="1.16"
        >
          <feGaussianBlur stdDeviation=".55" />
        </filter>
        <mask
          id={`${id}-flipper`}
          maskUnits="userSpaceOnUse"
          x="625"
          y="480"
          width="115"
          height="110"
        >
          <path
            d="M660 491C636 500 628 524 640 551C649 572 686 576 716 562C735 550 710 528 692 515C678 504 669 494 660 491Z"
            fill={`url(#${id}-shoulder)`}
            filter={`url(#${id}-feather)`}
          />
        </mask>
        <clipPath id={`${id}-grip`}>
          <ellipse cx="704" cy="555" rx="25" ry="17" />
        </clipPath>
        <radialGradient id={`${id}-contact`}>
          <stop stopColor="#473323" stopOpacity=".18" />
          <stop offset="1" stopColor="#473323" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-fur`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#84766a" />
          <stop offset=".5" stopColor="#655d54" />
          <stop offset="1" stopColor="#49453e" />
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
        <ellipse
          className="todo-pencil-contact"
          cx="733"
          cy="619"
          rx="17"
          ry="4"
          fill={`url(#${id}-contact)`}
        />
        <g className="todo-write-left">
          <g transform="rotate(13 654 505)">
            <image
              className="todo-fur-flipper"
              href={furSource}
              x="568.32"
              y="256"
              width="384"
              height="384"
              mask={`url(#${id}-flipper)`}
            />
          </g>
          <g className="todo-writing-wrist">
            <g className="todo-held-pencil" transform="translate(9 9)">
              <path d="M685 551L690 548L725 600L720 603Z" fill="#d6a444" />
              <path d="M690 548L692 551L725 600L723 601Z" fill="#ffe1a0" />
              <path d="M720 603L725 600L727 610Z" fill="#dbc39a" />
              <path d="M725 605L727 610L723 607Z" fill="#50463a" />
              <path
                d="M685 551L681 545Q682 540 686 541L690 548Z"
                fill="#cb8d83"
              />
            </g>
          </g>
          {/* A small matching fur overlap occludes the pencil where the flipper grips it. */}
          <g transform="rotate(13 654 505)" clipPath={`url(#${id}-grip)`}>
            <image
              href={furSource}
              x="568.32"
              y="256"
              width="384"
              height="384"
              mask={`url(#${id}-flipper)`}
            />
          </g>
        </g>
        <g className="todo-write-right">
          <g transform="translate(1518 0) scale(-1 1) rotate(6 654 505)">
            <image
              className="todo-fur-flipper"
              href={furSource}
              x="568.32"
              y="256"
              width="384"
              height="384"
              mask={`url(#${id}-flipper)`}
            />
          </g>
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
            opacity=".38"
          />
          <path
            className="todo-fur-rim"
            d="M652 513Q662 509 681 520L732 533"
            fill="none"
            stroke="#d1b48b"
            strokeWidth="3"
            strokeLinecap="round"
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
            opacity=".38"
          />
          <path
            className="todo-fur-rim"
            d="M863 513Q854 507 838 518L797 532"
            fill="none"
            stroke="#dac09b"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        <g className="todo-sip-cup">
          <svg x="718" y="484" width="84" height="90" overflow="visible">
            <CeramicMug held />
          </svg>
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

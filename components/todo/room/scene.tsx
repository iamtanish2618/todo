"use client";
import { useEffect, useState } from "react";
import { ROOM_CONFIG as C, zoneStyle, type RoomPose } from "./config";
import { RoomPenguin } from "./penguin";
import { RoomWindow } from "./window";
import { DeskNotebook } from "./notebook";
import { WorkingFlippers } from "./flippers";

/** A fixed camera and separate object layers give the table genuine occlusion. */
export function RoomScene({
  pose,
  female,
  reduced,
  active,
  day,
}: {
  pose: RoomPose;
  female: boolean;
  reduced: boolean;
  active: boolean;
  day: boolean;
}) {
  const [ready, setReady] = useState(reduced);
  const [lamp, setLamp] = useState(true);
  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setReady(true);
      return;
    }
    setReady(false);
    const reveal = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(reveal);
  }, [active, reduced]);
  return (
    <div
      className="cozy-room-art round-room-art"
      data-entry={ready ? "ready" : "settling"}
      data-pose={pose}
      data-lamp-on={lamp}
      data-active={active}
    >
      <img
        className="cozy-room-image"
        src={C.image}
        width={1536}
        height={1024}
        alt={`A miniature cozy room with an arched ${day ? "sunlit" : "moonlit"} window, plants, a chair and a complete round oak study table.`}
      />
      <RoomWindow day={day} />
      <div
        className="room-contact-shadow"
        style={zoneStyle(C.shadow)}
        aria-hidden="true"
      />
      <div className="room-seated-anchor" style={zoneStyle(C.penguin)}>
        <RoomPenguin
          pose={pose}
          female={female}
          reduced={reduced}
          active={active}
        />
      </div>
      <img
        className="round-table-front"
        src={C.image}
        width={1536}
        height={1024}
        alt=""
        aria-hidden="true"
        style={{ clipPath: C.tableFront }}
      />
      <div
        className="round-table-hit"
        role="img"
        aria-label="Your wooden study table"
      />
      <div className="round-lamp-pool" aria-hidden="true" />
      <button
        className="round-desk-lamp"
        aria-label={lamp ? "Turn table lamp off" : "Turn table lamp on"}
        aria-pressed={lamp}
        onClick={() => setLamp((v) => !v)}
      >
        <span className="round-lamp-base" />
        <span className="round-lamp-stem" />
        <span className="round-lamp-shade">
          <span className="round-lamp-shade-lit" />
        </span>
        <span className="round-lamp-button" />
      </button>
      <DeskNotebook />
      <WorkingFlippers pose={pose} />
      <div className="round-tea-set" aria-hidden="true">
        <span className="round-tea-pot">
          <i />
        </span>
        <span className="round-tea-lid" />
      </div>
      <div className="round-jars" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="coffee-cup room-table-coffee" aria-hidden="true">
        <i className="steam steam-one" />
        <i className="steam steam-two" />
        <span className="cup-top" />
        <span className="cup-body" />
        <span className="cup-handle" />
        <span className="cup-saucer" />
      </div>
    </div>
  );
}

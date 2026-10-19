"use client";
import { useEffect, useRef, useState } from "react";
import { ROOM_CONFIG as C, zoneStyle, type RoomPose } from "./config";
import { RoomPenguin } from "./penguin";

/** A fixed camera and separate object layers give the table genuine occlusion. */
export function RoomScene({
  pose,
  female,
  reduced,
  active,
}: {
  pose: RoomPose;
  female: boolean;
  reduced: boolean;
  active: boolean;
}) {
  const [beat, setBeat] = useState<"reach" | "book" | "ready">("reach");
  const [lamp, setLamp] = useState(false);
  const lampTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setBeat("ready");
      setLamp(true);
      return;
    }
    setBeat("reach");
    setLamp(false);
    const light = setTimeout(() => setLamp(true), 850);
    const book = setTimeout(() => setBeat("book"), 1450);
    const ready = setTimeout(() => setBeat("ready"), 2450);
    return () => {
      clearTimeout(light);
      clearTimeout(book);
      clearTimeout(ready);
    };
  }, [active, reduced]);
  useEffect(
    () => () => {
      if (lampTimer.current) clearTimeout(lampTimer.current);
    },
    [],
  );
  const touchLamp = () => {
    if (lampTimer.current) clearTimeout(lampTimer.current);
    if (reduced) {
      setLamp((v) => !v);
      return;
    }
    setBeat("reach");
    lampTimer.current = setTimeout(() => {
      setLamp((v) => !v);
      setBeat("ready");
    }, 850);
  };
  return (
    <div
      className="cozy-room-art round-room-art"
      data-entry={beat}
      data-lamp-on={lamp}
      data-active={active}
    >
      <img
        className="cozy-room-image"
        src={C.image}
        width={1536}
        height={1024}
        alt="A miniature cozy room with an arched moonlit window, plants, a chair and a complete round oak study table."
      />
      <div className="room-window-weather" aria-hidden="true">
        <div className="room-window-dark" />
        {Array.from({ length: 32 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${(i * 17) % 100}%`,
              animationDelay: `${i * -0.19}s`,
              animationDuration: `${0.65 + (i % 5) * 0.12}s`,
            }}
          />
        ))}
      </div>
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
        onClick={touchLamp}
      >
        <span className="round-lamp-base" />
        <span className="round-lamp-stem" />
        <span className="round-lamp-shade" />
        <span className="round-lamp-button" />
      </button>
      <span className="round-reaching-flipper" aria-hidden="true" />
      <div className="desk-notebook room-table-notebook" aria-hidden="true">
        <span />
        <i />
      </div>
      <div className="room-writing-hand" aria-hidden="true">
        <i />
      </div>
      <span className="round-resting-flipper" aria-hidden="true" />
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

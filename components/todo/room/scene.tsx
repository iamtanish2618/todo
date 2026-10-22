"use client";
import { useEffect, useRef, useState } from "react";
import { ROOM_CONFIG as C, zoneStyle, type RoomPose } from "./config";
import { RoomPenguin } from "./penguin";
import { RoomWindow } from "./window";
import { DeskNotebook } from "./notebook";
import { CeramicMug } from "./mug";
import { WorkingFlippers } from "./flippers";
import { RoomAtmosphere } from "./cinematic";
import { roomEffect, type RoomWeather } from "./cinema-config";

/** A fixed camera and separate object layers give the table genuine occlusion. */
export function RoomScene({
  pose,
  female,
  reduced,
  active,
  sky,
  focusing,
  interactive = true,
  clock,
  weather,
  arrived,
  teammates,
}: {
  pose: RoomPose;
  female: boolean;
  reduced: boolean;
  active: boolean;
  sky: "day" | "night" | "evening";
  focusing: boolean;
  interactive?: boolean;
  clock: string | null;
  weather: RoomWeather;
  arrived: boolean;
  teammates?: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [intro, setIntro] = useState("sleep");
  const introPlayed = useRef(false);
  const entryPose = useRef(pose);
  entryPose.current = pose;
  const [propAction, setPropAction] = useState("");
  const propTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const react = (kind: string) => {
    if (focusing || !interactive) return;
    setPropAction(kind);
    roomEffect(root.current, kind);
    if (propTimer.current) clearTimeout(propTimer.current);
    propTimer.current = setTimeout(() => setPropAction(""), 1800);
  };
  useEffect(
    () => () => {
      if (propTimer.current) clearTimeout(propTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!active || !arrived) {
      introPlayed.current = false;
      setIntro("awake");
      return;
    }
    // A mode change must not replay sleeping artwork or cover the pupils.
    if (
      introPlayed.current ||
      reduced ||
      focusing ||
      entryPose.current !== "idle"
    ) {
      introPlayed.current = true;
      setIntro("awake");
      return;
    }
    introPlayed.current = true;
    setIntro("sleep");
    const warm = setTimeout(() => setLamp(true), 900);
    const wake = setTimeout(() => setIntro("wake"), 1500),
      finish = setTimeout(() => setIntro("awake"), 2950);
    return () => {
      clearTimeout(warm);
      clearTimeout(wake);
      clearTimeout(finish);
    };
  }, [active, arrived, reduced, focusing]);
  const [ready, setReady] = useState(reduced);
  const [lamp, setLamp] = useState(false);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    setWorking(false);
    if (!focusing || !active) return;
    setLamp(false);
    const light = setTimeout(() => setLamp(true), reduced ? 0 : 250);
    const prepare = setTimeout(() => setWorking(true), reduced ? 0 : 1200);
    return () => {
      clearTimeout(light);
      clearTimeout(prepare);
    };
  }, [focusing, active, reduced]);
  const scenePose = pose === "writing" && !working ? "idle" : pose;
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
      ref={root}
      className="cozy-room-art round-room-art"
      data-shared={!!teammates}
      data-weather={weather}
      data-intro={intro}
      data-prop-action={propAction}
      data-behavior="idle"
      data-entry={ready ? "ready" : "settling"}
      data-pose={scenePose}
      data-work-phase={focusing ? (working ? "writing" : "preparing") : "idle"}
      data-lamp-on={lamp}
      data-active={active}
    >
      <img
        className="cozy-room-image"
        src={C.image}
        width={1536}
        height={1024}
        alt={`A miniature cozy room with an arched ${sky === "day" ? "sunlit" : sky === "evening" ? "rainy evening" : "moonlit"} window, plants, a chair and a complete round oak study table.`}
      />
      <RoomWindow sky={sky} weather={weather} />
      <img
        className="cinema-furniture-layer"
        src={C.image}
        alt=""
        aria-hidden="true"
        width={1536}
        height={1024}
      />
      <img
        className="cinema-shelf-layer"
        src={C.image}
        alt=""
        aria-hidden="true"
        width={1536}
        height={1024}
      />
      <RoomAtmosphere />
      <button
        className="cinema-object-hit cinema-window-hit"
        aria-label="Make a wish on a shooting star"
        onClick={() => react("star")}
        disabled={focusing || !interactive}
      >
        <span>Make a wish ✦</span>
      </button>
      <button
        className="cinema-object-hit cinema-lights-hit"
        aria-label="Twinkle the string lights"
        onClick={() => react("lights")}
        disabled={focusing || !interactive}
      >
        <span>A little glow</span>
      </button>
      <button
        className="cinema-object-hit cinema-rug-hit"
        aria-label="Pat the cozy rug"
        onClick={() => react("rug")}
        disabled={focusing || !interactive}
      >
        <span>Soft landing</span>
      </button>
      {clock ? (
        <div className="room-back-countdown" aria-hidden="true">
          {clock}
        </div>
      ) : null}
      <div
        className="room-contact-shadow"
        style={zoneStyle(C.shadow)}
        aria-hidden="true"
      />
      {teammates || (
        <>
          <div className="room-seated-anchor" style={zoneStyle(C.penguin)}>
            <RoomPenguin
              pose={scenePose}
              female={female}
              reduced={reduced}
              active={active}
              calm={focusing || !interactive || pose !== "idle"}
              intro={intro}
            />
          </div>
        </>
      )}
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
        onClick={() => {
          setLamp((v) => !v);
          roomEffect(root.current, "lamp");
        }}
        disabled={focusing || !interactive}
        tabIndex={focusing || !interactive ? -1 : 0}
      >
        <span className="round-lamp-base" />
        <span className="round-lamp-stem" />
        <span className="round-lamp-shade">
          <span className="round-lamp-shade-lit" />
        </span>
        <span className="round-lamp-button" />
      </button>
      <DeskNotebook />
      <button
        className="cinema-object-hit cinema-book-hit"
        aria-label="Turn the notebook page"
        onClick={() => react("page")}
        disabled={focusing || !interactive}
      >
        <span>One more page</span>
      </button>
      <WorkingFlippers pose={scenePose} female={female} />
      <button
        className="round-tea-set"
        aria-label="Pour a little tea"
        onClick={() => react("pour")}
        disabled={focusing || !interactive}
      >
        <span className="round-tea-pot">
          <i />
        </span>
        <span className="round-tea-lid" />
        <span className="cinema-tea-stream" aria-hidden="true" />
      </button>
      <img
        className="cinema-foreground-layer"
        src={C.image}
        alt=""
        aria-hidden="true"
        width={1536}
        height={1024}
      />
      <div className="round-jars" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="coffee-cup room-table-coffee" aria-hidden="true">
        <i className="steam steam-one" />
        <i className="steam steam-two" />
        <CeramicMug />
      </div>
    </div>
  );
}

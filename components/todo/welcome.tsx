"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowRight,
  FileText,
  Headphones,
  Loader2,
  Settings2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import "lenis/dist/lenis.css";
import "./welcome.css";

/** All art-space coordinates are fractions of the natural image, not viewport pixels.
 * The winter companions are matched artwork variants; their knit colours and blush are baked into the real art.
 * Replace either src independently and adjust its framing if new artwork is supplied. */
export const INTRO_CONFIG = {
  images: {
    male: {
      src: "/art/todo-winter-male.webp",
      closedSrc: "/art/todo-winter-male-closed.webp",
      alt: "Todo, your blue winter-hat and scarf penguin companion",
      scale: 1,
      translateX: 0,
      translateY: 0,
    },
    female: {
      src: "/art/todo-winter-female.webp",
      closedSrc: "/art/todo-winter-female-closed.webp",
      alt: "Todo, your pink winter-hat and scarf penguin companion",
      scale: 1,
      translateX: 0,
      translateY: 0,
    },
  },
  portrait: { maxImageWidth: 1.8, eyeHeight: 0.39 },
  eyes: {
    leftEye: { cx: 0.372, cy: 0.58, rx: 0.035, ry: 0.052 },
    rightEye: { cx: 0.603, cy: 0.585, rx: 0.035, ry: 0.052 },
  },
  snow: {
    desktop: 260,
    mobile: 120,
    mobileWidth: 640,
    dpr: 2,
    seed: 9481,
    far: { radius: [1, 2], speed: [20, 40], alpha: 0.35 },
    mid: { radius: [2, 4], speed: [50, 90], alpha: 0.6 },
    near: { radius: [5, 9], speed: [110, 180], alpha: 0.85 },
  },
  timings: {
    holdEnd: 0.12,
    closeStart: 0.12,
    closeEnd: 0.3,
    rightOffset: 0.025,
    snowStart: 0.22,
    whiteAt: 0.46,
    whiteUntil: 0.54,
    clearEnd: 0.78,
    openStart: 0.74,
    openEnd: 0.88,
    captionOut: 0.64,
    settleStart: 0.88,
  },
  colors: {
    veilCenter: "#FFFFFF",
    veilEdge: "#E8F1F9",
  },
  travel: { maleExit: -12, femaleEntry: 22 },
  caption: "or maybe you'd like me?",
  sectionHeight: "180svh",
  scrub: 0.55,
  lenisLerp: 0.09,
} as const;

type Timings = { [K in keyof typeof INTRO_CONFIG.timings]: number };
export type Panel =
  "solo" | "friends" | "agent" | "settings" | "notes" | "history" | null;
type Character = "male" | "female";
export type WelcomeHandle = { selectCharacter: (character: Character) => void };
type Props = {
  active: boolean;
  blocked: boolean;
  reduced: boolean;
  ready: boolean;
  onChoose: (panel: Panel) => void;
  onCharacterChange: (female: boolean) => void;
  timer: { started: boolean; clock: string; running: boolean };
};
type Engine = {
  select: (character: Character, immediate?: boolean) => void;
  rebuild: (timings: Timings) => void;
  wink: () => void;
  dispose: () => void;
};
const choices = [
  {
    id: "solo",
    label: "Focus solo",
    description: "One thing at a time.",
    icon: Headphones,
  },
  {
    id: "friends",
    label: "Join friends",
    description: "Good company. Same room.",
    icon: Users,
  },
  {
    id: "agent",
    label: "Ask Todo",
    description: "A little help goes a long way.",
    icon: Sparkles,
  },
] as const;
const clamp = (x: number, low = 0, high = 1) =>
  Math.max(low, Math.min(high, x));

function Eye({
  side,
  character,
}: {
  side: "leftEye" | "rightEye";
  character: Character;
}) {
  const e = INTRO_CONFIG.eyes[side];
  // A feathered patch from the registered, naturally closed artwork covers the entire eye rim.
  // This avoids the hard circular outline of a flat, synthetic eyelid pasted over fluffy fur.
  const patch = {
    x: e.cx - e.rx * 2.8,
    y: e.cy - e.ry * 2.6,
    w: e.rx * 5.6,
    h: e.ry * 5.2,
  };
  return (
    <>
      <div
        className={`intro-eye ${side}`}
        style={{
          left: `${(e.cx - e.rx) * 100}%`,
          top: `${(e.cy - e.ry) * 100}%`,
          width: `${e.rx * 200}%`,
          height: `${e.ry * 200}%`,
        }}
      >
        <div className="intro-pupil">
          <i />
          <b />
        </div>
      </div>
      <svg
        className={`intro-closed-eye ${side}`}
        style={{
          left: `${patch.x * 100}%`,
          top: `${patch.y * 100}%`,
          width: `${patch.w * 100}%`,
          height: `${patch.h * 100}%`,
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <image
          href={INTRO_CONFIG.images[character].closedSrc}
          x={(-patch.x * 100) / patch.w}
          y={(-patch.y * 100) / patch.h}
          width={100 / patch.w}
          height={100 / patch.h}
          preserveAspectRatio="none"
        />
      </svg>
    </>
  );
}

export const Welcome = forwardRef<WelcomeHandle, Props>(
  function Welcome(props, ref) {
    const debugOutput = useRef<HTMLOutputElement>(null);
    const root = useRef<HTMLElement>(null),
      engine = useRef<Engine | null>(null),
      latest = useRef(props);
    latest.current = props;
    const [loaded, setLoaded] = useState(false),
      [error, setError] = useState(""),
      [attempt, setAttempt] = useState(0),
      [debug, setDebug] = useState(false),
      [selected, setSelected] = useState<Character>("male"),
      [timings, setTimings] = useState<Timings>({ ...INTRO_CONFIG.timings });
    useImperativeHandle(
      ref,
      () => ({
        selectCharacter: (character) => engine.current?.select(character),
      }),
      [],
    );
    useEffect(() => {
      setDebug(new URLSearchParams(location.search).get("debug") === "1");
    }, []);
    useEffect(() => {
      engine.current?.rebuild(timings);
    }, [timings]);

    useEffect(() => {
      const element = root.current;
      if (!element) return;
      let cancelled = false,
        cleanup = () => {};
      setError("");
      setLoaded(false);
      const prepare = async () => {
        const [{ gsap }, { ScrollTrigger }, { default: Lenis }] =
          await Promise.all([
            import("gsap"),
            import("gsap/ScrollTrigger"),
            import("lenis"),
          ]);
        const stage = element.querySelector<HTMLElement>(".intro-stage")!;
        const planes = [
          element.querySelector<HTMLElement>(".intro-male")!,
          element.querySelector<HTMLElement>(".intro-female")!,
        ];
        const images = planes.map((plane) =>
          plane.querySelector<HTMLImageElement>("img")!,
        );
        const closedImages = Object.values(INTRO_CONFIG.images).map((frame) => {
          const image = new Image();
          image.src = frame.closedSrc;
          return image;
        });
        await Promise.all([
          ...images.map((image) => image.decode()),
          ...closedImages.map((image) => image.decode()),
          document.fonts.load("600 16px Nunito"),
        ]);
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        gsap.ticker.lagSmoothing(0);
        const lenis = new Lenis({
          lerp: INTRO_CONFIG.lenisLerp,
          smoothWheel: true,
          syncTouch: false,
          autoRaf: false,
          prevent: (node) =>
            Boolean(node.closest("[data-lenis-prevent], [role=dialog]")),
        });
        lenis.on("scroll", ScrollTrigger.update);
        const oldRestoration = history.scrollRestoration;
        history.scrollRestoration = "manual";
        const reduced = latest.current.reduced;
        const canvas = element.querySelector<HTMLCanvasElement>(".intro-snow")!,
          ctx = canvas.getContext("2d", { alpha: true });
        const veil = element.querySelector<HTMLElement>(".intro-veil")!,
          caption = element.querySelector<HTMLElement>(".intro-caption")!,
          vignette = element.querySelector<HTMLElement>(".intro-vignette")!;
        const trays = Array.from(
            element.querySelectorAll<HTMLElement>(".intro-cards"),
          ),
          ui = element.querySelector<HTMLElement>(".intro-ui")!,
          hint = element.querySelector<HTMLElement>(".intro-scroll-hint")!;
        const pickers = Array.from(
          element.querySelectorAll<HTMLButtonElement>(".intro-picker button"),
        );
        const pupils = planes.flatMap((plane) =>
          Array.from(plane.querySelectorAll<HTMLElement>(".intro-pupil")),
        );
        const closedPatches = planes.flatMap((plane) =>
          Array.from(plane.querySelectorAll<SVGElement>(".intro-closed-eye")),
        );
        const glass = trays.flatMap((tray) =>
          Array.from(tray.querySelectorAll<HTMLElement>(".intro-glass")),
        );
        const cardBounds = new Float32Array(24),
          cardNear = new Float32Array(6);
        const pupilOffsets = new Float32Array(8);
        let cached = { width: 1, height: 1 },
          dpr = Math.min(devicePixelRatio || 1, INTRO_CONFIG.snow.dpr),
          maximum = INTRO_CONFIG.snow.desktop as number;
        const eyeBoxes = new Float32Array(16); // cx,cy,width,height × four eyes; rebuilt only on load/resize.
        let visible = true,
          disposed = false,
          frozen = false,
          timeline: ReturnType<typeof gsap.timeline>,
          currentTimings = timings;
        let previousTime = 0,
          lastProgress = -1,
          currentCharacter: Character = "male",
          lastCards = "",
          resizeTimeout: ReturnType<typeof setTimeout>;
        let lastDebug = 0,
          lastStats = 0,
          samples = 0,
          totalTime = 0,
          frameTime = 16.67,
          budget = 1,
          qualityDrops = 0;
        const pointer = { x: 0, y: 0, present: false, touchUntil: 0 },
          wander = { x: 0, y: 0, next: 0 },
          blink = { start: -10, next: 0, leftOnly: false };
        let randomState = INTRO_CONFIG.snow.seed as number;
        const random = () => {
          randomState = (Math.imul(1664525, randomState) + 1013904223) | 0;
          return (randomState >>> 0) / 4294967296;
        };
        const motion = {
          density: 0,
          wind: 0,
          swirl: 0,
          maleClose: 0,
          maleRight: 0,
          femaleClose: 1,
          femaleRight: 1,
          trackingMale: 1,
          trackingFemale: 0,
          maleLookY: 0,
          femaleLookX: 0,
          femaleLookY: 0,
          travelMale: 0,
          travelFemale: INTRO_CONFIG.travel.femaleEntry,
          breathMale: 1,
          breathFemale: 0,
        };
        const initialMotion = { ...motion };
        // Fixed-capacity pool. No particle objects are allocated, added, or removed inside the frame loop.
        const pool = new Float32Array(INTRO_CONFIG.snow.desktop * 8);
        for (let i = 0; i < INTRO_CONFIG.snow.desktop; i++) {
          const j = i * 8,
            layer =
              i % 20 < 9
                ? INTRO_CONFIG.snow.far
                : i % 20 < 16
                  ? INTRO_CONFIG.snow.mid
                  : INTRO_CONFIG.snow.near;
          pool[j] = random();
          pool[j + 1] = random();
          pool[j + 2] =
            layer.radius[0] + random() * (layer.radius[1] - layer.radius[0]);
          pool[j + 3] =
            layer.speed[0] + random() * (layer.speed[1] - layer.speed[0]);
          pool[j + 4] = layer.alpha;
          pool[j + 5] = random() * Math.PI * 2;
          pool[j + 6] = 0.35 + random() * 0.65;
          pool[j + 7] = 7 + random() * 16;
        }
        // A single cached sprite, shared by every depth layer. There are no arc/fill/blur calls per flake.
        const sprite = document.createElement("canvas");
        sprite.width = sprite.height = 48;
        const spriteCtx = sprite.getContext("2d")!,
          gradient = spriteCtx.createRadialGradient(24, 24, 0, 24, 24, 24);
        gradient.addColorStop(0, "rgba(255,255,255,1)");
        gradient.addColorStop(0.32, "rgba(255,255,255,.95)");
        gradient.addColorStop(0.7, "rgba(255,255,255,.35)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        spriteCtx.fillStyle = gradient;
        spriteCtx.fillRect(0, 0, 48, 48);
        const resizeBuffer = () => {
          canvas.width = Math.round(cached.width * dpr);
          canvas.height = Math.round(cached.height * dpr);
          ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
          element.dataset.dpr = dpr.toFixed(2);
        };
        // This is the ONLY measurement function. It is called at startup and from a debounced resize handler, never from scroll/ticker callbacks.
        const measure = () => {
          if (disposed) return;
          const oldWidth = cached.width,
            oldHeight = cached.height;
          cached = { width: stage.clientWidth, height: stage.clientHeight };
          element.dataset.viewport = `${cached.width}x${cached.height}`;
          maximum =
            cached.width < INTRO_CONFIG.snow.mobileWidth
              ? INTRO_CONFIG.snow.mobile
              : INTRO_CONFIG.snow.desktop;
          for (let i = 0; i < planes.length; i++) {
            const frame = i
                ? INTRO_CONFIG.images.female
                : INTRO_CONFIG.images.male,
              image = images[i];
            let cover = Math.max(
              cached.width / image.naturalWidth,
              cached.height / image.naturalHeight,
            );
            const portrait = cached.width / cached.height < 0.85;
            if (portrait)
              cover = Math.min(
                cover,
                (cached.width * INTRO_CONFIG.portrait.maxImageWidth) /
                  image.naturalWidth,
              );
            cover *= frame.scale;
            const w = image.naturalWidth * cover,
              h = image.naturalHeight * cover,
              x = (cached.width - w) / 2 + frame.translateX * w,
              y =
                (portrait
                  ? cached.height * INTRO_CONFIG.portrait.eyeHeight -
                    INTRO_CONFIG.eyes.leftEye.cy * h
                  : (cached.height - h) / 2) +
                frame.translateY * h;
            Object.assign(planes[i].style, {
              width: `${w}px`,
              height: `${h}px`,
              left: `${x}px`,
              top: `${y}px`,
            });
            [INTRO_CONFIG.eyes.leftEye, INTRO_CONFIG.eyes.rightEye].forEach(
              (eye, side) => {
                const j = (i * 2 + side) * 4;
                eyeBoxes[j] = x + eye.cx * w;
                eyeBoxes[j + 1] = y + eye.cy * h;
                eyeBoxes[j + 2] = eye.rx * 2 * w;
                eyeBoxes[j + 3] = eye.ry * 2 * h;
              },
            );
          }
          for (let i = 0; i < INTRO_CONFIG.snow.desktop; i++) {
            const j = i * 8;
            pool[j] =
              oldWidth === 1
                ? pool[j] * cached.width
                : (pool[j] * cached.width) / oldWidth;
            pool[j + 1] =
              oldHeight === 1
                ? pool[j + 1] * cached.height
                : (pool[j + 1] * cached.height) / oldHeight;
          }
          glass.forEach((card, i) => {
            const rect = card.getBoundingClientRect(),
              j = i * 4;
            cardBounds[j] = rect.left;
            cardBounds[j + 1] = rect.top;
            cardBounds[j + 2] = rect.right;
            cardBounds[j + 3] = rect.bottom;
          });
          resizeBuffer();
          lenis.resize();
        };
        measure();
        const applyAccessibility = (p: number) => {
          const enabled =
            latest.current.active &&
            !latest.current.blocked &&
            latest.current.ready;
          const male =
            enabled &&
            (reduced
              ? currentCharacter === "male"
              : p < currentTimings.closeStart + 0.01);
          const female =
            enabled &&
            (reduced
              ? currentCharacter === "female"
              : p > currentTimings.openEnd + 0.045);
          const key = `${male}/${female}`;
          if (key !== lastCards) {
            trays[0].inert = !male;
            trays[1].inert = !female;
            trays[0].setAttribute("aria-hidden", String(!male));
            trays[1].setAttribute("aria-hidden", String(!female));
            lastCards = key;
          }
          planes[0].setAttribute(
            "aria-hidden",
            String(
              !enabled || (reduced ? currentCharacter !== "male" : p >= 0.46),
            ),
          );
          planes[1].setAttribute(
            "aria-hidden",
            String(
              !enabled || (reduced ? currentCharacter !== "female" : p <= 0.54),
            ),
          );
        };
        const commitCharacter = (character: Character) => {
          if (currentCharacter === character) return;
          currentCharacter = character;
          setSelected(character);
          latest.current.onCharacterChange(character === "female");
          try {
            localStorage.setItem("todo.character.v1", character);
          } catch {}
        };
        const select = (character: Character, immediate = false) => {
          const trigger = timeline.scrollTrigger;
          if (!trigger) return;
          lenis.scrollTo(character === "female" ? trigger.end : trigger.start, {
            force: true,
            immediate: immediate || reduced,
            duration: 1.2,
            lerp: 0,
          });
          if (immediate || reduced) {
            ScrollTrigger.update();
            timeline.progress(character === "female" ? 1 : 0);
          }
        };
        const build = (t: Timings, preserve = true) => {
          const oldProgress = preserve && timeline ? timeline.progress() : 0;
          timeline?.scrollTrigger?.kill();
          timeline?.kill();
          currentTimings = t;
          Object.assign(motion, initialMotion);
          gsap.set(planes[0], { autoAlpha: 1, scale: 1, y: 0, yPercent: 0 });
          gsap.set(planes[1], {
            autoAlpha: 0,
            scale: reduced ? 1 : 1.06,
            y: 0,
            yPercent: reduced ? 0 : INTRO_CONFIG.travel.femaleEntry,
          });
          gsap.set([veil, caption, vignette, trays[1], ...pickers], {
            autoAlpha: 0,
          });
          gsap.set(trays[0], { autoAlpha: 1, y: 0 });
          gsap.set(trays[1], { y: 30 });
          gsap.set(pickers, { y: 12 });
          gsap.set(caption, { y: 12 });
          gsap.set(ui, { autoAlpha: 1 });
          gsap.set(hint, { autoAlpha: 1 });
          timeline = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: element,
              pin: stage,
              pinSpacing: false,
              anticipatePin: 1,
              scrub: INTRO_CONFIG.scrub,
              start: "top top",
              end: "bottom bottom",
              invalidateOnRefresh: true,
              onRefresh: (trigger) => {
                measure();
                element.dataset.scrollStart = String(trigger.start);
                element.dataset.scrollEnd = String(trigger.end);
              },
            },
          });
          timeline.to({}, { duration: 1 }, 0);
          if (!reduced) {
            timeline
              .to(hint, { autoAlpha: 0, duration: 0.05 }, 0.05)
              .to(
                motion,
                {
                  trackingMale: 0,
                  maleLookY: 0.075,
                  breathMale: 0,
                  duration: 0.07,
                  ease: "power2.inOut",
                },
                t.closeStart,
              )
              .to(
                motion,
                {
                  maleClose: 1,
                  duration: t.closeEnd - t.closeStart - t.rightOffset,
                  ease: "power2.inOut",
                },
                t.closeStart,
              )
              .to(
                motion,
                {
                  maleRight: 1,
                  duration: t.closeEnd - t.closeStart - t.rightOffset,
                  ease: "power2.inOut",
                },
                t.closeStart + t.rightOffset,
              )
              .to(
                trays[0],
                { autoAlpha: 0, y: 30, duration: 0.1, ease: "power2.inOut" },
                t.closeStart,
              )
              .to(
                motion,
                {
                  travelMale: INTRO_CONFIG.travel.maleExit,
                  duration: t.whiteAt - t.closeStart,
                  ease: "power2.inOut",
                },
                t.closeStart,
              )
              .to(
                motion,
                {
                  travelFemale: 0,
                  duration: t.openEnd - t.whiteUntil,
                  ease: "power2.inOut",
                },
                t.whiteUntil,
              )
              .to(ui, { autoAlpha: 0, duration: 0.07 }, t.snowStart + 0.03)
              .to(
                motion,
                {
                  density: 1,
                  wind: 95,
                  swirl: 0.9,
                  duration: t.whiteAt - t.snowStart,
                  ease: "power2.inOut",
                },
                t.snowStart,
              )
              .to(
                veil,
                {
                  autoAlpha: 0.85,
                  duration: t.whiteAt - t.snowStart - 0.035,
                  ease: "power2.in",
                },
                t.snowStart,
              )
              .to(
                veil,
                { autoAlpha: 1, duration: 0.035, ease: "power1.out" },
                t.whiteAt - 0.035,
              )
              .to(
                planes[0],
                {
                  autoAlpha: 0,
                  scale: 1.04,
                  duration: t.whiteUntil - t.whiteAt - 0.024,
                  ease: "power2.inOut",
                },
                t.whiteAt + 0.012,
              )
              .to(
                planes[1],
                {
                  autoAlpha: 1,
                  scale: 1,
                  duration: t.whiteUntil - t.whiteAt - 0.024,
                  ease: "power2.inOut",
                },
                t.whiteAt + 0.012,
              )
              .to(
                caption,
                { autoAlpha: 1, y: 0, duration: 0.035, ease: "power2.out" },
                t.whiteAt,
              )
              .to(
                caption,
                { autoAlpha: 0, y: -8, duration: 0.025, ease: "power1.in" },
                t.captionOut,
              )
              .to(
                veil,
                {
                  autoAlpha: 0,
                  duration: t.clearEnd - t.whiteUntil,
                  ease: "power2.inOut",
                },
                t.whiteUntil,
              )
              .to(
                motion,
                {
                  density: 0.15,
                  wind: 6,
                  swirl: 0,
                  duration: t.clearEnd - t.whiteUntil,
                  ease: "power2.inOut",
                },
                t.whiteUntil,
              )
              .to(vignette, { autoAlpha: 0.25, duration: 0.08 }, t.whiteUntil)
              .to(
                vignette,
                { autoAlpha: 0, duration: t.openEnd - t.openStart },
                t.openStart,
              )
              .to(
                motion,
                {
                  femaleClose: 0,
                  duration: t.openEnd - t.openStart - t.rightOffset,
                  ease: "back.out(1.2)",
                },
                t.openStart,
              )
              .to(
                motion,
                {
                  femaleRight: 0,
                  duration: t.openEnd - t.openStart - t.rightOffset,
                  ease: "back.out(1.2)",
                },
                t.openStart + t.rightOffset,
              )
              .to(
                motion,
                { femaleLookX: -0.12, duration: 0.023, ease: "power1.inOut" },
                t.openEnd - 0.025,
              )
              .to(
                motion,
                {
                  femaleLookX: 0,
                  femaleLookY: -0.1,
                  duration: 0.023,
                  ease: "power1.inOut",
                },
                t.openEnd,
              )
              .to(
                motion,
                { femaleLookY: 0, duration: 0.023, ease: "power1.inOut" },
                t.openEnd + 0.023,
              )
              .to(
                motion,
                {
                  trackingFemale: 1,
                  breathFemale: 1,
                  duration: Math.min(0.04, 1 - t.openEnd - 0.046),
                  ease: "power2.out",
                },
                t.openEnd + 0.046,
              )
              .to(
                trays[1],
                { autoAlpha: 1, y: 0, duration: 0.055, ease: "power2.out" },
                t.openEnd,
              )
              .to(ui, { autoAlpha: 1, duration: 0.055 }, t.openEnd)
              .to(
                pickers,
                {
                  autoAlpha: 1,
                  y: 0,
                  duration: 0.04,
                  stagger: 0.08,
                  ease: "power2.out",
                },
                t.settleStart,
              );
          }
          ScrollTrigger.refresh();
          lenis.resize();
          element.dataset.openStart = String(t.openStart);
          if (preserve) {
            lenis.scrollTo(
              timeline.scrollTrigger!.start +
                oldProgress *
                  (timeline.scrollTrigger!.end - timeline.scrollTrigger!.start),
              { immediate: true, force: true },
            );
            timeline.progress(oldProgress);
          }
        };
        build(timings, false);
        const change = (event: PointerEvent) => {
          pointer.x = event.clientX;
          pointer.y = event.clientY;
          pointer.present = true;
          if (event.pointerType === "touch")
            pointer.touchUntil = performance.now() + 1600;
        };
        const leave = () => {
          pointer.present = false;
        };
        const resize = () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            ScrollTrigger.refresh();
            measure();
            ScrollTrigger.refresh();
          }, 180);
        };
        const observer = new IntersectionObserver((entries) => {
          visible = entries[0]?.isIntersecting ?? true;
        });
        observer.observe(element);
        window.addEventListener("pointermove", change, { passive: true });
        window.addEventListener("pointerdown", change, { passive: true });
        document.addEventListener("pointerleave", leave);
        window.addEventListener("resize", resize, { passive: true });
        const finePointer = matchMedia("(pointer:fine)").matches;
        let reducedSide: Character = "male";
        const setReducedSide = (side: Character, immediate = false) => {
          if (reducedSide === side && !immediate) return;
          reducedSide = side;
          commitCharacter(side);
          gsap.to(planes[0], {
            autoAlpha: side === "male" ? 1 : 0,
            duration: immediate ? 0 : 0.6,
            overwrite: true,
          });
          gsap.to(planes[1], {
            autoAlpha: side === "female" ? 1 : 0,
            duration: immediate ? 0 : 0.6,
            overwrite: true,
          });
          gsap.set(trays[0], { autoAlpha: side === "male" ? 1 : 0, y: 0 });
          gsap.set(trays[1], { autoAlpha: side === "female" ? 1 : 0, y: 0 });
          gsap.set(hint, { autoAlpha: side === "male" ? 1 : 0 });
          gsap.set(pickers, { autoAlpha: side === "female" ? 1 : 0, y: 0 });
        };
        const tick = (time: number, deltaMs: number) => {
          if (disposed || cancelled) return;
          const canRun = latest.current.active && !latest.current.blocked;
          if (canRun && frozen) {
            lenis.start();
            frozen = false;
          } else if (!canRun && !frozen) {
            lenis.stop();
            frozen = true;
          }
          lenis.raf(time * 1000);
          if (!canRun || document.hidden || !visible) {
            previousTime = time;
            return;
          }
          const dt = Math.min(
            0.05,
            previousTime ? time - previousTime : 1 / 60,
          );
          previousTime = time;
          const p = timeline.progress(),
            moving = Math.abs(p - lastProgress) > 0.00015,
            transitioning =
              p > currentTimings.holdEnd && p < currentTimings.openEnd + 0.075;
          if (reduced) setReducedSide(p >= 0.5 ? "female" : "male");
          else if (p < 0.008) commitCharacter("male");
          else if (p > 0.992) commitCharacter("female");
          if (p !== lastProgress) {
            element.dataset.scrollProgress = p.toFixed(4);
            element.dataset.heavy = String(p > 0.24 && p < 0.86);
            element.dataset.phase =
              p < currentTimings.closeStart
                ? "hold"
                : p < currentTimings.closeEnd
                  ? "closing"
                  : p < currentTimings.whiteAt
                    ? "snow-build"
                    : p < currentTimings.whiteUntil
                      ? "whiteout"
                      : p < currentTimings.openStart
                        ? "snow-clear"
                        : p < currentTimings.openEnd
                          ? "opening"
                          : "settle";
            lastProgress = p;
          }
          applyAccessibility(p);
          if (!finePointer && performance.now() > pointer.touchUntil)
            pointer.present = false;
          if (!pointer.present && time >= wander.next) {
            wander.x = cached.width * (0.2 + random() * 0.6);
            wander.y = cached.height * (0.2 + random() * 0.5);
            wander.next = time + 2 + random() * 2;
          }
          if (!reduced && !transitioning && !moving) {
            if (!blink.next) blink.next = time + 3 + random() * 3;
            if (time >= blink.next) {
              blink.start = time;
              blink.leftOnly = false;
              blink.next = time + 3 + random() * 3;
            }
          } else {
            blink.start = -10;
            blink.next = time + 3 + random() * 3;
          }
          const blinkAge = time - blink.start,
            idleBlink =
              !reduced && blinkAge >= 0 && blinkAge < 0.14
                ? Math.sin((Math.PI * blinkAge) / 0.14)
                : 0;
          const lerp = 1 - Math.pow(0.9, dt * 60);
          for (let i = 0; i < glass.length; i++) {
            const j = i * 4,
              enabled = pointer.present && !transitioning && !reduced;
            const distance = enabled
              ? Math.hypot(
                  Math.max(
                    cardBounds[j] - pointer.x,
                    0,
                    pointer.x - cardBounds[j + 2],
                  ),
                  Math.max(
                    cardBounds[j + 1] - pointer.y,
                    0,
                    pointer.y - cardBounds[j + 3],
                  ),
                )
              : 180;
            cardNear[i] += (clamp(1 - distance / 160) - cardNear[i]) * lerp;
            glass[i].style.setProperty("--near", cardNear[i].toFixed(3));
          }
          for (let i = 0; i < 4; i++) {
            const female = i >= 2,
              j = i * 4,
              k = i * 2;
            let dx =
                ((pointer.present ? pointer.x : wander.x) - eyeBoxes[j]) /
                (cached.width * 0.32),
              dy =
                ((pointer.present ? pointer.y : wander.y) - eyeBoxes[j + 1]) /
                (cached.height * 0.32);
            const distance = Math.max(1, Math.hypot(dx, dy));
            dx /= distance;
            dy /= distance;
            const weight = reduced
              ? 0
              : female
                ? motion.trackingFemale
                : motion.trackingMale;
            const tx =
                (dx * 0.18 * weight + (female ? motion.femaleLookX : 0)) *
                eyeBoxes[j + 2],
              ty =
                (dy * 0.14 * weight +
                  (female ? motion.femaleLookY : motion.maleLookY)) *
                eyeBoxes[j + 3];
            pupilOffsets[k] += (tx - pupilOffsets[k]) * lerp;
            pupilOffsets[k + 1] += (ty - pupilOffsets[k + 1]) * lerp;
            const scripted = reduced
              ? 0
              : female
                ? i % 2
                  ? motion.femaleRight
                  : motion.femaleClose
                : i % 2
                  ? motion.maleRight
                  : motion.maleClose;
            // Preserve the small negative back.out overshoot instead of clamping it to an idle zero.
            const blinkAmount = blink.leftOnly && i % 2 ? 0 : idleBlink;
            const close =
              blinkAmount > 0 ? Math.max(scripted, blinkAmount) : scripted;
            const amount = clamp(close);
            closedPatches[i].style.opacity = String(
              amount * amount * (3 - 2 * amount),
            );
            pupils[i].style.opacity = String(1 - amount * 0.8);
            pupils[i].style.transform =
              `translate3d(calc(-50% + ${pupilOffsets[k].toFixed(2)}px),calc(-50% + ${pupilOffsets[k + 1].toFixed(2)}px),0) scaleY(${Math.max(0.03, 1 - close * 0.97).toFixed(4)})`;
          }
          if (!reduced) {
            gsap.set(planes[0], {
              yPercent: motion.travelMale,
              y: Math.sin(time * 0.85) * 2.5 * motion.breathMale,
            });
            gsap.set(planes[1], {
              yPercent: motion.travelFemale,
              y: Math.sin(time * 0.85) * 2.5 * motion.breathFemale,
            });
          }
          const count = reduced
            ? 0
            : Math.floor(maximum * motion.density * budget);
          if (ctx && count > 0) {
            ctx.clearRect(0, 0, cached.width, cached.height);
            const cx = cached.width * 0.5,
              cy = cached.height * 0.48;
            for (let i = 0; i < count; i++) {
              const j = i * 8,
                radius = pool[j + 2];
              pool[j] +=
                (Math.sin(time * pool[j + 6] + pool[j + 5]) * pool[j + 7] +
                  motion.wind +
                  ((cx - pool[j]) * 0.18 - (cy - pool[j + 1]) * 0.08) *
                    motion.swirl) *
                dt;
              pool[j + 1] +=
                (pool[j + 3] +
                  ((cy - pool[j + 1]) * 0.1 + (cx - pool[j]) * 0.04) *
                    motion.swirl) *
                dt;
              if (pool[j + 1] > cached.height + radius) {
                pool[j + 1] = -radius - random() * 25;
                pool[j] = random() * cached.width;
              }
              if (pool[j] < -radius) pool[j] = cached.width + radius;
              else if (pool[j] > cached.width + radius) pool[j] = -radius;
              ctx.globalAlpha = pool[j + 4];
              ctx.drawImage(
                sprite,
                pool[j] - radius,
                pool[j + 1] - radius,
                radius * 2,
                radius * 2,
              );
            }
            ctx.globalAlpha = 1;
          } else if (canvas.dataset.cleared !== "true") {
            ctx?.clearRect(0, 0, cached.width, cached.height);
            canvas.dataset.cleared = "true";
          }
          if (count > 0) canvas.dataset.cleared = "false";
          samples++;
          totalTime += deltaMs;
          if (time - lastStats > 2 && samples > 50) {
            frameTime = totalTime / samples;
            samples = 0;
            totalTime = 0;
            lastStats = time;
            // Degrade snow count first. Only reduce DPR if the lower count is still over budget.
            if (!reduced && transitioning && frameTime > 23) {
              if (budget > 0.6) budget = Math.max(0.55, budget - 0.15);
              else if (dpr > 1) {
                dpr = Math.max(1, dpr - 0.25);
                qualityDrops++;
                resizeBuffer();
              }
            }
            element.dataset.fps = (1000 / Math.max(1, frameTime)).toFixed(1);
          }
          if (time - lastDebug > 0.15) {
            element.dataset.whiteout = String(Number(veil.style.opacity));
            element.dataset.density = motion.density.toFixed(3);
            element.dataset.particles = String(count);
            element.dataset.trackingMale = motion.trackingMale.toFixed(3);
            element.dataset.trackingFemale = motion.trackingFemale.toFixed(3);
            element.dataset.qualityDrops = String(qualityDrops);
            if (debugOutput.current)
              debugOutput.current.textContent = `${(p * 100).toFixed(1)}% · ${element.dataset.phase}\nSnow ${count}/${maximum} · DPR ${dpr.toFixed(2)}\n${(1000 / Math.max(1, frameTime)).toFixed(1)} fps · ${frameTime.toFixed(1)} ms/frame`;
            lastDebug = time;
          }
        };
        gsap.ticker.add(tick);
        let saved: string | null = null;
        try {
          saved = localStorage.getItem("todo.character.v1");
        } catch {}
        if (saved === "female") {
          select("female", true);
          commitCharacter("female");
          if (reduced) setReducedSide("female", true);
        } else {
          select("male", true);
          if (reduced) setReducedSide("male", true);
        }
        blink.next = gsap.ticker.time + 3 + random() * 3;
        element.dataset.loaded = "true";
        setLoaded(true);
        const dispose = () => {
          disposed = true;
          clearTimeout(resizeTimeout);
          observer.disconnect();
          window.removeEventListener("pointermove", change);
          window.removeEventListener("pointerdown", change);
          document.removeEventListener("pointerleave", leave);
          window.removeEventListener("resize", resize);
          gsap.ticker.remove(tick);
          lenis.off("scroll", ScrollTrigger.update);
          lenis.destroy();
          timeline.scrollTrigger?.kill();
          timeline.kill();
          gsap.killTweensOf(planes);
          history.scrollRestoration = oldRestoration;
        };
        engine.current = {
          select,
          rebuild: (t) => build(t),
          wink: () => {
            if (!reduced) {
              blink.start = gsap.ticker.time;
              blink.leftOnly = true;
            }
          },
          dispose,
        };
        cleanup = dispose;
      };
      prepare().catch((e) => {
        if (!cancelled) {
          console.error(
            "Todo intro could not start:",
            e instanceof Error ? e.name : "Unknown error",
          );
          setError("Todo couldn’t load just yet. Let’s try again.");
        }
      });
      return () => {
        cancelled = true;
        cleanup();
        engine.current = null;
      };
    }, [attempt, props.reduced]);

    const updateTiming = (key: keyof Timings, value: number) =>
      setTimings((t) => ({ ...t, [key]: value }));
    return (
      <section
        ref={root}
        className={`intro-experience ${props.active ? "intro-active" : "intro-away"}`}
        data-loaded={loaded}
        style={{ height: INTRO_CONFIG.sectionHeight }}
        aria-label="Meet your Todo companions"
      >
        <link
          rel="preload"
          href={INTRO_CONFIG.images.male.src}
          as="image"
          fetchPriority="high"
        />
        <link
          rel="preload"
          href={INTRO_CONFIG.images.female.src}
          as="image"
          fetchPriority="high"
        />
        <div
          className="intro-stage"
          inert={!props.active}
          aria-hidden={!props.active}
        >
          <h1 className="sr-only">
            A little company. A little progress. Meet Todo.
          </h1>
          {(["female", "male"] as const).map((character) => (
            <div
              key={character}
              className={`intro-face intro-${character}`}
              data-character={character}
            >
              <img
                src={INTRO_CONFIG.images[character].src}
                alt={INTRO_CONFIG.images[character].alt}
                width="1536"
                height="1024"
                fetchPriority="high"
                draggable={false}
              />
              <Eye character={character} side="leftEye" />
              <Eye character={character} side="rightEye" />
              <button
                className="intro-boop"
                aria-label={`Give ${character === "male" ? "him" : "her"} a little boop`}
                onClick={() => engine.current?.wink()}
              />
            </div>
          ))}
          <div className="intro-vignette" aria-hidden="true" />
          <div
            className="intro-veil"
            aria-hidden="true"
            style={{
              background: `radial-gradient(ellipse at 50% 44%,${INTRO_CONFIG.colors.veilCenter} 30%,${INTRO_CONFIG.colors.veilEdge} 100%)`,
            }}
          />
          <canvas className="intro-snow" aria-hidden="true" />
          <p className="intro-caption">{INTRO_CONFIG.caption}</p>
          <div className="intro-ui">
            <header className="intro-header">
              <a href="/" className="intro-wordmark" aria-label="Todo home">
                todo<span>•</span>
              </a>
              <span>your penguin, your pace</span>
              <Button
                variant="ghost"
                size="icon"
                className="intro-settings"
                aria-label="Open settings"
                disabled={!props.ready || !loaded}
                onClick={() => props.onChoose("settings")}
              >
                <Settings2 size={18} />
              </Button>
            </header>
            <footer className="intro-footer">
              <span>A little company. A little progress.</span>
              <button
                onClick={() => props.onChoose("notes")}
                disabled={!props.ready || !loaded}
              >
                <FileText size={13} />
                Your notes
              </button>
            </footer>
          </div>
          {(["male", "female"] as const).map((character) => (
            <section
              className={`intro-cards intro-cards-${character}`}
              key={character}
              aria-label={`Choose ${character} companion`}
            >
              <div className="intro-identity">
                <span className={character} />{" "}
                {character === "male"
                  ? "His corner. Your company."
                  : "Her corner. Your company."}
              </div>
              <div className="intro-card-row">
                {choices.map(({ id, label, description, icon: Icon }) => (
                  <button
                    key={id}
                    className={`intro-glass ${id === "solo" ? "intro-primary" : ""}`}
                    disabled={!props.ready || !loaded}
                    onClick={() => props.onChoose(id)}
                  >
                    <div>
                      <Icon size={25} strokeWidth={1.5} />
                      <ArrowRight size={17} />
                    </div>
                    <h2>
                      {label}
                      {id === "solo" ? <i /> : null}
                    </h2>
                    <p>{description}</p>
                  </button>
                ))}
              </div>
              {props.timer.started ? (
                <button
                  className="intro-timer-return"
                  onClick={() => props.onChoose("solo")}
                >
                  <Headphones size={13} />
                  {props.timer.clock} ·{" "}
                  {props.timer.running
                    ? "Your room is waiting"
                    : "Paused, no rush"}
                </button>
              ) : null}
            </section>
          ))}
          <button
            className="intro-scroll-hint"
            onClick={() => engine.current?.select("female")}
          >
            <ArrowDown size={14} />
            <span>scroll to meet her</span>
          </button>
          <div className="intro-picker" aria-label="Choose your companion">
            <button
              aria-pressed={selected === "male"}
              onClick={() => engine.current?.select("male")}
            >
              <i className="male" />
              Choose him
            </button>
            <button
              aria-pressed={selected === "female"}
              onClick={() => engine.current?.select("female")}
            >
              <i className="female" />
              Choose her
            </button>
          </div>
          {!loaded ? (
            <div className="intro-loading" role="status">
              {error ? (
                <>
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    onClick={() => setAttempt((a) => a + 1)}
                  >
                    Try again
                  </Button>
                </>
              ) : (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>A little company is on its way.</span>
                </>
              )}
            </div>
          ) : null}
          {debug ? (
            <aside className="intro-debug" data-lenis-prevent>
              <header>
                <strong>Intro tuning</strong>
                <button
                  aria-label="Close tuning panel"
                  onClick={() => setDebug(false)}
                >
                  <X size={14} />
                </button>
              </header>
              <output ref={debugOutput} className="intro-debug-readout" />
              {(
                [
                  ["closeStart", "Eyes close · start", 0.06, 0.18],
                  ["closeEnd", "Eyes close · end", 0.24, 0.36],
                  ["snowStart", "Snow begins", 0.18, 0.3],
                  ["whiteAt", "Full whiteout", 0.42, 0.47],
                  ["whiteUntil", "Whiteout ends", 0.54, 0.6],
                  ["clearEnd", "Snow clears", 0.74, 0.82],
                  ["openStart", "Eyes open · start", 0.7, 0.77],
                  ["openEnd", "Eyes open · end", 0.86, 0.92],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key}>
                  <span>
                    {label}
                    <b>{timings[key].toFixed(3)}</b>
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step=".005"
                    aria-label={label}
                    value={timings[key]}
                    onChange={(event) =>
                      updateTiming(key, Number(event.target.value))
                    }
                  />
                </label>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTimings({ ...INTRO_CONFIG.timings })}
              >
                Reset timings
              </Button>
              <small>Changes apply live to this preview.</small>
            </aside>
          ) : null}
        </div>
      </section>
    );
  },
);

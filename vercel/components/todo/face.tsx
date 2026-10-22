"use client";
import { memo, useEffect, useRef, type RefObject } from "react";

export type MotionPoint = { x: number; y: number; active: boolean };
type Props = {
  pointer: RefObject<MotionPoint>;
  reduced: boolean;
  active?: boolean;
  female?: boolean;
  reaction: string | null;
  blinking: boolean;
};

// Only the artwork is refracted. All UI stays in a separate, crisp DOM layer.
function FaceTexture({
  pointer,
  reduced,
  active = true,
}: Pick<Props, "pointer" | "reduced" | "active">) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node || reduced || !active) {
      if (node) node.style.opacity = "0";
      return;
    }
    const gl = node.getContext("webgl", { alpha: true, antialias: false });
    if (!gl) return;
    let frame = 0,
      stopped = false;
    const shader = (kind: number, source: string) => {
      const s = gl.createShader(kind)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    };
    const vertex = shader(
      gl.VERTEX_SHADER,
      "attribute vec2 p; varying vec2 uv; void main(){uv=vec2((p.x+1.0)*.5,1.0-(p.y+1.0)*.5); gl_Position=vec4(p,0.,1.);}",
    );
    const fragment = shader(
      gl.FRAGMENT_SHADER,
      `precision mediump float;
      varying vec2 uv; uniform sampler2D image; uniform vec2 mouse; uniform vec2 size; uniform float strength;
      void main(){vec2 delta=(uv-mouse)*vec2(size.x/size.y,1.); float lens=exp(-dot(delta,delta)/.0045)*strength;
      vec2 warped=uv-(uv-mouse)*lens*.13; gl_FragColor=texture2D(image,clamp(warped,0.,1.));}`,
    );
    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const m = gl.getUniformLocation(program, "mouse"),
      size = gl.getUniformLocation(program, "size"),
      strength = gl.getUniformLocation(program, "strength");
    let x = 0.5,
      y = 0.5,
      power = 0;
    const image = new Image();
    image.src = "/art/todo-face.png";
    function draw() {
      if (stopped || !node || !gl) return;
      const rect = node.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio, 1.5);
      if (
        document.hidden ||
        rect.bottom <= 0 ||
        rect.top >= window.innerHeight
      ) {
        frame = requestAnimationFrame(draw);
        return;
      }
      if (
        node.width !== Math.round(rect.width * dpr) ||
        node.height !== Math.round(rect.height * dpr)
      ) {
        node.width = Math.round(rect.width * dpr);
        node.height = Math.round(rect.height * dpr);
        gl.viewport(0, 0, node.width, node.height);
      }
      x += ((pointer.current.x - rect.left) / rect.width - x) * 0.12;
      y += ((pointer.current.y - rect.top) / rect.height - y) * 0.12;
      power += ((pointer.current.active && !reduced ? 1 : 0) - power) * 0.08;
      gl.uniform2f(m, x, y);
      gl.uniform2f(size, rect.width, rect.height);
      gl.uniform1f(strength, power);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = requestAnimationFrame(draw);
    }
    image.onload = () => {
      if (stopped) return;
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
      node.style.opacity = "1";
      draw();
    };
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [pointer, reduced, active]);
  return <canvas ref={canvas} aria-hidden="true" className="face-texture" />;
}

function Eye({
  side,
  pointer,
  reduced,
  reaction,
  blinking,
  active = true,
}: { side: "left" | "right" } & Omit<Props, "female">) {
  const eye = useRef<HTMLDivElement>(null),
    pupil = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced || !active) {
      if (pupil.current) pupil.current.style.transform = "translate(-50%,-50%)";
      return;
    }
    let frame = 0,
      x = 0,
      y = 0;
    function move() {
      if (eye.current && pupil.current) {
        const r = eye.current.getBoundingClientRect(),
          dx = pointer.current.x - r.left - r.width / 2,
          dy = pointer.current.y - r.top - r.height / 2;
        const length = Math.max(1, Math.hypot(dx, dy)),
          reach = Math.min(1, length / 280);
        const tx =
            pointer.current.active && !reduced
              ? (dx / length) * reach * r.width * 0.22
              : 0,
          ty =
            pointer.current.active && !reduced
              ? (dy / length) * reach * r.height * 0.17
              : 0;
        x += (tx - x) * 0.12;
        y += (ty - y) * 0.12;
        pupil.current.style.transform = `translate(calc(-50% + ${x}px),calc(-50% + ${y}px))`;
      }
      frame = requestAnimationFrame(move);
    }
    move();
    return () => cancelAnimationFrame(frame);
  }, [pointer, reduced, active]);
  return (
    <div
      ref={eye}
      className={`eye eye-${side} ${blinking || (reaction === "peace" && side === "left") ? "blink" : ""} ${reaction === "friends" ? "bright-eye" : ""}`}
    >
      <div className="pupil" ref={pupil}>
        <i />
        <b />
      </div>
      <div className="eyelid" />
    </div>
  );
}

export const Face = memo(function Face(props: Props) {
  return (
    <div
      className={`penguin-art ${props.female ? "female-art" : ""} ${props.reaction === "solo" ? "nod" : ""} ${props.reaction === "giggle" ? "giggle" : ""}`}
      aria-hidden="true"
    >
      <FaceTexture
        pointer={props.pointer}
        reduced={props.reduced}
        active={props.active}
      />
      <Eye side="left" {...props} />
      <Eye side="right" {...props} />
      {props.female ? (
        <>
          <svg
            className="face-lashes face-lashes-left"
            viewBox="0 0 60 40"
            aria-hidden="true"
          >
            <path
              d="M53 36Q27 31 20 10 M43 35Q22 26 15 4 M34 35Q15 38 5 20"
              fill="none"
              stroke="#312927"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <svg
            className="face-lashes face-lashes-right"
            viewBox="0 0 60 40"
            aria-hidden="true"
          >
            <path
              d="M53 36Q27 31 20 10 M43 35Q22 26 15 4 M34 35Q15 38 5 20"
              fill="none"
              stroke="#312927"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <div className="penguin-headband female-band">
            <span />
          </div>
          <div className="penguin-bow">
            <span />
            <i />
            <span />
          </div>
        </>
      ) : (
        <div className="penguin-headband">
          <span />
        </div>
      )}
      {props.reaction === "peace" ? (
        <div className="peace-flipper">
          <svg viewBox="0 0 120 150">
            <path
              d="M25 145 Q4 100 25 78 L16 24 Q15 4 31 12 L51 63 L58 10 Q62 -4 74 10 L73 76 Q108 66 111 99 Q115 130 85 150Z"
              fill="#383332"
            />
            <path
              d="M31 91 Q62 113 86 90"
              stroke="#68605a"
              strokeWidth="3"
              fill="none"
            />
          </svg>
        </div>
      ) : null}
      {props.reaction === "agent" ? <div className="beak-reaction" /> : null}
    </div>
  );
});

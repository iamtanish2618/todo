/** Native WebGL cursor refraction. A small, transparent canvas follows the cursor,
 * rather than repainting a full-screen surface. GSAP's shared ticker owns all draws. */
export function createArtLens(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.className = "intro-art-lens";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
  });
  if (!gl) return null;
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  };
  const vertex = shader(
    gl.VERTEX_SHADER,
    "attribute vec2 p;varying vec2 localUV;void main(){localUV=vec2((p.x+1.)*.5,1.-(p.y+1.)*.5);gl_Position=vec4(p,0.,1.);}",
  );
  const fragment = shader(
    gl.FRAGMENT_SHADER,
    `precision mediump float;
    varying vec2 localUV;uniform sampler2D art;uniform vec2 mouse;uniform vec2 span;uniform vec2 edges;uniform float aspect;uniform float power;
    void main(){vec2 uv=mouse+(localUV-.5)*span;
      vec2 d=(uv-mouse)*vec2(aspect,1.);float r=length(d);float radius=span.y*.5;
      float lens=exp(-dot(d,d)/.009)*power;float ring=sin(r*70.)*exp(-r*19.)*power*.003;
      vec2 sampleUV=uv-(uv-mouse)*(lens*.14+ring);
      vec4 c=texture2D(art,clamp(sampleUV,vec2(0.),vec2(1.)));
      float alpha=1.-smoothstep(radius*.70,radius,r);
      alpha*=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
      alpha*=clamp(uv.y/edges.x,0.,1.)*clamp((1.-uv.y)/(1.-edges.y),0.,1.);
      gl_FragColor=vec4(c.rgb,alpha);}`,
  );
  if (!vertex || !fragment) return null;
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const location = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  const edges = gl.getUniformLocation(program, "edges");
  const mouse = gl.getUniformLocation(program, "mouse"),
    span = gl.getUniformLocation(program, "span"),
    aspect = gl.getUniformLocation(program, "aspect"),
    power = gl.getUniformLocation(program, "power");
  let width = 1,
    height = 1,
    radius = 1,
    lastX = -9,
    lastY = -9,
    lastPower = -9,
    visible = false,
    draws = 0;
  const resize = (w: number, h: number, portrait = false) => {
    width = w;
    height = h;
    radius = Math.min(160, h * 0.2);
    const diameter = radius * 2,
      ratio = Math.min(devicePixelRatio || 1, 1.25);
    canvas.width = canvas.height = Math.round(diameter * ratio);
    canvas.style.width = canvas.style.height = `${diameter}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(aspect, w / h);
    gl.uniform2f(edges, portrait ? 0.08 : 0.05, portrait ? 0.84 : 0.9);
    gl.uniform2f(span, diameter / w, diameter / h);
    lastPower = -9;
  };
  return {
    canvas,
    resize,
    get draws() {
      return draws;
    },
    render(x: number, y: number, strength: number) {
      if (gl.isContextLost()) return;
      const show = strength > 0.003;
      if (show !== visible) {
        canvas.style.opacity = show ? "1" : "0";
        visible = show;
      }
      if (!show) return;
      const u = x / width,
        v = y / height;
      if (
        Math.abs(u - lastX) < 0.00008 &&
        Math.abs(v - lastY) < 0.00008 &&
        Math.abs(strength - lastPower) < 0.002
      )
        return;
      canvas.style.transform = `translate3d(${x - radius}px,${y - radius}px,0)`;
      gl.uniform2f(mouse, u, v);
      gl.uniform1f(power, strength);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      draws++;
      lastX = u;
      lastY = v;
      lastPower = strength;
    },
    dispose() {
      canvas.remove();
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}

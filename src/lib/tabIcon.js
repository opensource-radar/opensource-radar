// Turns the radar sweep in the browser tab's icon, like the logo on the page.
//
// Firefox animates the SVG favicon by itself (see public/favicon.svg). Other
// browsers only show an SVG favicon's first frame, so here the icon is drawn
// on a canvas, frame by frame, while the tab is open in front. When the tab is
// in the background, or the person prefers reduced motion, the normal icon is
// shown and nothing runs.

const FRAMES = 36; // one frame every 10 degrees
const TURN_MS = 4000; // one turn every 4 seconds, the same as the logo
const SIZE = 64; // drawn at 2x so it stays sharp on high-resolution screens

const BACKGROUND = "#0d1117";
const GREEN = "#3fb950";
const RINGS = [
  { r: 14.5, alpha: 1 },
  { r: 8.5, alpha: 0.55 },
];
// Blips light up as the sweep passes them, then fade: the same spots and
// timing as the logo's (the line starts at 315 degrees, turning clockwise).
export const BLIPS = [
  { x: 26.34, y: 19.76, r: 1.8, angle: 20 },
  { x: 10.8, y: 19, r: 1.6, angle: 150 },
];
const LINE_START = 315;

// How bright a blip is, from how far the line has turned since it passed:
// full right after, fading to 0.2 over the next 60% of a turn.
export function blipAlpha(turnedSince) {
  const fraction = (((turnedSince % 360) + 360) % 360) / 360;
  return fraction < 0.6 ? 1 - (0.8 * fraction) / 0.6 : 0.2;
}

const TRAIL = "M16 16 L16 1.5 A14.5 14.5 0 0 1 26.25 5.75 Z";
const LINE = "M16 16 L26.25 5.75";

// Draws one frame, with the sweep turned by `angle` radians.
export function drawFrame(ctx, angle, makePath = (d) => new Path2D(d)) {
  const scale = SIZE / 32;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, 32, 32);

  ctx.fillStyle = BACKGROUND;
  ctx.beginPath();
  ctx.roundRect(0, 0, 32, 32, 7);
  ctx.fill();

  // The same artwork as favicon.svg, which sits in a 25-unit square in the middle.
  ctx.translate(3.5, 3.5);
  ctx.scale(0.78125, 0.78125);
  ctx.strokeStyle = GREEN;
  ctx.fillStyle = GREEN;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";

  for (const ring of RINGS) {
    ctx.globalAlpha = ring.alpha;
    ctx.beginPath();
    ctx.arc(16, 16, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(16, 16);
  ctx.rotate(angle);
  ctx.translate(-16, -16);
  ctx.globalAlpha = 0.35;
  ctx.fill(makePath(TRAIL));
  ctx.globalAlpha = 1;
  ctx.stroke(makePath(LINE));
  ctx.restore();

  const lineAngle = LINE_START + (angle * 180) / Math.PI;
  for (const blip of BLIPS) {
    ctx.globalAlpha = blipAlpha(lineAngle - blip.angle);
    ctx.beginPath();
    ctx.arc(blip.x, blip.y, blip.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(16, 16, 2.8, 0, Math.PI * 2);
  ctx.fill();
}

// Draws every frame once, as image addresses. Returns null where a canvas
// can't be drawn on, so the site keeps its normal icon.
export function renderFrames(doc = document) {
  const canvas = doc.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  let ctx;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    return null;
  }
  if (!ctx || typeof ctx.roundRect !== "function" || typeof Path2D === "undefined") return null;
  const frames = [];
  for (let i = 0; i < FRAMES; i += 1) {
    drawFrame(ctx, (i / FRAMES) * Math.PI * 2);
    frames.push(canvas.toDataURL("image/png"));
  }
  return frames;
}

// Starts the turning icon. Returns a function that stops it and puts the
// normal icon back.
export function startTabIcon({
  doc = document,
  win = window,
  frames: makeFrames = renderFrames,
} = {}) {
  const link = doc.querySelector('link[rel="icon"]');
  if (!link) return () => {};
  // Firefox already turns the SVG icon itself.
  if (/firefox/i.test(win.navigator?.userAgent ?? "")) return () => {};

  const normalIcon = link.getAttribute("href");
  const normalType = link.getAttribute("type");
  const reduceMotion = win.matchMedia?.("(prefers-reduced-motion: reduce)");
  let frames = null;
  let timer = null;
  let index = 0;

  const showNormal = () => {
    link.setAttribute("href", normalIcon);
    if (normalType) link.setAttribute("type", normalType);
  };

  const stop = () => {
    if (timer !== null) win.clearInterval(timer);
    timer = null;
    showNormal();
  };

  const tick = () => {
    link.setAttribute("href", frames[index]);
    index = (index + 1) % frames.length;
  };

  const update = () => {
    const shouldRun = doc.visibilityState === "visible" && !reduceMotion?.matches;
    if (!shouldRun) {
      stop();
      return;
    }
    if (timer !== null) return;
    if (!frames) frames = makeFrames(doc);
    if (!frames || frames.length === 0) return;
    link.setAttribute("type", "image/png");
    tick();
    timer = win.setInterval(tick, TURN_MS / frames.length);
  };

  doc.addEventListener("visibilitychange", update);
  reduceMotion?.addEventListener?.("change", update);
  update();

  return () => {
    doc.removeEventListener("visibilitychange", update);
    reduceMotion?.removeEventListener?.("change", update);
    stop();
  };
}

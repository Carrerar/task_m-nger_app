// Decorative scroll-driven train that rides a rail down the page and tints
// itself to the colour of the section it is currently travelling through.
// Purely cosmetic: pointer-events disabled, no app state, degrades to a no-op
// outside a real browser (so the smoke harness stays happy).

const SVG_NS = "http://www.w3.org/2000/svg";

// Sections the train passes, in document order, each with its zone colour.
const ZONES = [
  { selector: ".calendar-panel", color: "#a472f6" },
  { selector: ".task-panel", color: "#5b8def" },
  { selector: ".dashboard", color: "#2fb6a8" },
];

const CAR_COUNT = 3;

function activeZoneColor() {
  const mid = window.innerHeight / 2;
  let best = ZONES[0].color;
  let bestDist = Infinity;
  for (const zone of ZONES) {
    const el = document.querySelector(zone.selector);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (mid >= rect.top && mid <= rect.bottom) return zone.color;
    const dist = mid < rect.top ? rect.top - mid : mid - rect.bottom;
    if (dist < bestDist) {
      bestDist = dist;
      best = zone.color;
    }
  }
  return best;
}

export function initTrain() {
  if (typeof document === "undefined" || typeof document.createElementNS !== "function") return;
  if (!window.requestAnimationFrame || !document.body) return;

  const root = document.createElement("div");
  root.className = "train-rail";
  root.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 64 1000");
  svg.setAttribute("preserveAspectRatio", "none");

  // A gently winding rail so the train visibly travels on a diagonal.
  const d = "M 22 0 C 52 170, 8 360, 34 540 S 54 820, 20 1000";
  const rail = document.createElementNS(SVG_NS, "path");
  rail.setAttribute("class", "train-rail-base");
  rail.setAttribute("d", d);

  const progress = document.createElementNS(SVG_NS, "path");
  progress.setAttribute("class", "train-rail-progress");
  progress.setAttribute("d", d);

  svg.append(rail, progress);

  const cars = [];
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const car = document.createElementNS(SVG_NS, "rect");
    car.setAttribute("class", i === 0 ? "train-car train-engine" : "train-car");
    car.setAttribute("width", i === 0 ? 13 : 11);
    car.setAttribute("height", i === 0 ? 13 : 10);
    car.setAttribute("rx", 3);
    svg.append(car);
    cars.push(car);
  }
  root.append(svg);
  document.body.append(root);

  let total = 0;
  try {
    total = progress.getTotalLength();
  } catch {
    root.remove();
    return;
  }
  if (!Number.isFinite(total) || total <= 0) {
    root.remove();
    return;
  }
  progress.style.strokeDasharray = String(total);

  let ticking = false;

  const update = () => {
    ticking = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(1, Math.max(0, (window.scrollY || window.pageYOffset || 0) / max)) : 0;

    const color = activeZoneColor();
    root.style.setProperty("--train-color", color);
    // Expose the active zone colour globally so the page background can
    // tint itself to match the train.
    doc.style.setProperty("--train-color", color);

    const headLen = pct * total;
    progress.style.strokeDashoffset = String(total - headLen);

    const gap = Math.max(15, total * 0.02);
    cars.forEach((car, i) => {
      const at = Math.max(0, headLen - i * gap);
      const p = progress.getPointAtLength(at);
      const ahead = progress.getPointAtLength(Math.min(total, at + 1));
      const angle = (Math.atan2(ahead.y - p.y, ahead.x - p.x) * 180) / Math.PI;
      const w = i === 0 ? 13 : 11;
      const h = i === 0 ? 13 : 10;
      car.setAttribute("x", p.x - w / 2);
      car.setAttribute("y", p.y - h / 2);
      car.setAttribute(
        "transform",
        `rotate(${angle} ${p.x} ${p.y})`,
      );
      car.style.opacity = String(1 - i * 0.22);
    });
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
}

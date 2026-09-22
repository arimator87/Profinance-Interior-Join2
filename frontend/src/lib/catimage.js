// Deterministic 2D placeholder image (SVG data URI) with a centered "block" text.
// Used as the ultimate fallback so every project/category always shows an image.

const PALETTE = [
  ["#d97706", "#b45309"], // amber
  ["#2563eb", "#1d4ed8"], // blue
  ["#0d9488", "#0f766e"], // teal
  ["#7c3aed", "#6d28d9"], // violet
  ["#dc2626", "#b91c1c"], // red
  ["#0891b2", "#0e7490"], // cyan
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Returns an <img>-ready data URI with the label rendered as bold block text in the center.
export function defaultCatImage(name) {
  const label = String(name || "Proyek").toUpperCase();
  const [c1, c2] = PALETTE[hashStr(label) % PALETTE.length];
  const fontSize = label.length > 12 ? 56 : label.length > 8 ? 68 : 84;
  const blockW = Math.min(680, Math.max(320, label.length * (fontSize * 0.62) + 80));
  const blockX = (800 - blockW) / 2;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'>
  <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs>
  <rect width='800' height='600' fill='url(#g)'/>
  <rect x='40' y='40' width='720' height='520' rx='24' fill='none' stroke='#ffffff' stroke-opacity='0.18' stroke-width='4'/>
  <rect x='${blockX}' y='230' width='${blockW}' height='140' rx='16' fill='rgba(0,0,0,0.28)'/>
  <text x='400' y='300' font-family='Arial, Helvetica, sans-serif' font-size='${fontSize}' font-weight='800' fill='#ffffff' text-anchor='middle' dominant-baseline='middle' letter-spacing='2'>${label}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

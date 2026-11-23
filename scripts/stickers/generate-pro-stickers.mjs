// Generates the Glow Pro sticker pack (static SVGs) into the directory given as argv[2].
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
mkdirSync(out, { recursive: true });

const n = (v) => {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
};
const svg = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 128 128"><defs>${defs}</defs>${body}</svg>\n`;
const lin = (id, stops, x2 = 1, y2 = 1, x1 = 0, y1 = 0) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(
      ([o, c, a]) =>
        `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`,
    )
    .join('')}</linearGradient>`;
const rad = (id, stops) =>
  `<radialGradient id="${id}">${stops
    .map(
      ([o, c, a]) =>
        `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`,
    )
    .join('')}</radialGradient>`;
/** Soft glow disc: a radial gradient fading to transparent (no filters). */
const glowDisc = (id, cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`;
/** Neon halo: the same outline stroked wide and faint, twice. */
const halo = (d, colour, w1 = 14, w2 = 7) =>
  `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${w1}" stroke-linejoin="round" opacity=".14"/><path d="${d}" fill="none" stroke="${colour}" stroke-width="${w2}" stroke-linejoin="round" opacity=".28"/>`;
const sparkle = (cx, cy, s, fill) =>
  `<path d="M${n(cx)} ${n(cy - s)}q${n(s * 0.12)} ${n(s * 0.88)} ${n(s)} ${n(s)}q${n(-s * 0.88)} ${n(s * 0.12)} ${n(-s)} ${n(s)}q${n(-s * 0.12)} ${n(-s * 0.88)} ${n(-s)} ${n(-s)}q${n(s * 0.88)} ${n(-s * 0.12)} ${n(s)} ${n(-s)}z" fill="${fill}"/>`;
const star = (cx, cy, outer, inner, points, rotation = -90) => {
  const pts = [];
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((rotation + (i * 180) / points) * Math.PI) / 180;
    pts.push(`${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`);
  }
  return `M${pts.join('L')}z`;
};
const NEON = [
  [0, '#FF5FD2'],
  [1, '#7C4DFF'],
];

const files = {};

// 1. Neon heart
const heart = 'M64 108C29 84 13 64 13 44a24 24 0 0 1 51-13 24 24 0 0 1 51 13c0 20-16 40-51 64z';
files['neon-heart'] = svg(
  lin('a', NEON),
  `${halo(heart, '#FF4FD8', 16, 8)}<path d="${heart}" fill="url(#a)"/><path d="M26 42a14 14 0 0 1 20-12" fill="none" stroke="#FFE3F7" stroke-width="5" stroke-linecap="round" opacity=".8"/>${sparkle(104, 20, 9, '#00E5FF')}`,
);

// 2. Star burst
files['star-burst'] = svg(
  rad('a', [
    [0, '#FFF3B0'],
    [1, '#FF9F1C'],
  ]) +
    lin('b', NEON) +
    rad('g', [
      [0, '#FFD166', 0.5],
      [1, '#FFD166', 0],
    ]),
  `${glowDisc('g', 64, 64, 64)}<path d="${star(64, 64, 58, 45, 16, -78.75)}" fill="url(#a)"/><path d="${star(64, 66, 32, 14, 5)}" fill="url(#b)"/><circle cx="57" cy="56" r="3.5" fill="#fff" opacity=".7"/>`,
);

// 3. Crown
files.crown = svg(
  lin(
    'a',
    [
      [0, '#FFF0A8'],
      [1, '#F5A623'],
    ],
    0,
    1,
  ) +
    lin(
      'b',
      [
        [0, '#F5A623'],
        [1, '#D9730D'],
      ],
      0,
      1,
    ) +
    rad('g', [
      [0, '#FFD166', 0.5],
      [1, '#FFD166', 0],
    ]),
  `${glowDisc('g', 64, 68, 60)}<path d="M18 86L24 40L45 62L64 28L83 62L104 40L110 86z" fill="url(#a)" stroke="#F5A623" stroke-width="2" stroke-linejoin="round"/><circle cx="24" cy="38" r="7" fill="url(#a)"/><circle cx="64" cy="26" r="7" fill="url(#a)"/><circle cx="104" cy="38" r="7" fill="url(#a)"/><rect x="16" y="82" width="96" height="20" rx="6" fill="url(#b)"/><circle cx="38" cy="92" r="5" fill="#00E5FF"/><path d="M64 85l7 7-7 7-7-7z" fill="#FF4F8B"/><circle cx="90" cy="92" r="5" fill="#7CFFB2"/><path d="M30 76l3-24" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>`,
);

// 4. Lightning
const bolt = 'M76 8L30 72H60L50 120L100 52H70z';
files.lightning = svg(
  lin(
    'a',
    [
      [0, '#7DF9FF'],
      [1, '#7C4DFF'],
    ],
    0.6,
    1,
    0.4,
    0,
  ),
  `${halo(bolt, '#00E5FF', 16, 8)}<path d="${bolt}" fill="url(#a)" stroke="#E0FDFF" stroke-width="2" stroke-linejoin="round"/><path d="M68 22L44 60" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
);

// 5. Sparkle cluster
files.sparkles = svg(
  lin('a', [
    [0, '#00E5FF'],
    [0.5, '#7C4DFF'],
    [1, '#FF5FD2'],
  ]) +
    rad('g', [
      [0, '#B9A3FF', 0.55],
      [1, '#7C4DFF', 0],
    ]),
  `${glowDisc('g', 56, 66, 50)}${sparkle(54, 66, 42, 'url(#a)')}${sparkle(100, 28, 18, 'url(#a)')}${sparkle(100, 98, 12, 'url(#a)')}${sparkle(20, 20, 8, '#FFD166')}<circle cx="54" cy="66" r="5" fill="#fff" opacity=".85"/>`,
);

// 6. Glowing moon (crescent from two circles)
const crescent = (() => {
  const [cx, cy, r] = [60, 66, 42];
  const [dx, dy, rr] = [84, 46, 36];
  const d = Math.hypot(dx - cx, dy - cy);
  const a = (r * r - rr * rr + d * d) / (2 * d);
  const h = Math.sqrt(r * r - a * a);
  const mx = cx + (a * (dx - cx)) / d;
  const my = cy + (a * (dy - cy)) / d;
  const p1 = [mx + (h * (dy - cy)) / d, my - (h * (dx - cx)) / d];
  const p2 = [mx - (h * (dy - cy)) / d, my + (h * (dx - cx)) / d];
  return `M${n(p1[0])} ${n(p1[1])}A${r} ${r} 0 1 0 ${n(p2[0])} ${n(p2[1])}A${rr} ${rr} 0 0 1 ${n(p1[0])} ${n(p1[1])}z`;
})();
files.moon = svg(
  lin('a', [
    [0, '#FFF6C9'],
    [1, '#FFC23D'],
  ]) +
    rad('g', [
      [0, '#FFD166', 0.45],
      [1, '#FFD166', 0],
    ]),
  `${glowDisc('g', 60, 66, 62)}<path d="${crescent}" fill="url(#a)"/><circle cx="40" cy="84" r="6" fill="#E89B12" opacity=".25"/><circle cx="34" cy="62" r="4" fill="#E89B12" opacity=".25"/><circle cx="56" cy="100" r="3.5" fill="#E89B12" opacity=".25"/>${sparkle(100, 82, 10, '#00E5FF')}${sparkle(110, 22, 6, '#fff')}`,
);

// 7. Gem
files.gem = svg(
  lin('a', [
    [0, '#7DF9FF'],
    [0.55, '#7C4DFF'],
    [1, '#FF5FD2'],
  ]) +
    rad('g', [
      [0, '#00E5FF', 0.4],
      [1, '#00E5FF', 0],
    ]),
  `${glowDisc('g', 64, 66, 62)}<path d="M40 24H88L114 50L64 112L14 50z" fill="url(#a)"/><path d="M40 24H64L52 50z" fill="#fff" opacity=".55"/><path d="M64 24H88L76 50z" fill="#fff" opacity=".3"/><path d="M40 24L52 50H14z" fill="#fff" opacity=".4"/><path d="M88 24L114 50H76z" fill="#fff" opacity=".12"/><path d="M14 50H52L64 112z" fill="#fff" opacity=".22"/><path d="M76 50H114L64 112z" fill="#1E1240" opacity=".25"/><path d="M40 24H88L114 50L64 112L14 50z" fill="none" stroke="#E6FDFF" stroke-width="2.5" stroke-linejoin="round"/>${sparkle(104, 18, 9, '#fff')}`,
);

// 8. Flame
const flame =
  'M64 8C72 34 102 46 102 80a38 38 0 0 1-76 0c0-16 8-28 16-36c0 12 6 18 12 20C58 44 52 26 64 8z';
files.flame = svg(
  lin(
    'a',
    [
      [0, '#FFD166'],
      [0.55, '#FF7A3D'],
      [1, '#FF3B6B'],
    ],
    0,
    1,
  ) +
    lin(
      'b',
      [
        [0, '#FFFBE6'],
        [1, '#FFD166'],
      ],
      0,
      1,
    ),
  `${halo(flame, '#FF7A3D', 14, 7)}<path d="${flame}" fill="url(#a)"/><path d="M64 60c4 12 20 18 20 34a20 20 0 0 1-40 0c0-10 8-16 10-22c2 6 6 8 8 8c0-6-2-12 2-20z" fill="url(#b)"/>`,
);

// 9. Rainbow arc
const arc = (r) => `M${64 - r} 92A${r} ${r} 0 0 1 ${64 + r} 92`;
const bands = [
  [50, '#FF5FD2'],
  [41, '#FF9F1C'],
  [32, '#FFD166'],
  [23, '#00E5FF'],
];
files.rainbow = svg(
  lin(
    'a',
    [
      [0, '#FFFFFF'],
      [1, '#D6DEFF'],
    ],
    0,
    1,
  ),
  `<path d="${arc(37)}" fill="none" stroke="#B9A3FF" stroke-width="44" opacity=".16"/>${bands
    .map(([r, c]) => `<path d="${arc(r)}" fill="none" stroke="${c}" stroke-width="9"/>`)
    .join(
      '',
    )}<path d="M4 102a12 12 0 0 1 14-16a14 14 0 0 1 26 4a10 10 0 0 1-2 20H12a10 10 0 0 1-8-8z" fill="url(#a)"/><path d="M76 102a12 12 0 0 1 14-16a14 14 0 0 1 26 4a10 10 0 0 1-2 20H84a10 10 0 0 1-8-8z" fill="url(#a)"/>${sparkle(64, 22, 8, '#fff')}`,
);

// 10. Holographic WOW badge (letters drawn as strokes: no font dependency)
const scallop = (() => {
  const bumps = 16;
  const parts = [];
  for (let i = 0; i <= bumps; i += 1) {
    const a = (i / bumps) * Math.PI * 2 - Math.PI / 2;
    const p = [64 + 54 * Math.cos(a), 64 + 54 * Math.sin(a)];
    if (i === 0) {
      parts.push(`M${n(p[0])} ${n(p[1])}`);
    } else {
      const m = a - Math.PI / bumps;
      parts.push(`Q${n(64 + 66 * Math.cos(m))} ${n(64 + 66 * Math.sin(m))} ${n(p[0])} ${n(p[1])}`);
    }
  }
  return `${parts.join('')}z`;
})();
files['wow-badge'] = svg(
  lin('a', [
    [0, '#00E5FF'],
    [0.35, '#B9A3FF'],
    [0.65, '#FF5FD2'],
    [1, '#FFD166'],
  ]) +
    lin(
      'b',
      [
        [0, '#FFFFFF'],
        [1, '#7DF9FF'],
      ],
      0,
      1,
    ),
  `<path d="${scallop}" fill="url(#a)"/><circle cx="64" cy="64" r="42" fill="#1E1240"/><circle cx="64" cy="64" r="42" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/><path d="M30 54l5 20 6-14 6 14 5-20M76 54l5 20 6-14 6 14 5-20" fill="none" stroke="url(#b)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="64" cy="64" rx="6.5" ry="10" fill="none" stroke="url(#b)" stroke-width="5"/><path d="M34 38q12-10 28-12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/>`,
);

// 11. Neon sunglasses
const lenses = 'M14 52h42v12c0 14-8 24-21 24S14 78 14 64zM72 52h42v12c0 14-8 24-21 24S72 78 72 64z';
files.shades = svg(
  lin(
    'a',
    [
      [0, '#FF5FD2'],
      [0.5, '#7C4DFF'],
      [1, '#00E5FF'],
    ],
    1,
    1,
    0,
    0.2,
  ),
  `${halo(lenses, '#FF4FD8', 14, 7)}<rect x="8" y="44" width="112" height="12" rx="6" fill="#1A1A1A"/><path d="M56 58q8-7 16 0" fill="none" stroke="#1A1A1A" stroke-width="6" stroke-linecap="round"/><path d="${lenses}" fill="url(#a)" stroke="#1A1A1A" stroke-width="4" stroke-linejoin="round"/><path d="M22 62l10-8M26 72l16-14M80 62l10-8M84 72l16-14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
);

// 12. Rocket (drawn upright, then tilted 45 degrees)
files.rocket = svg(
  lin(
    'a',
    [
      [0, '#FFFFFF'],
      [1, '#C9D2FF'],
    ],
    1,
    0,
  ) +
    lin('b', NEON, 0, 1) +
    lin(
      'c',
      [
        [0, '#FFD166'],
        [1, '#FF3B6B'],
      ],
      0,
      1,
    ) +
    rad('g', [
      [0, '#FF7A3D', 0.5],
      [1, '#FF7A3D', 0],
    ]),
  `<g transform="rotate(45 64 64)">${glowDisc('g', 64, 104, 26)}<path d="M54 86h20c0 14-6 24-10 32c-4-8-10-18-10-32z" fill="url(#c)"/><path d="M44 62L26 90l20-4zM84 62l18 28-20-4z" fill="url(#b)"/><path d="M64 8c18 14 24 40 20 70H44c-4-30 2-56 20-70z" fill="url(#a)"/><path d="M50 78h28l-4 10H54z" fill="#5C5C7A"/><circle cx="64" cy="46" r="11" fill="#7C4DFF"/><circle cx="64" cy="46" r="7" fill="#00E5FF"/><circle cx="61.5" cy="43.5" r="2.5" fill="#fff"/><path d="M64 8c8 6 13 14 16 22H48c3-8 8-16 16-22z" fill="#FF5FD2"/></g>${sparkle(22, 24, 7, '#FFD166')}${sparkle(106, 104, 6, '#00E5FF')}`,
);

let total = 0;
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(out, `${name}.svg`), content);
  total += Buffer.byteLength(content);
  console.log(name.padEnd(12), Buffer.byteLength(content));
}
console.log('total', total);

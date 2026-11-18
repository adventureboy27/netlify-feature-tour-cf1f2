// The room around the ring, as the night actually had it (ui/match/setting.ts).
//
// All in the arena picture's own units (Arena.tsx VIEW, 1200 x 600): the
// walls and floor, the house lights when there is no rig, whatever hangs
// where a big screen would be when there is no screen, the entrance, the
// sound stacks. Arena.tsx draws the rig, the crowd and the ring over this.

import type { Setting } from './setting';

const W = 1200;

/** Walls, sky, floor: the building itself. */
export function Room({ setting }: { setting: Setting }) {
  switch (setting.family) {
    case 'backyard':
      return (
        <g>
          <defs>
            <linearGradient id="mv-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d1428" />
              <stop offset="70%" stopColor="#2a2546" />
              <stop offset="100%" stopColor="#3e2f45" />
            </linearGradient>
          </defs>
          <rect width={W} height={600} fill="url(#mv-sky)" />
          {Array.from({ length: 40 }, (_, i) => (
            <circle key={i} cx={(i * 197) % W} cy={(i * 83) % 150 + 8} r={i % 5 === 0 ? 1.6 : 1} fill="#fff" opacity={0.6} />
          ))}
          {/* Trees, and the neighbour's roof. */}
          <path d="M 0,250 C 60,170 120,190 170,230 C 210,160 300,170 330,240 L 330,300 L 0,300 Z" fill="#0b1210" />
          <path d="M 880,250 C 930,180 1020,175 1060,230 C 1100,190 1180,200 1200,240 L 1200,300 L 880,300 Z" fill="#0b1210" />
          <path d="M 420,262 L 520,200 L 640,262 Z" fill="#141722" />
          <rect x={440} y={262} width={180} height={50} fill="#1b1f2c" />
          <rect x={500} y={276} width={22} height={18} fill="#e8c46a" opacity={0.7} />
          {/* The fence, and the yard. */}
          <rect x={0} y={262} width={W} height={84} fill="#5b4330" />
          {Array.from({ length: 49 }, (_, i) => (
            <path key={i} d={`M ${i * 25},262 L ${i * 25},346 M ${i * 25 + 12},258 L ${i * 25 + 12},346`} stroke="#3f2e20" strokeWidth={2} />
          ))}
          <rect x={0} y={346} width={W} height={254} fill="#24391d" />
          <rect x={0} y={346} width={W} height={20} fill="#1b2c16" />
        </g>
      );
    case 'openAir':
      return (
        <g>
          <defs>
            <linearGradient id="mv-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b1124" />
              <stop offset="100%" stopColor="#262b48" />
            </linearGradient>
          </defs>
          <rect width={W} height={600} fill="url(#mv-sky)" />
          {Array.from({ length: 30 }, (_, i) => (
            <circle key={i} cx={(i * 211) % W} cy={(i * 67) % 120 + 6} r={1} fill="#fff" opacity={0.5} />
          ))}
          <path d="M 0,214 C 150,196 260,206 400,200 C 560,194 700,208 860,198 C 1000,190 1100,204 1200,198 L 1200,230 L 0,230 Z" fill="#0b1210" />
          {/* Bleachers. */}
          <rect x={0} y={214} width={W} height={132} fill="#3a3f48" />
          {[234, 262, 292, 322].map((y) => (
            <rect key={y} x={0} y={y} width={W} height={6} fill="#5d6470" />
          ))}
          <rect x={0} y={346} width={W} height={254} fill="#2a2f22" />
        </g>
      );
    case 'gym':
      return (
        <g>
          {/* Cinder block, a court, a hoop folded up out of the way. */}
          <rect width={W} height={600} fill="#b5a07c" />
          {Array.from({ length: 22 }, (_, r) => (
            <g key={r}>
              <line x1={0} y1={r * 18} x2={W} y2={r * 18} stroke="#9a8664" strokeWidth={1.5} />
              {Array.from({ length: 31 }, (_, c) => (
                <line key={c} x1={c * 40 + (r % 2) * 20} y1={r * 18} x2={c * 40 + (r % 2) * 20} y2={r * 18 + 18} stroke="#9a8664" strokeWidth={1.2} />
              ))}
            </g>
          ))}
          <rect x={0} y={190} width={W} height={10} fill="#7a1f24" />
          {/* The hoop, cranked up against the wall. */}
          <g transform="translate(160,40)">
            <rect x={0} y={0} width={70} height={48} fill="#f3f1ea" stroke="#555" strokeWidth={2} />
            <rect x={22} y={18} width={26} height={20} fill="none" stroke="#c43" strokeWidth={2} />
            <path d="M 18,50 L 52,50 L 46,72 L 24,72 Z" fill="none" stroke="#ddd" strokeWidth={1.5} />
          </g>
          {/* Bleachers, pulled out. */}
          <rect x={0} y={222} width={W} height={124} fill="#8a6a43" />
          {[240, 268, 298, 328].map((y) => (
            <rect key={y} x={0} y={y} width={W} height={7} fill="#a8854f" />
          ))}
          {/* The court. */}
          <rect x={0} y={346} width={W} height={254} fill="#c79a5d" />
          {Array.from({ length: 30 }, (_, i) => (
            <line key={i} x1={i * 40} y1={346} x2={i * 40 - 60} y2={600} stroke="#b58a4f" strokeWidth={1.5} />
          ))}
          <path d="M 0,560 L 1200,560" stroke="#f5f2ea" strokeWidth={4} opacity={0.8} />
        </g>
      );
    case 'hall':
      return (
        <g>
          {/* Wood panelling under a drop ceiling. */}
          <rect width={W} height={600} fill="#5a4330" />
          {Array.from({ length: 40 }, (_, i) => (
            <line key={i} x1={i * 30} y1={70} x2={i * 30} y2={346} stroke="#4a3626" strokeWidth={3} />
          ))}
          <rect x={0} y={0} width={W} height={70} fill="#d8d5cc" />
          {Array.from({ length: 13 }, (_, i) => (
            <line key={i} x1={i * 100} y1={0} x2={i * 100} y2={70} stroke="#b7b3a8" strokeWidth={2} />
          ))}
          <line x1={0} y1={35} x2={W} y2={35} stroke="#b7b3a8" strokeWidth={2} />
          <rect x={0} y={346} width={W} height={254} fill="#77736a" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1={0} y1={346 + i * 22} x2={W} y2={346 + i * 22} stroke="#6b675e" strokeWidth={1.2} />
          ))}
        </g>
      );
    case 'club':
      return (
        <g>
          <rect width={W} height={600} fill="#1c1210" />
          {Array.from({ length: 20 }, (_, r) => (
            <g key={r} opacity={0.6}>
              <line x1={0} y1={r * 17} x2={W} y2={r * 17} stroke="#2e1d17" strokeWidth={2} />
              {Array.from({ length: 25 }, (_, c) => (
                <line key={c} x1={c * 50 + (r % 2) * 25} y1={r * 17} x2={c * 50 + (r % 2) * 25} y2={r * 17 + 17} stroke="#2e1d17" strokeWidth={2} />
              ))}
            </g>
          ))}
          <rect x={0} y={346} width={W} height={254} fill="#120c0b" />
        </g>
      );
    case 'theatre':
      return (
        <g>
          <rect width={W} height={600} fill="#120709" />
          {/* The proscenium's curtain, behind the house. */}
          {Array.from({ length: 30 }, (_, i) => (
            <rect key={i} x={i * 40} y={0} width={40} height={230} fill={i % 2 ? '#5e0f17' : '#4a0b12'} />
          ))}
          <rect x={0} y={0} width={W} height={26} fill="#7d1520" />
          <rect x={0} y={346} width={W} height={254} fill="#1a0e10" />
        </g>
      );
    case 'stadium':
    case 'arena':
      return (
        <g>
          <rect width={W} height={600} fill="url(#mv-bg)" />
          {setting.family === 'stadium' && (
            // The upper deck: rows on rows, going up into the dark.
            <g opacity={0.8}>
              {[150, 170, 190, 208].map((y, i) => (
                <rect key={y} x={0} y={y} width={W} height={12 - i} fill="#141822" />
              ))}
            </g>
          )}
          <rect x={0} y={380} width={W} height={220} fill="url(#mv-floor)" />
        </g>
      );
  }
}

/** The light in a room with no rig: tubes, bulbs on a string, floodlights. */
export function HouseLights({ setting }: { setting: Setting }) {
  if (setting.lights) return null;
  switch (setting.family) {
    case 'backyard':
      return (
        <g>
          <path d="M 0,120 Q 300,170 600,120 Q 900,170 1200,120" fill="none" stroke="#222" strokeWidth={1.5} />
          {Array.from({ length: 24 }, (_, i) => {
            const t = (i + 0.5) / 24;
            const x = t * 1200;
            const local = (x % 600) / 600;
            const y = 120 + Math.sin(local * Math.PI) * 25;
            return <circle key={i} className="mv-bulb" cx={x} cy={y + 4} r={4} fill={['#ffd76a', '#ff8a6a', '#8ad7ff', '#b8ff8a'][i % 4]} style={{ animationDelay: `${-i * 0.37}s` }} />;
          })}
        </g>
      );
    case 'openAir':
      return (
        <g>
          {[120, 1080].map((x) => (
            <g key={x}>
              <rect x={x - 4} y={60} width={8} height={160} fill="#2c313b" />
              <rect x={x - 34} y={40} width={68} height={26} fill="#3a404c" />
              {[0, 1, 2, 3].map((i) => (
                <circle key={i} cx={x - 24 + i * 16} cy={53} r={6} fill="#fff6d0" />
              ))}
              <polygon points={`${x - 34},66 ${x + 34},66 ${x + (x < 600 ? 520 : -200)},600 ${x + (x < 600 ? 200 : -520)},600`} fill="#fff6d0" opacity={0.06} />
            </g>
          ))}
        </g>
      );
    case 'gym':
    case 'hall':
      return (
        <g>
          {/* Fluorescent tubes, all of them on. */}
          {Array.from({ length: 6 }, (_, i) => (
            <g key={i}>
              <rect x={70 + i * 190} y={setting.family === 'hall' ? 52 : 14} width={120} height={9} rx={2} fill="#f4fbff" />
              <rect x={70 + i * 190} y={setting.family === 'hall' ? 52 : 14} width={120} height={9} rx={2} fill="#f4fbff" opacity={0.35} transform={`translate(0 6) scale(1 2)`} style={{ transformOrigin: `${130 + i * 190}px ${setting.family === 'hall' ? 56 : 18}px` }} />
            </g>
          ))}
        </g>
      );
    default:
      // A big dark room with nothing hung in it but the house lights, half on.
      return (
        <g opacity={0.6}>
          {[250, 600, 950].map((x) => (
            <g key={x}>
              <circle cx={x} cy={22} r={6} fill="#f0ead2" />
              <polygon points={`${x - 6},22 ${x + 6},22 ${x + 120},600 ${x - 120},600`} fill="#f0ead2" opacity={0.05} />
            </g>
          ))}
        </g>
      );
  }
}

/** Where a big screen would hang, when there is none: a scoreboard, a banner, a sheet on the fence. */
export function NoScreen({ setting, name, accent }: { setting: Setting; name: string; accent: string }) {
  const short = name.length > 22 ? name.split(/\s+/).map((w) => w[0]).join('') : name;
  if (setting.family === 'gym') {
    return (
      <g>
        <rect x={470} y={34} width={260} height={92} rx={4} fill="#111" stroke="#444" strokeWidth={3} />
        <text x={520} y={60} textAnchor="middle" fontSize={13} fontWeight={800} fill="#ddd">HOME</text>
        <text x={680} y={60} textAnchor="middle" fontSize={13} fontWeight={800} fill="#ddd">GUEST</text>
        <text x={520} y={100} textAnchor="middle" fontSize={34} fontWeight={800} fill="#ff3b2a" style={{ fontFamily: 'monospace' }}>00</text>
        <text x={680} y={100} textAnchor="middle" fontSize={34} fontWeight={800} fill="#ff3b2a" style={{ fontFamily: 'monospace' }}>00</text>
        <text x={600} y={88} textAnchor="middle" fontSize={20} fontWeight={800} fill="#ffb02a" style={{ fontFamily: 'monospace' }}>4</text>
        {/* And the company's banner, taped up under it. */}
        <rect x={470} y={136} width={260} height={30} fill="#f3efe4" />
        <text x={600} y={157} textAnchor="middle" fontSize={15} fontWeight={900} fill={accent} style={{ textTransform: 'uppercase' }}>{short}</text>
      </g>
    );
  }
  if (setting.family === 'backyard') {
    // A bedsheet on the fence, in marker pen.
    return (
      <g>
        <path d="M 470,214 L 730,210 L 728,258 L 472,262 Z" fill="#ece7dc" />
        <text x={600} y={244} textAnchor="middle" fontSize={20} fontWeight={700} fill="#1d2a6e" style={{ fontFamily: 'Comic Sans MS, cursive', textTransform: 'uppercase' }} transform="rotate(-1 600 240)">{short}</text>
      </g>
    );
  }
  // A vinyl banner hung where a screen would go.
  return (
    <g>
      <rect x={440} y={40} width={320} height={64} fill="#0d0e12" stroke={accent} strokeOpacity={0.5} strokeWidth={2} />
      <text x={600} y={82} textAnchor="middle" fontSize={24} fontWeight={900} letterSpacing={2} fill={accent} style={{ textTransform: 'uppercase' }}>{short}</text>
    </g>
  );
}

/** Where they come out: a real stage and ramp, or a curtain over a doorway. */
export function Entrance({ setting, accent }: { setting: Setting; accent: string }) {
  if (setting.family === 'backyard' || (setting.family === 'openAir' && !setting.stage)) return null;
  if (setting.stage) {
    return (
      <g>
        {/* Truss round the screen, a deck under it, lit from the front. */}
        <path d="M 410,20 L 410,182 M 790,20 L 790,182 M 410,20 L 790,20" stroke="#4a505c" strokeWidth={8} fill="none" />
        <path d="M 404,26 L 416,38 M 404,50 L 416,62 M 404,74 L 416,86 M 404,98 L 416,110 M 404,122 L 416,134 M 404,146 L 416,158 M 784,26 L 796,38 M 784,50 L 796,62 M 784,74 L 796,86 M 784,98 L 796,110 M 784,122 L 796,134 M 784,146 L 796,158" stroke="#5f6674" strokeWidth={2} />
        <rect x={380} y={182} width={440} height={22} fill="#1b1e26" />
        <rect x={380} y={182} width={440} height={4} fill={accent} opacity={0.8} />
        <rect x={560} y={154} width={80} height={28} fill="#06070a" />
      </g>
    );
  }
  // No stage: the curtain they come through.
  return (
    <g>
      <rect x={566} y={setting.family === 'gym' || setting.family === 'hall' ? 176 : 158} width={68} height={46} fill="#0a0a0c" />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1={570 + i * 11} y1={setting.family === 'gym' || setting.family === 'hall' ? 176 : 158} x2={570 + i * 11} y2={222} stroke="#1c1c22" strokeWidth={3} />
      ))}
    </g>
  );
}

/** The touring sound: a stack each side of the entrance. */
export function SoundStacks({ setting }: { setting: Setting }) {
  if (!setting.sound) return null;
  const top = setting.stage ? 60 : 96;
  return (
    <g>
      {[350, 850].map((x) => (
        <g key={x}>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={x - 22} y={top + i * 40} width={44} height={38} rx={2} fill="#0d0e11" stroke="#2a2d34" strokeWidth={2} />
              <circle cx={x} cy={top + i * 40 + 19} r={12} fill="#1c1e24" stroke="#3a3e48" strokeWidth={2} />
              <circle cx={x} cy={top + i * 40 + 19} r={4} fill="#2c2f37" />
            </g>
          ))}
        </g>
      ))}
    </g>
  );
}

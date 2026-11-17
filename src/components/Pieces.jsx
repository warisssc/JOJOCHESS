import { defaultPieces } from 'react-chessboard'

const SIDE = {
  w: { fill: '#f1f5f9', shade: '#cbd5e1', stroke: '#0f172a' },
  b: { fill: '#334155', shade: '#1e293b', stroke: '#020617' },
}

/** Stylised tank with a glowing amber core. */
function Tank({ color, svgStyle }) {
  const s = SIDE[color]
  return (
    <svg viewBox="0 0 45 45" style={{ width: '100%', height: '100%', ...svgStyle }}>
      <defs>
        <filter id={`tg-${color}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.6" floodColor="#f59e0b" floodOpacity="0.95" />
        </filter>
      </defs>
      <g filter={`url(#tg-${color})`} stroke={s.stroke} strokeWidth="1.3" strokeLinejoin="round">
        {/* tracks */}
        <rect x="5" y="28" width="35" height="10" rx="5" fill={s.shade} />
        {[11, 19, 26, 34].map((cx) => <circle key={cx} cx={cx} cy="33" r="2.4" fill="#f59e0b" stroke={s.stroke} strokeWidth="0.8" />)}
        {/* hull */}
        <path d="M9 28 L11 21 H34 L36 28 Z" fill={s.fill} />
        {/* turret */}
        <rect x="15" y="12.5" width="15" height="8.5" rx="3" fill={s.fill} />
        <rect x="27" y="15" width="14" height="3.2" rx="1" fill={s.shade} />
        <rect x="39" y="14.2" width="3" height="4.8" rx="1" fill="#f59e0b" />
        <circle cx="22.5" cy="16.7" r="1.9" fill="#f59e0b" />
      </g>
    </svg>
  )
}

/** Stylised ballistic missile with a cyan warhead. */
function Missile({ color, svgStyle }) {
  const s = SIDE[color]
  return (
    <svg viewBox="0 0 45 45" style={{ width: '100%', height: '100%', ...svgStyle }}>
      <defs>
        <filter id={`mg-${color}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.6" floodColor="#22d3ee" floodOpacity="0.95" />
        </filter>
      </defs>
      <g filter={`url(#mg-${color})`} stroke={s.stroke} strokeWidth="1.3" strokeLinejoin="round">
        {/* flame */}
        <path d="M19.5 35 Q22.5 44 25.5 35 Z" fill="#f97316" stroke="none" />
        {/* fins */}
        <path d="M18 25 L11 35 H19 Z" fill="#22d3ee" />
        <path d="M27 25 L34 35 H26 Z" fill="#22d3ee" />
        {/* body */}
        <path d="M22.5 3 C28 9 28.5 16 27.5 35 H17.5 C16.5 16 17 9 22.5 3 Z" fill={s.fill} />
        {/* nose + window + stripe */}
        <path d="M22.5 3 C25 5.5 26.4 8 26.9 10.5 H18.1 C18.6 8 20 5.5 22.5 3 Z" fill="#ef4444" />
        <circle cx="22.5" cy="18" r="2.8" fill="#22d3ee" />
        <rect x="17.8" y="26" width="9.4" height="2.6" fill="#ef4444" stroke="none" />
      </g>
    </svg>
  )
}

export const customPieces = {
  ...defaultPieces,
  wT: (p) => <Tank color="w" svgStyle={p?.svgStyle} />,
  bT: (p) => <Tank color="b" svgStyle={p?.svgStyle} />,
  wM: (p) => <Missile color="w" svgStyle={p?.svgStyle} />,
  bM: (p) => <Missile color="b" svgStyle={p?.svgStyle} />,
}

/** Small piece icon (for captured lists / promotion picker). `t` is a rules piece type. */
export function PieceIcon({ piece, size = 24 }) {
  const key = piece.c + piece.t.toUpperCase()
  const render = customPieces[key]
  return <span style={{ width: size, height: size, display: 'inline-block' }}>{render?.()}</span>
}

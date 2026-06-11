import React from 'react';
import { C } from '../theme.js';

// 依存ライブラリなしのシンプルなSVG折れ線グラフ
// (miesan-admin-demo.jsx入手後、デモのチャート実装に合わせて差し替え可)
export default function WpmChart({ speeches, goalWpm }) {
  const W = 640;
  const H = 200;
  const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

  const wpms = speeches.map((s) => s.wpm);
  const max = Math.max(...wpms, goalWpm) + 10;
  const min = Math.max(0, Math.min(...wpms, goalWpm) - 10);

  const x = (i) =>
    PAD.left + (speeches.length === 1
      ? (W - PAD.left - PAD.right) / 2
      : ((W - PAD.left - PAD.right) * i) / (speeches.length - 1));
  const y = (v) => PAD.top + ((H - PAD.top - PAD.bottom) * (max - v)) / (max - min);

  const path = speeches
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s.wpm).toFixed(1)}`)
    .join(' ');

  const ticks = [min, Math.round((min + max) / 2), max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth="1" />
          <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={C.sub}>
            {t}
          </text>
        </g>
      ))}

      {/* 目標WPMライン */}
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={y(goalWpm)}
        y2={y(goalWpm)}
        stroke={C.green}
        strokeWidth="1.5"
        strokeDasharray="6 4"
      />
      <text x={W - PAD.right} y={y(goalWpm) - 6} textAnchor="end" fontSize="11" fill={C.green}>
        目標 {goalWpm}
      </text>

      <path d={path} fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinejoin="round" />

      {speeches.map((s, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(s.wpm)} r="3.5" fill={C.brand} />
          {(i === 0 || i === speeches.length - 1) && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={C.sub}>
              {s.date.substring(5)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

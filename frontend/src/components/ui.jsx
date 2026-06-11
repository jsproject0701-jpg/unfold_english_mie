import React from 'react';
import { Mic, BookOpen, Image as ImageIcon, PenLine } from 'lucide-react';
import { C, FONT } from '../theme.js';

export const TYPE_META = {
  "1分スピーチ": { icon: Mic, tint: C.sageBadge },
  "シャドーイング": { icon: BookOpen, tint: "#E3E9F2" },
  "速読": { icon: ImageIcon, tint: C.amberLight },
  "ライティング": { icon: PenLine, tint: "#F0E4EE" },
};

export function Card({ children, style }) {
  return (
    <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14, ...style }}>
      {children}
    </div>
  );
}

export function TypeBadge({ type }) {
  const meta = TYPE_META[type] || TYPE_META["1分スピーチ"];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
      style={{ background: meta.tint, color: C.ink, fontFamily: FONT.body }}>
      <Icon size={12} /> {type}
    </span>
  );
}

// クリーム背景にシンプルなスピナー(設計書4-2)
export function Spinner({ label = '読み込み中…' }) {
  return (
    <div className="flex flex-col items-center gap-3" style={{ padding: '64px 0' }}>
      <div
        style={{
          width: 32,
          height: 32,
          border: `3px solid ${C.line}`,
          borderTopColor: C.teal,
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
        }}
      />
      <div style={{ fontFamily: FONT.body, color: C.sub, fontSize: 13 }}>{label}</div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <Card style={{ padding: 32, textAlign: 'center' }}>
      <p style={{ fontFamily: FONT.display, fontSize: 18, color: C.red, margin: 0 }}>読み込みに失敗しました</p>
      <p style={{ fontFamily: FONT.body, fontSize: 13, color: C.sub, marginTop: 8 }}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-xl px-4 py-2" style={{
          marginTop: 16, background: C.teal, color: C.cream,
          fontFamily: FONT.body, fontSize: 14, fontWeight: 600,
        }}>
          再読み込み
        </button>
      )}
    </Card>
  );
}

export function EmptyText({ children }) {
  return <p style={{ fontFamily: FONT.body, fontSize: 13, color: C.sub, margin: 0 }}>{children}</p>;
}

// '2026-06' / '2026/06' → '6月'
export function monthLabel(month) {
  const m = Number((month || '').replace('/', '-').split('-')[1]);
  return m ? `${m}月` : month;
}

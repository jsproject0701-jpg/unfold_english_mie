import React from 'react';
import { C } from '../theme.js';

// クリーム背景にシンプルなスピナー(設計書4-2)
export function Spinner({ label = '読み込み中…' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '64px 0' }}>
      <div
        style={{
          width: 32,
          height: 32,
          border: `3px solid ${C.line}`,
          borderTopColor: C.accent,
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
        }}
      />
      <div style={{ color: C.sub, fontSize: 13 }}>{label}</div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

export function EmptyState({ icon = '🌿', title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 16px', color: C.sub }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontWeight: 700, color: C.ink, marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 13 }}>{sub}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 16px' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>読み込みに失敗しました</div>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>{message}</div>
      {onRetry && (
        <button onClick={onRetry} style={buttonStyle()}>再読み込み</button>
      )}
    </div>
  );
}

export function Card({ children, style }) {
  return (
    <div
      style={{
        background: C.paper,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Badge({ children, tone = 'accent' }) {
  const tones = {
    accent: { background: C.accentSoft, color: C.brand },
    green: { background: C.greenSoft, color: C.green },
  };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        ...tones[tone],
      }}
    >
      {children}
    </span>
  );
}

export function buttonStyle(variant = 'primary') {
  const base = {
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 700,
    borderRadius: 10,
    padding: '10px 18px',
    cursor: 'pointer',
    border: `1px solid ${C.line}`,
    background: C.paper,
    color: C.ink,
  };
  if (variant === 'primary') {
    return { ...base, background: C.brand, borderColor: C.brand, color: '#fff' };
  }
  return base;
}

import React, { useState } from 'react';
import { C } from '../theme.js';
import { approveFeedback } from '../api.js';
import { Card, Badge, EmptyState, buttonStyle } from './ui.jsx';

// FB承認キュー: 候補3つから選択 → 編集 → 「送信済みにする」
// 楽観的UI更新: 即座にキューから消し、失敗したら戻す(設計書4-3)
export default function QueuePage({ queue, setQueue }) {
  if (!queue.length) {
    return (
      <EmptyState
        icon="🎉"
        title="承認待ちのFBはありません"
        sub="生徒の提出があるとここに表示されます"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {queue.map((item) => (
        <QueueCard key={item.uuid} item={item} setQueue={setQueue} />
      ))}
    </div>
  );
}

function QueueCard({ item, setQueue }) {
  const [selected, setSelected] = useState(0);
  const [text, setText] = useState(item.fbs[0] || '');
  const [showTranscript, setShowTranscript] = useState(false);
  const [sending, setSending] = useState(false);

  const pickCandidate = (i) => {
    setSelected(i);
    setText(item.fbs[i] || '');
  };

  const handleApprove = async () => {
    setSending(true);
    // 楽観的更新: 先にキューから消す
    setQueue((q) => q.filter((x) => x.uuid !== item.uuid));
    try {
      await approveFeedback(item.uuid, text);
    } catch (err) {
      // 失敗したら戻す
      setQueue((q) => [item, ...q]);
      alert('送信済みへの更新に失敗しました: ' + err.message);
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Badge>{item.type}</Badge>
        <span style={{ fontWeight: 700 }}>{item.student}</span>
        <span style={{ fontSize: 12, color: C.sub }}>{item.datetime}</span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: C.sub, marginBottom: 12 }}>
        {item.score1 && <span>{item.score1}</span>}
        {item.score2 && <span>{item.score2}</span>}
      </div>

      {item.transcript && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setShowTranscript((v) => !v)}
            style={{ ...buttonStyle('ghost'), padding: '4px 10px', fontSize: 12 }}
          >
            {showTranscript ? '文字起こしを隠す' : '文字起こしを見る'}
          </button>
          {showTranscript && (
            <div
              style={{
                marginTop: 8,
                padding: 12,
                background: C.cream,
                borderRadius: 10,
                fontSize: 13,
                whiteSpace: 'pre-wrap',
              }}
            >
              {item.transcript}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {item.fbs.map((fb, i) =>
          fb ? (
            <button
              key={i}
              onClick={() => pickCandidate(i)}
              style={{
                ...buttonStyle('ghost'),
                padding: '6px 12px',
                fontSize: 12,
                background: selected === i ? C.accentSoft : C.paper,
                borderColor: selected === i ? C.accent : C.line,
              }}
            >
              候補{['①', '②', '③'][i]}
            </button>
          ) : null
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          fontSize: 14,
          lineHeight: 1.7,
          padding: 12,
          border: `1px solid ${C.line}`,
          borderRadius: 10,
          background: C.cream,
          color: C.ink,
          resize: 'vertical',
        }}
      />

      {item.note && (
        <div style={{ fontSize: 12, color: C.sub, marginTop: 8, whiteSpace: 'pre-wrap' }}>
          備考: {item.note}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button
          onClick={() => navigator.clipboard?.writeText(text)}
          style={buttonStyle('ghost')}
        >
          コピー
        </button>
        <button onClick={handleApprove} disabled={sending} style={buttonStyle('primary')}>
          送信済みにする
        </button>
      </div>
    </Card>
  );
}

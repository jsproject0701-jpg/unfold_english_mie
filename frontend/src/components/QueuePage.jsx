import React, { useState } from 'react';
import { Copy, Check, Pencil, ChevronRight } from 'lucide-react';
import { C, FONT } from '../theme.js';
import { approveFeedback } from '../api.js';
import { Card, TypeBadge } from './ui.jsx';

// ---------------- ① FB承認キュー ----------------
// レイアウト・コピーは docs/miesan-admin-demo.jsx の FbQueue / QueueCard が正。
// 「送信済みにする」は action=approve をPOST、楽観的UI更新(設計書4-3)
export default function QueuePage({ pending, setPending, approved, setApproved }) {
  const [openId, setOpenId] = useState(pending[0]?.uuid ?? null);

  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <p style={{ fontFamily: FONT.body, fontSize: 12, letterSpacing: "0.12em", color: C.sub }}>TODAY'S QUEUE</p>
          <h2 style={{ fontFamily: FONT.display, fontSize: 26, color: C.ink, margin: 0 }}>
            FB待ち <span style={{ color: C.teal }}>{pending.length}</span> 件
          </h2>
        </div>
        <p style={{ fontFamily: FONT.body, fontSize: 12, color: C.sub }}>
          承認済み {approved.length} 件
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {pending.map((item) => (
          <QueueCard key={item.uuid} item={item}
            open={openId === item.uuid}
            onToggle={() => setOpenId(openId === item.uuid ? null : item.uuid)}
            onApprove={async (finalText) => {
              // 楽観的更新: 先にキューから消し、失敗したら戻す
              setPending(pending.filter((p) => p.uuid !== item.uuid));
              setApproved([{ ...item, finalText }, ...approved]);
              try {
                await approveFeedback(item.uuid, finalText);
              } catch (err) {
                setPending((q) => [item, ...q]);
                setApproved((a) => a.filter((x) => x.uuid !== item.uuid));
                alert('送信済みへの更新に失敗しました: ' + err.message);
              }
            }}
          />
        ))}
        {pending.length === 0 && (
          <Card style={{ padding: 32, textAlign: "center" }}>
            <p style={{ fontFamily: FONT.display, fontSize: 18, color: C.teal, margin: 0 }}>今日のFBはすべて完了です 🍵</p>
            <p style={{ fontFamily: FONT.body, fontSize: 13, color: C.sub, marginTop: 8 }}>新しい提出が届くとここに並びます。</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function QueueCard({ item, open, onToggle, onApprove }) {
  const fbs = item.fbs.filter(Boolean);
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState(fbs[0] || '');
  const [copied, setCopied] = useState(false);

  // スコア1/スコア2は文字列のまま表示する(設計書2.3)
  const stats = [item.score1, item.score2].filter(Boolean).join(' ・ ');

  const pick = (i) => { setSelected(i); setDraft(fbs[i]); };

  const copy = async () => {
    try { await navigator.clipboard.writeText(draft); } catch (e) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: C.teal, color: C.cream, fontFamily: FONT.display }}>
            {item.student[0]}
          </div>
          <div>
            <p style={{ fontFamily: FONT.body, fontWeight: 600, color: C.ink, margin: 0, fontSize: 14 }}>
              {item.student}さん <span style={{ fontWeight: 400, color: C.sub, fontSize: 12 }}>・{item.datetime}</span>
            </p>
            <p style={{ fontFamily: FONT.body, fontSize: 12, color: C.sub, margin: "2px 0 0" }}>{stats}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TypeBadge type={item.type} />
          <ChevronRight size={16} style={{ color: C.sub, transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {(item.transcript || item.note) && (
            <div style={{ background: C.cream, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
              <p style={{ fontFamily: FONT.body, fontSize: 11, color: C.sub, margin: "0 0 4px", letterSpacing: "0.08em" }}>AI解析メモ（生徒には非公開）</p>
              {item.transcript && (
                <p style={{ fontFamily: FONT.body, fontSize: 13, color: C.ink, margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{item.transcript}</p>
              )}
              {item.note && (
                <p style={{ fontFamily: FONT.body, fontSize: 12, color: C.sub, margin: item.transcript ? "8px 0 0" : 0, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{item.note}</p>
              )}
            </div>
          )}

          <p style={{ fontFamily: FONT.body, fontSize: 11, color: C.sub, margin: "0 0 6px", letterSpacing: "0.08em" }}>FB候補（タップで選択）</p>
          <div className="flex flex-col gap-2 mb-3">
            {fbs.map((fb, i) => (
              <button key={i} onClick={() => pick(i)} className="text-left rounded-xl p-3"
                style={{
                  fontFamily: FONT.body, fontSize: 13, lineHeight: 1.7, color: C.ink,
                  background: selected === i ? C.sageLight : "#FFFFFF",
                  border: `1.5px solid ${selected === i ? C.sage : C.line}`,
                }}>
                <span style={{ fontFamily: FONT.display, color: C.teal, marginRight: 6 }}>候補{i + 1}</span>
                {fb}
              </button>
            ))}
          </div>

          <p style={{ fontFamily: FONT.body, fontSize: 11, color: C.sub, margin: "0 0 6px", letterSpacing: "0.08em" }}>
            <Pencil size={11} style={{ display: "inline", marginRight: 4 }} />送信前に編集できます
          </p>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4}
            className="w-full rounded-xl p-3 mb-3"
            style={{ fontFamily: FONT.body, fontSize: 13, lineHeight: 1.7, border: `1.5px solid ${C.line}`, background: "#FFF", color: C.ink, resize: "vertical" }} />

          <div className="flex gap-2">
            <button onClick={copy} className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3"
              style={{ background: C.teal, color: C.cream, fontFamily: FONT.body, fontSize: 14, fontWeight: 600 }}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "コピーしました" : "コピーしてLINEへ"}
            </button>
            <button onClick={() => onApprove(draft)} className="rounded-xl px-4 py-3"
              style={{ background: C.sageLight, color: C.teal, fontFamily: FONT.body, fontSize: 14, fontWeight: 600, border: `1px solid ${C.sage}` }}>
              送信済みにする
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

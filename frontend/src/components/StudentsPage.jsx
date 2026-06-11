import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { C, FONT } from '../theme.js';
import { Card, TypeBadge, Spinner, ErrorState, EmptyText, monthLabel } from './ui.jsx';
import { StudentPills, useStudentDetail } from './StudentPills.jsx';

// ---------------- ② 生徒ダッシュボード ----------------
// レイアウト・コピーは docs/miesan-admin-demo.jsx の StudentView / Stat が正。
// history=1分スピーチタブの月次集計、提出履歴=同タブの提出実データ
export default function StudentsPage({ students }) {
  const [sid, setSid] = useState(students[0]?.id);
  const s = students.find((x) => x.id === sid);
  const { data, error, retry } = useStudentDetail(sid);

  if (!s) {
    return (
      <Card style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ fontFamily: FONT.display, fontSize: 18, color: C.teal, margin: 0 }}>生徒が登録されていません</p>
        <p style={{ fontFamily: FONT.body, fontSize: 13, color: C.sub, marginTop: 8 }}>管理シートの「生徒管理」タブに行を追加してください。</p>
      </Card>
    );
  }

  const history = (data?.monthly || []).map((m) => ({ d: monthLabel(m.month), wpm: m.avgWpm }));
  const latest = history[history.length - 1];
  const first = history[0];

  return (
    <div>
      <StudentPills students={students} sid={sid} setSid={setSid} />

      {error && <ErrorState message={error} onRetry={retry} />}
      {!error && !data && <Spinner label={`${s.name}さんのデータを読み込み中…`} />}

      {data && (
        <>
          <Card style={{ padding: 20, marginBottom: 14 }}>
            <div className="flex items-baseline justify-between mb-1">
              <h2 style={{ fontFamily: FONT.display, fontSize: 22, color: C.ink, margin: 0 }}>{s.name}さん</h2>
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.sub }}>{s.course}コース ・ {monthsSince(s.startMonth)}ヶ月目</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <Stat label="現在WPM" value={latest ? latest.wpm : '–'} sub={`目標 ${s.goalWpm}`} />
              <Stat label="開始時から" value={latest && first ? `+${latest.wpm - first.wpm}` : '–'} sub="WPM" accent />
              {/* 流暢さ/フィラーは生徒シートに未記録のためプレースホルダ表示 */}
              <Stat label="流暢さ" value="–/10" sub="フィラー –回" />
            </div>
          </Card>

          <Card style={{ padding: 20, marginBottom: 14 }}>
            <p style={{ fontFamily: FONT.body, fontSize: 12, letterSpacing: "0.1em", color: C.sub, margin: "0 0 10px" }}>WPM推移</p>
            {history.length ? (
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={history} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="d" tick={{ fontFamily: FONT.body, fontSize: 12, fill: C.sub }} axisLine={false} tickLine={false} />
                    <YAxis domain={[40, Math.max(s.goalWpm + 10, latest.wpm + 10)]} tick={{ fontFamily: FONT.body, fontSize: 12, fill: C.sub }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontFamily: FONT.body, fontSize: 12, borderRadius: 10, border: `1px solid ${C.line}` }} />
                    <ReferenceLine y={s.goalWpm} stroke={C.amber} strokeDasharray="4 4"
                      label={{ value: `目標 ${s.goalWpm}`, position: "insideTopRight", fontFamily: FONT.body, fontSize: 11, fill: C.amber }} />
                    <Line type="monotone" dataKey="wpm" stroke={C.teal} strokeWidth={2.5}
                      dot={{ r: 4, fill: C.teal }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyText>まだ提出がありません。</EmptyText>
            )}
          </Card>

          <Card style={{ padding: 20 }}>
            <p style={{ fontFamily: FONT.body, fontSize: 12, letterSpacing: "0.1em", color: C.sub, margin: "0 0 10px" }}>提出履歴</p>
            {data.speeches.length ? (
              <div className="flex flex-col">
                {[...data.speeches].reverse().slice(0, 10).map((sub, i) => (
                  <div key={i} className="flex items-center justify-between py-3"
                    style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                    <div className="flex items-center gap-3">
                      <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.sub, width: 36 }}>{shortDate(sub.date)}</span>
                      <TypeBadge type="1分スピーチ" />
                    </div>
                    <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.sub }}>WPM {sub.wpm}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyText>まだ提出がありません。</EmptyText>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  return (
    <div style={{ background: accent ? C.sageLight : C.cream, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
      <p style={{ fontFamily: FONT.body, fontSize: 11, color: C.sub, margin: 0 }}>{label}</p>
      <p style={{ fontFamily: FONT.display, fontSize: 24, color: accent ? C.teal : C.ink, margin: "2px 0 0", lineHeight: 1.2 }}>{value}</p>
      <p style={{ fontFamily: FONT.body, fontSize: 11, color: C.sub, margin: 0 }}>{sub}</p>
    </div>
  );
}

// 開始月('2026-04')から数えて何ヶ月目か
function monthsSince(startMonth) {
  const m = /^(\d{4})[-/](\d{1,2})/.exec(startMonth || '');
  if (!m) return 1;
  const now = new Date();
  const diff = (now.getFullYear() - Number(m[1])) * 12 + (now.getMonth() + 1 - Number(m[2])) + 1;
  return Math.max(diff, 1);
}

// '2026/06/12' → '6/12'
function shortDate(date) {
  const parts = (date || '').split(/[-/]/);
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : date;
}

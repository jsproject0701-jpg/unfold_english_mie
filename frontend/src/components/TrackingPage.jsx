import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { Bell } from 'lucide-react';
import { C, FONT } from '../theme.js';
import { Card, Spinner, ErrorState, EmptyText, monthLabel } from './ui.jsx';
import { StudentPills, useStudentDetail } from './StudentPills.jsx';

// ---------------- ③ トラッキング ----------------
// レイアウト・コピーは docs/miesan-admin-demo.jsx の TrackingView が正。
// 勉強時間=管理シート「勉強時間ログ」、教材=生徒シート「トラッキング」タブの実データ
export default function TrackingPage({ students }) {
  const [sid, setSid] = useState(students[0]?.id);
  const [mode, setMode] = useState("monthly"); // monthly | cumulative
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

  const study = data ? aggregateStudy(data.study, s.monthlyTargetH) : [];
  const materials = data?.materials || [];

  // 達成率データ：①累積 ②月次リセット
  const chartData = study.map((row, i) => {
    if (mode === "monthly") {
      return { m: row.m, 達成率: Math.round((row.actual / row.target) * 100) };
    }
    const cumA = study.slice(0, i + 1).reduce((a, r) => a + r.actual, 0);
    const cumT = study.slice(0, i + 1).reduce((a, r) => a + r.target, 0);
    return { m: row.m, 達成率: Math.round((cumA / cumT) * 100) };
  });

  const latestRate = chartData.length ? chartData[chartData.length - 1]["達成率"] : null;
  const behind = latestRate !== null && latestRate < 100;

  return (
    <div>
      <StudentPills students={students} sid={sid} setSid={setSid} />

      {error && <ErrorState message={error} onRetry={retry} />}
      {!error && !data && <Spinner label={`${s.name}さんのデータを読み込み中…`} />}

      {data && (
        <>
          {behind && (
            <Card style={{ padding: 14, marginBottom: 14, background: C.amberLight, border: `1px solid ${C.amber}` }}>
              <div className="flex items-start gap-3">
                <Bell size={18} style={{ color: C.amber, marginTop: 2 }} />
                <div>
                  <p style={{ fontFamily: FONT.body, fontSize: 13, fontWeight: 600, color: C.ink, margin: 0 }}>
                    ビハインド検知：達成率 {latestRate}%
                  </p>
                  <p style={{ fontFamily: FONT.body, fontSize: 12, color: C.sub, margin: "4px 0 0", lineHeight: 1.6 }}>
                    本番では公式LINEから{s.name}さんへ自動リマインドを送信します（06トラッキング機能）。
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card style={{ padding: 20, marginBottom: 14 }}>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontFamily: FONT.body, fontSize: 12, letterSpacing: "0.1em", color: C.sub, margin: 0 }}>勉強時間 達成率</p>
              <div className="flex rounded-full overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                {[["monthly", "月次リセット"], ["cumulative", "累積"]].map(([key, label]) => (
                  <button key={key} onClick={() => setMode(key)}
                    className="px-3 py-1.5"
                    style={{
                      fontFamily: FONT.body, fontSize: 12, fontWeight: 600,
                      background: mode === key ? C.teal : "#FFF",
                      color: mode === key ? C.cream : C.sub,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length ? (
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="m" tick={{ fontFamily: FONT.body, fontSize: 12, fill: C.sub }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 120]} tick={{ fontFamily: FONT.body, fontSize: 12, fill: C.sub }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontFamily: FONT.body, fontSize: 12, borderRadius: 10, border: `1px solid ${C.line}` }} formatter={(v) => `${v}%`} />
                    <ReferenceLine y={100} stroke={C.sage} strokeWidth={1.5} />
                    <Bar dataKey="達成率" radius={[6, 6, 0, 0]}>
                      {chartData.map((row, i) => (
                        <Cell key={i} fill={row["達成率"] >= 100 ? C.teal : C.amber} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyText>勉強時間の記録がありません。</EmptyText>
            )}
            <p style={{ fontFamily: FONT.body, fontSize: 11, color: C.sub, margin: "8px 0 0", lineHeight: 1.6 }}>
              {mode === "monthly"
                ? "② 月ごとにリセット：前月のビハインドは持ち越しません。"
                : "① 累積：開始からの合計で計算。前月のビハインドが残ります。"}
            </p>
          </Card>

          <Card style={{ padding: 20 }}>
            <p style={{ fontFamily: FONT.body, fontSize: 12, letterSpacing: "0.1em", color: C.sub, margin: "0 0 12px" }}>教材の進み具合</p>
            {materials.length ? (
              <div className="flex flex-col gap-4">
                {materials.map((m, i) => {
                  const pct = m.total > 0 ? Math.min(100, Math.round((m.done / m.total) * 100)) : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between mb-1">
                        <span style={{ fontFamily: FONT.body, fontSize: 13, color: C.ink }}>{m.name}</span>
                        <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.sub }}>{m.done}/{m.total} 範囲 ・ {pct}%</span>
                      </div>
                      <div style={{ height: 8, background: C.cream, borderRadius: 99 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: pct >= 60 ? C.teal : C.sage, borderRadius: 99, transition: "width .4s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyText>トラッキングデータがありません。</EmptyText>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// 勉強時間ログを月次集計: [{m:'6月', actual, target}]
// 当月の目標は日割り(月間目標 × 経過日数/月日数)
function aggregateStudy(entries, monthlyTargetH) {
  const byMonth = {};
  const order = [];
  for (const e of entries || []) {
    const key = (e.date || '').substring(0, 7).replace('/', '-');
    if (!key) continue;
    if (!(key in byMonth)) { byMonth[key] = 0; order.push(key); }
    byMonth[key] += e.hours;
  }
  order.sort();

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return order.map((key) => ({
    m: monthLabel(key),
    actual: Math.round(byMonth[key] * 10) / 10,
    target: key === currentKey
      ? Math.max(1, Math.round(monthlyTargetH * now.getDate() / daysInMonth))
      : monthlyTargetH,
  }));
}

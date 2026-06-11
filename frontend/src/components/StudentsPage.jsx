import React, { useEffect, useState } from 'react';
import { C } from '../theme.js';
import { fetchStudent } from '../api.js';
import { Card, Badge, Spinner, EmptyState, ErrorState, buttonStyle } from './ui.jsx';
import WpmChart from './WpmChart.jsx';

export default function StudentsPage({ students }) {
  const [selectedId, setSelectedId] = useState(null);

  if (!students.length) {
    return (
      <EmptyState
        icon="🧑‍🎓"
        title="生徒が登録されていません"
        sub="管理シートの「生徒管理」タブに行を追加してください"
      />
    );
  }

  if (selectedId) {
    const student = students.find((s) => s.id === selectedId);
    return (
      <StudentDetail
        student={student}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {students.map((s) => (
        <Card key={s.id || s.name} style={{ cursor: 'pointer' }}>
          <div
            onClick={() => s.id && setSelectedId(s.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: C.sub }}>
                {s.course} ・ 開始 {s.startMonth}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: C.sub }}>
              <div>目標WPM {s.goalWpm}</div>
              <div>月間目標 {s.monthlyTargetH}h</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function StudentDetail({ student, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [studyView, setStudyView] = useState('cumulative'); // 累積を正とする(設計書6.3)

  const load = () => {
    setError(null);
    setData(null);
    fetchStudent(student.id)
      .then(setData)
      .catch((err) => setError(err.message));
  };

  useEffect(load, [student.id]);

  return (
    <div>
      <button onClick={onBack} style={{ ...buttonStyle('ghost'), marginBottom: 16 }}>
        ← 生徒一覧へ
      </button>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{student.name}</h2>
        <Badge>{student.course}</Badge>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !data && <Spinner label={`${student.name}さんのデータを読み込み中…`} />}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <SectionTitle>🎤 1分スピーチ WPM推移</SectionTitle>
            {data.speeches.length ? (
              <WpmChart speeches={data.speeches} goalWpm={student.goalWpm} />
            ) : (
              <EmptyText>まだ提出がありません</EmptyText>
            )}
            {data.monthly.length > 0 && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 12, color: C.sub }}>
                {data.monthly.map((m) => (
                  <span key={m.month}>
                    {m.month}: 平均 <b style={{ color: C.ink }}>{m.avgWpm}</b> WPM({m.count}件)
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>📚 教材進捗</SectionTitle>
            {data.materials.length ? (
              data.materials.map((m) => <MaterialBar key={m.name} material={m} />)
            ) : (
              <EmptyText>トラッキングデータがありません</EmptyText>
            )}
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionTitle style={{ marginBottom: 0 }}>⏱ 勉強時間</SectionTitle>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  ['cumulative', '累積'],
                  ['monthly', '月次'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setStudyView(key)}
                    style={{
                      ...buttonStyle('ghost'),
                      padding: '4px 12px',
                      fontSize: 12,
                      background: studyView === key ? C.accentSoft : C.paper,
                      borderColor: studyView === key ? C.accent : C.line,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <StudyHours
              entries={data.study}
              view={studyView}
              monthlyTargetH={student.monthlyTargetH}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children, style }) {
  return <div style={{ fontWeight: 700, marginBottom: 12, ...style }}>{children}</div>;
}

function EmptyText({ children }) {
  return <div style={{ fontSize: 13, color: C.sub }}>{children}</div>;
}

function MaterialBar({ material }) {
  const pct = material.total > 0 ? Math.min(100, Math.round((material.done / material.total) * 100)) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span>{material.name}</span>
        <span style={{ color: C.sub }}>
          {material.done}/{material.total}({pct}%)
        </span>
      </div>
      <div style={{ height: 8, background: C.cream, borderRadius: 999 }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: C.green,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function StudyHours({ entries, view, monthlyTargetH }) {
  if (!entries.length) {
    return <EmptyText>勉強時間の記録がありません</EmptyText>;
  }

  const byMonth = {};
  for (const e of entries) {
    const month = (e.date || '').substring(0, 7).replace('/', '-');
    byMonth[month] = (byMonth[month] || 0) + e.hours;
  }
  const months = Object.keys(byMonth).sort();

  let cumulative = 0;
  const rows = months.map((m) => {
    cumulative += byMonth[m];
    return { month: m, hours: byMonth[m], cumulative };
  });

  return (
    <div style={{ marginTop: 12 }}>
      {rows.map((r) => {
        const value = view === 'cumulative' ? r.cumulative : r.hours;
        const target = view === 'cumulative'
          ? monthlyTargetH * (rows.indexOf(r) + 1)
          : monthlyTargetH;
        const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
        const behind = value < target;
        return (
          <div key={r.month} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span>{r.month}</span>
              <span style={{ color: behind ? C.red : C.green, fontWeight: 700 }}>
                {value.toFixed(1)}h / {target}h
              </span>
            </div>
            <div style={{ height: 8, background: C.cream, borderRadius: 999 }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: behind ? C.accent : C.green,
                  borderRadius: 999,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

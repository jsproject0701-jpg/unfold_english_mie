import React, { useEffect, useState } from 'react';
import { Inbox, Users, Target, Flame } from 'lucide-react';
import { C, FONT } from './theme.js';
import { fetchBootstrap } from './api.js';
import { Spinner, ErrorState } from './components/ui.jsx';
import QueuePage from './components/QueuePage.jsx';
import StudentsPage from './components/StudentsPage.jsx';
import TrackingPage from './components/TrackingPage.jsx';

// ---------------- ルート ----------------
// ヘッダー・タブのレイアウトは docs/miesan-admin-demo.jsx の App が正。
// モックデータの代わりに bootstrap で全画面分を一括取得(設計書3)
export default function App() {
  const [tab, setTab] = useState("queue");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [students, setStudents] = useState([]);
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchBootstrap()
      .then((data) => {
        setStudents(data.students || []);
        setPending(data.queue || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const tabs = [
    { key: "queue", label: "FB承認", icon: Inbox, badge: pending.length },
    { key: "students", label: "生徒", icon: Users, badge: null },
    { key: "tracking", label: "トラッキング", icon: Target, badge: null },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.cream, fontFamily: FONT.body }}>
      {/* ボタンリセット等は index.css(@layer base)、フォント読込は index.html 側 */}

      {/* ヘッダー */}
      <header style={{ background: C.teal, padding: "20px 16px 14px" }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end justify-between">
            <div>
              <h1 style={{ fontFamily: FONT.display, fontSize: 24, color: C.cream, margin: 0, letterSpacing: "0.02em" }}>
                unfold english
              </h1>
              <p style={{ fontFamily: FONT.body, fontSize: 12, color: C.sage, margin: "2px 0 0", letterSpacing: "0.14em" }}>
                管理コンソール
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: C.tealSoft }}>
              <Flame size={14} style={{ color: C.sage }} />
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.cream }}>生徒 {students.length}名</span>
            </div>
          </div>
        </div>
      </header>

      {/* タブ */}
      <nav style={{ background: C.teal, padding: "0 16px 0" }}>
        <div className="max-w-2xl mx-auto flex">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex items-center gap-2 px-4 py-3"
                style={{
                  fontFamily: FONT.body, fontSize: 13, fontWeight: 600,
                  color: active ? C.teal : C.cream,
                  background: active ? C.cream : "transparent",
                  borderRadius: "12px 12px 0 0",
                }}>
                <Icon size={15} />
                {t.label}
                {t.badge ? (
                  <span className="rounded-full px-1.5"
                    style={{ background: active ? C.teal : C.sage, color: active ? C.cream : C.tealDeep, fontSize: 11, minWidth: 18, textAlign: "center" }}>
                    {t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {/* 本体 */}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-16">
        {loading && <Spinner />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && (
          <>
            {tab === "queue" && (
              <QueuePage pending={pending} setPending={setPending} approved={approved} setApproved={setApproved} />
            )}
            {tab === "students" && <StudentsPage students={students} />}
            {tab === "tracking" && <TrackingPage students={students} />}
          </>
        )}
      </main>
    </div>
  );
}

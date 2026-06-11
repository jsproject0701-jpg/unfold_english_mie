import React, { useEffect, useState } from 'react';
import { C } from './theme.js';
import { fetchBootstrap } from './api.js';
import { Spinner, ErrorState, buttonStyle } from './components/ui.jsx';
import QueuePage from './components/QueuePage.jsx';
import StudentsPage from './components/StudentsPage.jsx';

export default function App() {
  const [tab, setTab] = useState('queue');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [students, setStudents] = useState([]);
  const [queue, setQueue] = useState([]);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchBootstrap()
      .then((data) => {
        setStudents(data.students || []);
        setQueue(data.queue || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 64px' }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: C.sub, textTransform: 'lowercase' }}>
          unfold english
        </div>
        <h1 style={{ margin: '2px 0 16px', fontSize: 22 }}>管理コンソール</h1>

        <nav style={{ display: 'flex', gap: 8 }}>
          {[
            ['queue', `FB承認${queue.length ? ` (${queue.length})` : ''}`],
            ['students', '生徒'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                ...buttonStyle('ghost'),
                background: tab === key ? C.brand : C.paper,
                borderColor: tab === key ? C.brand : C.line,
                color: tab === key ? '#fff' : C.ink,
              }}
            >
              {label}
            </button>
          ))}
          <button onClick={load} style={{ ...buttonStyle('ghost'), marginLeft: 'auto' }} title="再読み込み">
            ↻
          </button>
        </nav>
      </header>

      {loading && <Spinner />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && (
        tab === 'queue'
          ? <QueuePage queue={queue} setQueue={setQueue} />
          : <StudentsPage students={students} />
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { C, FONT } from '../theme.js';
import { fetchStudent } from '../api.js';

// 生徒切替ピル(デモのStudentView / TrackingView共通パターン)
export function StudentPills({ students, sid, setSid }) {
  return (
    <div className="flex gap-2 mb-4 overflow-x-auto">
      {students.map((st) => (
        <button key={st.id} onClick={() => setSid(st.id)}
          className="px-4 py-2 rounded-full whitespace-nowrap"
          style={{
            fontFamily: FONT.body, fontSize: 13, fontWeight: 600,
            background: sid === st.id ? C.teal : "#FFF",
            color: sid === st.id ? C.cream : C.ink,
            border: `1px solid ${sid === st.id ? C.teal : C.line}`,
          }}>
          {st.name}
        </button>
      ))}
    </div>
  );
}

// 生徒詳細の遅延取得(設計書3: bootstrapに含めず、タブを開いた時にaction=studentで取得)
export function useStudentDetail(sid) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    fetchStudent(sid)
      .then((d) => { if (alive) setData(d); })
      .catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [sid, tick]);

  return { data, error, retry: () => setTick((t) => t + 1) };
}

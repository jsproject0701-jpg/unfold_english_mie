// GAS Web API クライアント(設計書セクション3)
const GAS_URL = import.meta.env.VITE_GAS_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

async function parseResponse(res) {
  const data = await res.json();
  if (data && data.error) {
    throw new Error(data.error + (data.message ? `: ${data.message}` : ''));
  }
  return data;
}

export async function fetchBootstrap() {
  const url = `${GAS_URL}?action=bootstrap&key=${encodeURIComponent(API_KEY)}`;
  const res = await fetch(url);
  return parseResponse(res);
}

// 生徒詳細は5分メモリキャッシュ(設計書3 実装上の注意)
const studentCache = new Map();
const STUDENT_CACHE_TTL = 5 * 60 * 1000;

export async function fetchStudent(id) {
  const cached = studentCache.get(id);
  if (cached && Date.now() - cached.at < STUDENT_CACHE_TTL) {
    return cached.data;
  }
  const url = `${GAS_URL}?action=student&id=${encodeURIComponent(id)}&key=${encodeURIComponent(API_KEY)}`;
  const res = await fetch(url);
  const data = await parseResponse(res);
  studentCache.set(id, { data, at: Date.now() });
  return data;
}

// GASはCORSプリフライト非対応のため text/plain でPOSTする(preflight回避)
export async function approveFeedback(uuid, finalText) {
  const res = await fetch(`${GAS_URL}?action=approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'approve', uuid, finalText, key: API_KEY }),
  });
  return parseResponse(res);
}

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
  Inbox, Users, Target, Copy, Check, Pencil, Mic, BookOpen,
  Image as ImageIcon, PenLine, Bell, ChevronRight, Flame,
} from "lucide-react";

// ============================================================
// unfold english 管理コンソール（デモ / モックデータ）
// ブランドトークン：Instagramの世界観（深ティール×クリーム×淡グリーン）
// ============================================================
const C = {
  teal: "#0E3F3A",
  tealDeep: "#0A2E2A",
  tealSoft: "#1B5A52",
  cream: "#F6F1E4",
  paper: "#FCFAF3",
  sage: "#9DBE94",
  sageLight: "#E7F0E0",
  sageBadge: "#D9E8CF",
  ink: "#22302C",
  sub: "#65756F",
  line: "#E5DECB",
  amber: "#C2762E",
  amberLight: "#F7E8D4",
  red: "#A4452F",
};

const FONT = {
  display: "'Shippori Mincho', 'Hiragino Mincho ProN', serif",
  body: "'Zen Kaku Gothic New', 'Hiragino Kaku Gothic ProN', sans-serif",
};

const TYPE_META = {
  "1分スピーチ": { icon: Mic, tint: C.sageBadge },
  "シャドーイング": { icon: BookOpen, tint: "#E3E9F2" },
  "速読": { icon: ImageIcon, tint: C.amberLight },
  "ライティング": { icon: PenLine, tint: "#F0E4EE" },
};

// ---------------- モックデータ ----------------
const STUDENTS = [
  {
    id: "chiaki", name: "ちあき", course: "英会話力 集中強化", month: 3,
    goalWpm: 90,
    history: [
      { d: "3月", wpm: 58, fluency: 4, filler: 11 },
      { d: "4月", wpm: 67, fluency: 5, filler: 9 },
      { d: "5月", wpm: 76, fluency: 6, filler: 7 },
      { d: "6月", wpm: 88, fluency: 7, filler: 5 },
    ],
    submissions: [
      { date: "6/12", type: "1分スピーチ", wpm: 88, note: "filler 5回 / 流暢さ 7" },
      { date: "6/10", type: "速読", wpm: null, note: "スラッシュ正答 19/21" },
      { date: "6/9", type: "シャドーイング", wpm: null, note: "提出済・FB返信済" },
      { date: "6/6", type: "ライティング", wpm: null, note: "未使用表現 4つ抽出" },
    ],
  },
  {
    id: "kenta", name: "けんた", course: "英会話力 集中強化", month: 2,
    goalWpm: 100,
    history: [
      { d: "4月", wpm: 81, fluency: 6, filler: 8 },
      { d: "5月", wpm: 89, fluency: 6, filler: 6 },
      { d: "6月", wpm: 96, fluency: 7, filler: 6 },
    ],
    submissions: [
      { date: "6/12", type: "速読", wpm: null, note: "スラッシュ正答 16/21" },
      { date: "6/11", type: "1分スピーチ", wpm: 96, note: "filler 6回 / 流暢さ 7" },
    ],
  },
  {
    id: "yuko", name: "ゆうこ", course: "発音矯正 集中", month: 1,
    goalWpm: 80,
    history: [
      { d: "5月", wpm: 52, fluency: 3, filler: 14 },
      { d: "6月", wpm: 61, fluency: 4, filler: 10 },
    ],
    submissions: [
      { date: "6/12", type: "シャドーイング", wpm: null, note: "提出済・FB待ち" },
      { date: "6/8", type: "1分スピーチ", wpm: 61, note: "filler 10回 / 流暢さ 4" },
    ],
  },
];

const PENDING_INIT = [
  {
    id: 1, student: "ちあき", type: "1分スピーチ", time: "今日 9:14",
    stats: "WPM 88 ・ 単語数 88 ・ フィラー 5回 ・ 流暢さ 7/10",
    transcript:
      "Last weekend I went to a small bookstore near my house. I found a book about traveling in Vietnam, and I want to go there next year...",
    fbs: [
      "WPM88、ついに90目前です！3ヶ月前の58から+30はちあきさんの継続の成果そのものです。今月は「スピード>>>>正確性」のまま、もうひと殻破っていきましょう！",
      "旅行の話題、具体的でとても良いスピーチでした。次は \"I'm planning to 〜\" \"I've been wanting to 〜\" など予定・願望の言い回しを1つ混ぜてみましょう。よく使える順に：①I'm thinking of going ②I can't wait to ③I'm looking forward to",
      "フィラーが11→5回まで減っています。沈黙を恐れずに言い切れている証拠です。次回は1文だけ過去形と現在完了を意識して使い分けてみましょう！",
    ],
  },
  {
    id: 2, student: "けんた", type: "速読", time: "今日 8:40",
    stats: "スラッシュ正答 16/21 ・ 要約：内容一致◯ / 因果関係に誤読1箇所",
    transcript:
      "課題：読解特急2 Q19-21。前置詞句の区切り3箇所と、関係代名詞節の区切り2箇所にずれあり。",
    fbs: [
      "16/21、チャンクの感覚がしっかり育っています！ずれていたのは前置詞句（in the morning など）の手前。「前置詞が見えたらスラッシュ」を次回の合言葉にしましょう。",
      "要約は大筋バッチリです。1箇所だけ \"because\" の係り先が逆になっていたので、因果のチャンクは「原因/結果」で区切る意識を持ってみてください。",
      "WPM換算で前回比+8%。意味のかたまりで読めてきているので、次は音読でも同じ区切りで読んでみると定着が早いです！",
    ],
  },
  {
    id: 3, student: "ゆうこ", type: "シャドーイング", time: "昨日 22:05",
    stats: "テキスト一致率 91% ・ 脱落音 th/r に集中",
    transcript:
      "教材：Podcast 1分クリップ。\"there\" \"really\" の r 音、語尾の th が日本語の「ザ」寄りになる傾向。",
    fbs: [
      "1ヶ月目でこの一致率は素晴らしいスタートです！今は完璧さより「音の真似を楽しむ」フェーズなので、この調子でどんどん口を動かしていきましょう。",
      "th は「舌を軽く噛んで息だけ」を1日10回、単語単位（think / there / with）で練習してみてください。文の中で直すのはその後で大丈夫です👍",
      "r 音はWPM80に到達したら集中矯正に入るので、今は気にしすぎなくてOK。それより今週は「音の高低（イントネーション）」の真似を1つ意識してみましょう！",
    ],
  },
  {
    id: 4, student: "ちあき", type: "ライティング", time: "昨日 20:31",
    stats: "スピーチ未使用表現 4つ抽出",
    transcript:
      "ライティングでは使えているがスピーキング未出現：① even though ② used to ③ not only A but also B ④ I wish I could",
    fbs: [
      "書く力と話す力のギャップが見える化できました！4つの中ではまず \"used to\" が一番使いやすいです。次の1分スピーチで1回だけ意識して入れてみましょう。",
      "\"even though\" は会話での頻出度が高い表現です。「〜だけど」と言いたくなったら but の代わりに even though で文を始める練習をセッションでやりましょう！",
      "ライティングの構成力は十分なので、あとは瞬発力だけ。瞬間英作文の「おかわり」章でこの4表現が出てくる箇所をピックアップしてお送りしますね。",
    ],
  },
];

// トラッキング：月次の勉強時間（目標60h/月）
const STUDY = {
  chiaki: [ { m: "4月", actual: 52, target: 60 }, { m: "5月", actual: 64, target: 60 }, { m: "6月", actual: 23, target: 26 } ],
  kenta: [ { m: "4月", actual: 61, target: 60 }, { m: "5月", actual: 48, target: 60 }, { m: "6月", actual: 27, target: 26 } ],
  yuko: [ { m: "5月", actual: 41, target: 60 }, { m: "6月", actual: 19, target: 26 } ],
};

const MATERIALS = {
  chiaki: [
    { name: "金フレ 日英", done: 9, total: 14 },
    { name: "瞬間英作文（青）", done: 11, total: 17 },
    { name: "読解特急2", done: 7, total: 30 },
  ],
  kenta: [
    { name: "金フレ 英日", done: 6, total: 14 },
    { name: "瞬間英作文シャッフル（緑）", done: 12, total: 28 },
    { name: "読解特急2", done: 9, total: 30 },
  ],
  yuko: [
    { name: "金フレ 日英", done: 3, total: 14 },
    { name: "瞬間英作文（青）", done: 4, total: 17 },
  ],
};

// ---------------- 共通パーツ ----------------
function Card({ children, style }) {
  return (
    <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14, ...style }}>
      {children}
    </div>
  );
}

function TypeBadge({ type }) {
  const meta = TYPE_META[type] || TYPE_META["1分スピーチ"];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
      style={{ background: meta.tint, color: C.ink, fontFamily: FONT.body }}>
      <Icon size={12} /> {type}
    </span>
  );
}

// ---------------- ① FB承認キュー ----------------
function FbQueue({ pending, setPending, approved, setApproved }) {
  const [openId, setOpenId] = useState(pending[0]?.id ?? null);

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
          <QueueCard key={item.id} item={item}
            open={openId === item.id}
            onToggle={() => setOpenId(openId === item.id ? null : item.id)}
            onApprove={(finalText) => {
              setPending(pending.filter((p) => p.id !== item.id));
              setApproved([{ ...item, finalText }, ...approved]);
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
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState(item.fbs[0]);
  const [copied, setCopied] = useState(false);

  const pick = (i) => { setSelected(i); setDraft(item.fbs[i]); };

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
              {item.student}さん <span style={{ fontWeight: 400, color: C.sub, fontSize: 12 }}>・{item.time}</span>
            </p>
            <p style={{ fontFamily: FONT.body, fontSize: 12, color: C.sub, margin: "2px 0 0" }}>{item.stats}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TypeBadge type={item.type} />
          <ChevronRight size={16} style={{ color: C.sub, transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div style={{ background: C.cream, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
            <p style={{ fontFamily: FONT.body, fontSize: 11, color: C.sub, margin: "0 0 4px", letterSpacing: "0.08em" }}>AI解析メモ（生徒には非公開）</p>
            <p style={{ fontFamily: FONT.body, fontSize: 13, color: C.ink, margin: 0, lineHeight: 1.7 }}>{item.transcript}</p>
          </div>

          <p style={{ fontFamily: FONT.body, fontSize: 11, color: C.sub, margin: "0 0 6px", letterSpacing: "0.08em" }}>FB候補（タップで選択）</p>
          <div className="flex flex-col gap-2 mb-3">
            {item.fbs.map((fb, i) => (
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

// ---------------- ② 生徒ダッシュボード ----------------
function StudentView() {
  const [sid, setSid] = useState(STUDENTS[0].id);
  const s = STUDENTS.find((x) => x.id === sid);
  const latest = s.history[s.history.length - 1];
  const first = s.history[0];

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {STUDENTS.map((st) => (
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

      <Card style={{ padding: 20, marginBottom: 14 }}>
        <div className="flex items-baseline justify-between mb-1">
          <h2 style={{ fontFamily: FONT.display, fontSize: 22, color: C.ink, margin: 0 }}>{s.name}さん</h2>
          <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.sub }}>{s.course}コース ・ {s.month}ヶ月目</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <Stat label="現在WPM" value={latest.wpm} sub={`目標 ${s.goalWpm}`} />
          <Stat label="開始時から" value={`+${latest.wpm - first.wpm}`} sub="WPM" accent />
          <Stat label="流暢さ" value={`${latest.fluency}/10`} sub={`フィラー ${latest.filler}回`} />
        </div>
      </Card>

      <Card style={{ padding: 20, marginBottom: 14 }}>
        <p style={{ fontFamily: FONT.body, fontSize: 12, letterSpacing: "0.1em", color: C.sub, margin: "0 0 10px" }}>WPM推移</p>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={s.history} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
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
      </Card>

      <Card style={{ padding: 20 }}>
        <p style={{ fontFamily: FONT.body, fontSize: 12, letterSpacing: "0.1em", color: C.sub, margin: "0 0 10px" }}>提出履歴</p>
        <div className="flex flex-col">
          {s.submissions.map((sub, i) => (
            <div key={i} className="flex items-center justify-between py-3"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
              <div className="flex items-center gap-3">
                <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.sub, width: 36 }}>{sub.date}</span>
                <TypeBadge type={sub.type} />
              </div>
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.sub }}>{sub.note}</span>
            </div>
          ))}
        </div>
      </Card>
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

// ---------------- ③ トラッキング ----------------
function TrackingView() {
  const [sid, setSid] = useState("chiaki");
  const [mode, setMode] = useState("monthly"); // monthly | cumulative
  const s = STUDENTS.find((x) => x.id === sid);
  const study = STUDY[sid];
  const materials = MATERIALS[sid];

  // 達成率データ：①累積 ②月次リセット
  const chartData = study.map((row, i) => {
    if (mode === "monthly") {
      return { m: row.m, 達成率: Math.round((row.actual / row.target) * 100) };
    }
    const cumA = study.slice(0, i + 1).reduce((a, r) => a + r.actual, 0);
    const cumT = study.slice(0, i + 1).reduce((a, r) => a + r.target, 0);
    return { m: row.m, 達成率: Math.round((cumA / cumT) * 100) };
  });

  const latestRate = chartData[chartData.length - 1]["達成率"];
  const behind = latestRate < 100;

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {STUDENTS.map((st) => (
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
        <p style={{ fontFamily: FONT.body, fontSize: 11, color: C.sub, margin: "8px 0 0", lineHeight: 1.6 }}>
          {mode === "monthly"
            ? "② 月ごとにリセット：前月のビハインドは持ち越しません。"
            : "① 累積：開始からの合計で計算。前月のビハインドが残ります。"}
        </p>
      </Card>

      <Card style={{ padding: 20 }}>
        <p style={{ fontFamily: FONT.body, fontSize: 12, letterSpacing: "0.1em", color: C.sub, margin: "0 0 12px" }}>教材の進み具合</p>
        <div className="flex flex-col gap-4">
          {materials.map((m, i) => {
            const pct = Math.round((m.done / m.total) * 100);
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
      </Card>
    </div>
  );
}

// ---------------- ルート ----------------
export default function App() {
  const [tab, setTab] = useState("queue");
  const [pending, setPending] = useState(PENDING_INIT);
  const [approved, setApproved] = useState([]);

  const tabs = [
    { key: "queue", label: "FB承認", icon: Inbox, badge: pending.length },
    { key: "students", label: "生徒", icon: Users, badge: null },
    { key: "tracking", label: "トラッキング", icon: Target, badge: null },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.cream, fontFamily: FONT.body }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap');
        button { cursor: pointer; border: none; background: none; padding: 0; }
        button:focus-visible { outline: 2px solid ${C.sage}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      {/* ヘッダー */}
      <header style={{ background: C.teal, padding: "20px 16px 14px" }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end justify-between">
            <div>
              <h1 style={{ fontFamily: FONT.display, fontSize: 24, color: C.cream, margin: 0, letterSpacing: "0.02em" }}>
                unfold english
              </h1>
              <p style={{ fontFamily: FONT.body, fontSize: 12, color: C.sage, margin: "2px 0 0", letterSpacing: "0.14em" }}>
                管理コンソール ｜ デモ版（モックデータ）
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: C.tealSoft }}>
              <Flame size={14} style={{ color: C.sage }} />
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: C.cream }}>生徒 9名</span>
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
        {tab === "queue" && (
          <FbQueue pending={pending} setPending={setPending} approved={approved} setApproved={setApproved} />
        )}
        {tab === "students" && <StudentView />}
        {tab === "tracking" && <TrackingView />}
      </main>
    </div>
  );
}

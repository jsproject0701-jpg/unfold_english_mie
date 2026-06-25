# unfold english 管理コンソール

みえさん英語コーチングの管理Webアプリ。設計の正は `docs/miesan-webapp-handoff.md`。

```
gas/        GASプロジェクト(claspのrootDir)
  コード.js   LINE Bot本体(v5.1 = 本番v5.0 + Phase1差分)
  api.js           Web管理画面用API(GAS上では api.gs)
  appsscript.json  マニフェスト ※初回push前に既存プロジェクトの内容と要照合
frontend/   Vite + React 管理コンソール(Vercelにデプロイ)
docs/       設計書
```

## 本番GAS(v5.0)からの差分 — 要承認ポイント

`gas/コード.js` は本番v5.0に対して以下の3点のみ変更している。

1. **doPost冒頭にAPI分岐を追加(LINE Webhookへの影響対策)**
   ```js
   if (e && e.parameter && e.parameter.action) {
     return handleApiPost(e);
   }
   ```
   - 何が変わるか: `?action=` クエリ付きのPOSTだけが新APIへ流れる。
     LINE PlatformのWebhookはクエリパラメータなしでPOSTするため、**既存のLINE処理は1行も通り道が変わらない**
   - ロールバック: このifブロック(3行)を削除して新バージョンを再デプロイすれば v5.0 と完全に同一挙動
2. **writeFeedbackToAdminSheet を13列に拡張**: appendRowに K=`待ち` / L=空 / M=UUID を追加。
   既存行(K〜M空欄)はAPI側が「待ち」扱い+UUID自動補完するため後方互換
3. **checkSetup に WEBAPP_API_KEY / TEMPLATE_SHEET_ID / ADMIN_SHEET_ID の確認を追加**(ログのみ)

## デプロイ手順

### GAS(Phase 1)

```bash
npm i -g @google/clasp
clasp login
# ⚠️ 初回のみ: 既存プロジェクトのマニフェストを確認してから push すること
#   clasp pull で現状を取得し、gas/appsscript.json と差分がないか確認
clasp push
# デプロイは必ず「新バージョン作成」(既存バージョン更新では反映されない)
clasp deploy --description "v5.1 webapp api"
```

スクリプトプロパティ(既存の LINE_TOKEN / OPENAI_KEY / ADMIN_SHEET_ID は保持される):

- `WEBAPP_API_KEY` … 新規追加(フロントの `VITE_API_KEY` と同じ値)
- `TEMPLATE_SHEET_ID` … 生徒テンプレシートのID(「新しい生徒を追加」メニューに必要)

ウェブアプリとしてデプロイ: 実行ユーザー=自分 / アクセス=全員。

トリガー設定(任意): GASエディタで `setupWeeklyValidationTrigger` を1回実行すると
週1(月曜9時)の `validateStudentSheets` が登録される。

### 動作確認(curl)

```bash
GAS_URL="https://script.google.com/macros/s/XXXX/exec"
KEY="WEBAPP_API_KEYの値"

# bootstrap(生徒一覧+FB承認キュー)
curl -L "$GAS_URL?action=bootstrap&key=$KEY"

# 生徒詳細(idはbootstrapのstudents[].id = sheetId)
curl -L "$GAS_URL?action=student&id=SHEET_ID&key=$KEY"

# approve(uuidはbootstrapのqueue[].uuid)
curl -L -X POST "$GAS_URL?action=approve" \
  -H "Content-Type: text/plain" \
  -d '{"uuid":"...","finalText":"テスト送信文面","key":"'$KEY'"}'

# 認証エラー確認
curl -L "$GAS_URL?action=bootstrap&key=wrong"   # → {"error":"unauthorized"}
```

### フロントエンド(Phase 2〜3)

```bash
cd frontend
cp .env.example .env.local   # VITE_GAS_URL / VITE_API_KEY を記入
npm install
npm run dev                  # ローカル確認
```

Vercel: ルートディレクトリ=`frontend`、環境変数 `VITE_GAS_URL` / `VITE_API_KEY` を設定。

## UIについて

UIの正は `docs/miesan-admin-demo.jsx`。デザイントークン(`frontend/src/theme.js` の C / FONT)・
レイアウト・コピーはデモから移植済み(Tailwind + recharts + lucide-react)。

デモとの差分(実データに存在しない項目のみ):
- ヘッダーの「デモ版(モックデータ)」表記を削除、生徒数バッジは実数表示
- 生徒タブの「流暢さ/フィラー」統計は生徒シートに未記録のため「–」表示(枠は維持)
- 提出履歴は1分スピーチタブの実データ(他種別の提出は生徒シートに記録されないため)
- トラッキングの当月目標時間は日割り(月間目標 × 経過日数/月日数)で計算

## 実装状況

- [x] Phase 1: GAS API(api.gs / FB候補K〜M列拡張 / checkSetup拡張 / 生徒追加メニュー / validateStudentSheets)
- [x] Phase 2: フロント接続(bootstrap取得・ローディング/エラー/空状態・approve楽観更新・5分キャッシュ)
- [x] UI照合: miesan-admin-demo.jsx のトークン・レイアウト・コピーへ差し替え
- [x] Phase 3: デプロイ(GAS新バージョン + Vercel本番公開)
- [x] Phase 4: 03英会話 + 05振り返り(phase4.js) — `#英会話`音声FB / `#振り返り`6項目FB / 毎月25日リマインド ※デプロイ待ち
- [x] Phase 5 Step 1: 06トラッキング通知(時間ベース) — `#時間`記録 / 毎日21時ビハインド判定 / 通知ログ ※デプロイ待ち
- [ ] Phase 5 Step 2: 課題(目標日)ベースのビハインド通知

### Phase 4 のデプロイ手順
1. `clasp push` → GASエディタで「デプロイを管理」→ **新バージョン**(LINE Webhook URLは不変)
2. 動作確認(英会話): LINEで `#英会話` → 録音送信 → FB候補に種別「英会話」で載る(言えなかった表現リスト付き)
3. 動作確認(振り返り): LINEで `#振り返り` → 6項目テンプレ返信 → 記入して返信 → FB候補に種別「振り返り」で3案
4. メニュー「🎓 生徒管理 ＞ 振り返りリマインダーを設定(毎月25日)」を1回実行(任意)

> **doPostへの変更点(ルール1)**: ①`TASK_TYPES.eikaiwa` を音声受付に変更＋`AUTO_PROCESS_TYPES`に`eikaiwa`追加 ②`#振り返り`モード追加
> ③音声分岐で`eikaiwa`を分けて処理(既存one_min/shadowingの挙動は不変) ④テキスト分岐に`reflection`追加(既存writingの挙動は不変)。
> **ロールバック**: 上記を戻す＋`removeReflectionReminderTrigger`。`#英会話`を準備中に戻すなら `eikaiwa` の accept を `[]`・guide を準備中文言に戻す。

> ★**振り返りのトーン精度**: `phase4.js` の `REFLECTION_FEWSHOT` は空。概要mdの「生徒例→みえさんFB例」を貼るとみえさんトーンの再現度が上がる(空でも動作する)。

### Phase 5 Step 1 のデプロイ手順(時間ベース)
1. `clasp push` → GASエディタで「デプロイを管理」→ **新バージョン**(LINE Webhook URLは不変)
2. 管理シートに「通知ログ」「勉強時間ログ」タブが無ければ自動作成される(初回記録時)
3. 生徒管理タブの **I列「月間目標時間(h)」** を各生徒に入力
4. メニュー「🎓 生徒管理 ＞ ビハインド通知トリガーを設定(毎日21時)」を1回実行
5. 動作確認: LINEで `#時間 1.5` → 勉強時間ログに行が増える。メニュー「今すぐビハインド判定を実行(テスト)」で対象者に通知

> **doPostへの変更点(ルール1)**: テキスト処理の先頭に「`#時間`で始まる場合のみ記録して終了」する分岐を1つ追加。
> それ以外のメッセージは従来通り。**ロールバック**は コード.js のこの if ブロック削除＋トリガー削除(`removeDailyBehindTrigger`)。

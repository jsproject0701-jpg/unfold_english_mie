# unfold english 管理コンソール

みえさん英語コーチングの管理Webアプリ。設計の正は `docs/miesan-webapp-handoff.md`。

```
gas/        GASプロジェクト(claspのrootDir)
  みえさんGAS.js   LINE Bot本体(v5.1 = 本番v5.0 + Phase1差分)
  api.js           Web管理画面用API(GAS上では api.gs)
  appsscript.json  マニフェスト ※初回push前に既存プロジェクトの内容と要照合
frontend/   Vite + React 管理コンソール(Vercelにデプロイ)
docs/       設計書
```

## 本番GAS(v5.0)からの差分 — 要承認ポイント

`gas/みえさんGAS.js` は本番v5.0に対して以下の3点のみ変更している。

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
- [ ] Phase 3: デプロイ(clasp push + Vercel。要: WEBAPP_API_KEY / TEMPLATE_SHEET_ID)
- [ ] Phase 4: 03英会話 + 05振り返り
- [ ] Phase 5: 06トラッキング通知 — **「Phase 5 GO」が出るまで着手禁止**

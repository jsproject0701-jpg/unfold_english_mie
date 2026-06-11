# みえさんプロジェクト Webアプリ実装

## 必読
作業開始前に必ず `docs/miesan-webapp-handoff.md` を読むこと。これが設計の正。
- `docs/miesan-admin-demo.jsx` = UIの正。デザイントークン・レイアウト・コピーを変更しない
  （照合済み。`frontend/src/theme.js` と各画面はデモから移植。実データに無い項目の扱いはREADME「UIについて」参照）
- `gas/みえさんGAS.js` = 本番稼働中のv5.0コード。LINE Botとして生徒9名が利用中

## 絶対ルール
1. 本番GASを壊さない。LINE Webhook（doPost）の既存分岐に影響する変更は、
   変更前に「何が変わるか・ロールバック方法」を私に説明して承認を得る
2. GASへの反映はclaspを使う。デプロイは必ず「新バージョン作成」
   （既存バージョン更新では反映されない）。スクリプトプロパティは保持される
3. Phase 5（トラッキング通知）は、みえさんと通知トーンの合意が取れるまで
   実装着手禁止。私が「Phase 5 GO」と言うまで待つ
4. スプレッドシートの列構成は設計書の定義を正とする。
   実シートと食い違う挙動が出たら、推測で直さず私に確認する
5. 各Phaseの完了時は、設計書セクション8の受け入れ条件のうち
   該当項目をテスト手順つきで報告してから次に進む

## 環境
- GASプロジェクト: scriptId 1VWwCX7lueqNhOdzI8YOW9snkftKF7BqMhEhMm_5t7xh2Ig-Z8vf7-jpl
- 管理シート: 1YAQJFIz3lk8KpP9nI7cuKa8AB6g2EBdyB4mfySbSmqo
- フロント: Vite + React、デプロイ先はVercel
- 私が事前に用意するもの: TEMPLATE_SHEET_ID（生徒テンプレシート）、WEBAPP_API_KEY

## リポジトリ構成
- `gas/` … GASプロジェクト（claspのrootDir）。`みえさんGAS.js`=LINE Bot本体、`api.js`=Webアプリ用API（GAS上ではapi.gs）
- `frontend/` … Vite + React 管理コンソール
- `docs/` … 設計書（handoff）

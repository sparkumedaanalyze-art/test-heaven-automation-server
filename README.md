# Heaven Automation Server

予約管理システムからHeavenの受付台帳へ自動的に予約を反映するサーバー

## 機能

- Webhookで予約データを受信
- Puppeteerで自動的にHeaven管理画面を操作
- 受付台帳への自動登録

## 環境変数

以下の環境変数を設定してください：

- `HEAVEN_URL`: Heavenのログインページ URL
- `HEAVEN_USER`: ログインID
- `HEAVEN_PASS`: パスワード
- `AUTH_TOKEN`: Webhook認証トークン
- `PORT`: サーバーポート（デフォルト: 3001）

## ローカル開発

```bash
npm install
cp .env.example .env
# .envファイルを編集
npm start

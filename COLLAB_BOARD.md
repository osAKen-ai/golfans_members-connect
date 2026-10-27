# Golfans Members' Connect 開発ログ

宝塚ゴルフ倶楽部 会員専用ポータル（Golfans Members' Connect）の開発・運用記録。

---

## 📌 現在のシステム稼働状況
- **本番Webアプリ**: [https://golfans-members-connect.pages.dev](https://golfans-members-connect.pages.dev)
- **公式ドメイン**: [https://takarazuka.golfans.com](https://takarazuka.golfans.com)
- **クラウドDB (Supabase)**: 専用テーブル `golfans_player_states` 稼働中
- **リポジトリ**: `osAKen-ai/golfans_members-connect`

---

## 📋 更新履歴

### [2026-10-27 15:50] Agy (バックエンド改修)
- **対応内容**:
  - SupabaseにGolfans専用テーブル `golfans_player_states` を新設。
  - `functions/api/sync.js` から津CCテーブル（`tcc_mm_players`）の依存を完全排除。
  - 未接続時の偽装保存成功を排除し、エラーハンドリングを厳格化。
  - `supabase-sync.js` の空配列（全削除）同期処理を改善。

### [2026-10-27 15:05] Agy (初期デプロイ)
- **対応内容**:
  - GitHubリポジトリ新設（`osAKen-ai/golfans_members-connect`）
  - Cloudflare Pagesへの自動デプロイ開通
  - 自前API `/api/sync` 経由でのSupabase同期を実装

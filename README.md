# GeoAutonome

**24時間自律稼働型・地理空間データマネタイズシステム**

PLATEAU・e-Stat 等の日本公的オープンデータを英語コンテンツと3D資産に変換し、海外マーケットへ自動配布する個人開発システムです。

## 概要

- **STAGE 1**: Hacker News / Reddit / e-Stat / PLATEAU のデータを1時間ごとに自動収集
- **STAGE 2**: Claude Haiku 4.5 で要約・スコアリング
- **STAGE 3**: Claude Sonnet 4.6 で英語記事ドラフト生成
- **STAGE 4**: スマホ Slack/Discord 通知 → 1クリック承認
- **STAGE 5**: dev.to / 自社ブログへ自動投稿
- **計測**: Gumroad 売上 Webhook + クリック追跡 + 月次 ROI レポート
- **Phase 3**: PLATEAU CityGML → FBX/glTF/USD 変換 → 海外3Dマーケット販売

## クイックスタート

```bash
git clone https://github.com/YOUR_USERNAME/geo-autonome.git
cd geo-autonome
npm install
npm run build
npm test
```

→ 詳細なセットアップ手順は **[docs/setup-guide.md](docs/setup-guide.md)** を参照してください。

## 必要な環境変数

| 変数名 | 説明 |
|-------|------|
| `ANTHROPIC_API_KEY` | Claude API キー（AI処理に必須） |
| `SLACK_WEBHOOK_URL` | 承認通知先 |
| `DEVTO_API_KEY` | dev.to 投稿用 |
| `GUMROAD_WEBHOOK_SECRET` | 販売 Webhook 署名検証 |

→ 全変数一覧は [setup-guide.md#付録-環境変数一覧](docs/setup-guide.md) を参照。

## ドキュメント

| ファイル | 内容 |
|---------|------|
| [docs/setup-guide.md](docs/setup-guide.md) | **セットアップ手順書**（このページから始める） |
| [docs/product-requirements.md](docs/product-requirements.md) | プロダクト要求定義書 |
| [docs/functional-design.md](docs/functional-design.md) | 機能設計書 |
| [docs/architecture.md](docs/architecture.md) | 技術仕様書 |
| [docs/repository-structure.md](docs/repository-structure.md) | リポジトリ構造 |
| [docs/development-guidelines.md](docs/development-guidelines.md) | 開発ガイドライン |

## ライセンス

MIT License

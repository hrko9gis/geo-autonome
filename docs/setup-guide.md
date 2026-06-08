# GeoAutonome セットアップ手順書

> **対象読者**: システム運用者（本人）  
> **所要時間**: 初回セットアップ 2〜3 時間  
> **前提**: macOS 14+ / Ubuntu 22.04+ / Windows WSL2、ターミナル操作に慣れていること

---

## 目次

1. [前提条件の確認](#1-前提条件の確認)
2. [リポジトリのセットアップ](#2-リポジトリのセットアップ)
3. [環境変数の設定](#3-環境変数の設定)
4. [外部サービスのアカウント設定](#4-外部サービスのアカウント設定)
5. [GitHub Actions のセットアップ](#5-github-actions-のセットアップ)
6. [承認サーバーのセットアップ（Tailscale）](#6-承認サーバーのセットアップtailscale)
7. [Gumroad Webhook サーバーのセットアップ](#7-gumroad-webhook-サーバーのセットアップ)
8. [日常運用の流れ](#8-日常運用の流れ)
9. [3D パイプラインのセットアップ（Phase 3 以降）](#9-3d-パイプラインのセットアップphase-3-以降)
10. [動作確認チェックリスト](#10-動作確認チェックリスト)
11. [トラブルシューティング](#11-トラブルシューティング)

---

## 1. 前提条件の確認

以下がインストールされていることを確認してください。

### 必須

```bash
# Node.js 20 以上
node --version   # v20.x.x であること

# npm
npm --version    # 10.x.x 程度

# git
git --version
```

### 確認コマンド（一括）

```bash
node --version && npm --version && git --version
```

### Phase 3 以降（3D パイプライン用・任意）

```bash
# Java 17 以上（citygml-tools 実行に必要）
java --version

# Blender 4.x（ヘッドレス実行用）
blender --version

# Unity 2022.3 LTS（バッチモード検証用、任意）
unity --version
```

---

## 2. リポジトリのセットアップ

### 2-1. クローンとインストール

```bash
git clone https://github.com/YOUR_USERNAME/geo-autonome.git
cd geo-autonome

npm install
```

### 2-2. ビルド確認

```bash
npm run build
# dist/ ディレクトリが生成されれば OK

npm test
# 全テストがパスすること（52 テストファイル / 330+ テスト）
```

### 2-3. データディレクトリの準備

```bash
mkdir -p data data/reports data/plateau/osaka pipeline/output
```

---

## 3. 環境変数の設定

### 3-1. 環境変数ファイルの作成

`.env` ファイルはコミット **禁止**。シェルプロファイルまたは `pass` / 1Password CLI で管理してください。

以下を参考に環境変数を設定します。

```bash
# === AI API（必須：STAGE 2/3 の実行に必要） ===
export ANTHROPIC_API_KEY="sk-ant-..."          # Claude API（従量課金）
                                               # ※ Claude Code Pro とは別クレデンシャル

# === データ収集（任意：e-Stat 収集を行う場合） ===
export ESTAT_API_KEY="your-estat-api-key"      # e-Stat API キー（無料取得）

# === 通知（必須：スマホ承認通知に使用） ===
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
# または
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# === 承認サーバー（必須：スマホから承認 UI にアクセスする場合） ===
export APPROVAL_SERVER_URL="http://100.x.x.x:8080"  # Tailscale IP に変更

# === 記事投稿（必須：dev.to 自動投稿を行う場合） ===
export DEVTO_API_KEY="your-devto-api-key"

# === ブログ投稿（任意：git push で自社ブログに投稿する場合） ===
export BLOG_DIR="/path/to/your/blog"           # Astro ブログのローカルパス

# === 短縮URL（任意：クリック計測を行う場合） ===
export SHORTENER_BASE_URL="https://geo.example.com"  # Cloudflare Workers の URL

# === Gumroad Webhook（任意：Webhook サーバーのポート変更が必要な場合） ===
export PORT="8081"                             # Webhook サーバーポート（デフォルト 8081）

# === Healthchecks.io（任意：収集処理の死活監視） ===
export HEALTHCHECK_BASE_URL="https://hc-ping.com"
export HEALTHCHECK_UUID_MAP='{"hacker_news":"uuid1","reddit":"uuid2"}'  # JSON形式

# === 3D パイプライン（Phase 3 以降） ===
export BLENDER_PATH="/path/to/blender"         # blender 実行ファイルのパス
export CITYGML_TOOLS_PATH="/path/to/citygml-tools"
export UNITY_PATH="/path/to/unity"

# === スコアリング重み（自動更新、通常は不要） ===
# data/scoring_weights.json が存在すれば自動的に読み込まれる
```

### 3-2. シェルプロファイルへの追加（推奨）

```bash
# ~/.zshrc または ~/.bashrc に追加
cat >> ~/.zshrc << 'EOF'
# GeoAutonome
export ANTHROPIC_API_KEY="sk-ant-..."
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
export DEVTO_API_KEY="..."
EOF

source ~/.zshrc
```

---

## 4. 外部サービスのアカウント設定

### 4-1. Anthropic API

1. https://console.anthropic.com/ にアクセス
2. API キーを作成（Claude Code Pro とは **別アカウントまたは別キー** を推奨）
3. **月次予算上限を設定**（例: 2,000円）
   - Console → Billing → Usage Limits で設定
4. 取得したキーを `ANTHROPIC_API_KEY` に設定

### 4-2. e-Stat API（任意）

1. https://www.e-stat.go.jp/api/ にアクセス
2. 無料アカウントを作成して API キーを取得
3. `ESTAT_API_KEY` に設定

### 4-3. Slack または Discord Webhook

**Slack の場合:**
1. https://api.slack.com/apps でアプリを作成
2. Incoming Webhooks を有効化
3. チャンネルに Webhook URL を追加
4. URL を `SLACK_WEBHOOK_URL` に設定

**Discord の場合:**
1. サーバー設定 → 連携サービス → ウェブフックを作成
2. URL を `DISCORD_WEBHOOK_URL` に設定

### 4-4. dev.to API キー

1. https://dev.to/settings/extensions にアクセス
2. 「DEV Community API Keys」セクションで生成
3. `DEVTO_API_KEY` に設定

### 4-5. Gumroad

1. https://gumroad.com/ でアカウント作成
2. **Merchant of Record 機能を有効化**（Settings → Payments）
3. 商品「Observable Notebook Templates: Japan Open Data」（$19）を登録
4. Settings → Advanced → Ping endpoint を後述の Webhook サーバー URL に設定

---

## 5. GitHub Actions のセットアップ

データ収集（STAGE 1）は GitHub Actions で 24/7 自動実行されます。

### 5-1. リポジトリ Secrets の設定

GitHub リポジトリ → Settings → Secrets and variables → Actions に以下を追加:

| Secret 名 | 説明 |
|-----------|------|
| `ESTAT_API_KEY` | e-Stat API キー |
| `HEALTHCHECK_BASE_URL` | Healthchecks.io のベース URL |
| `HEALTHCHECK_UUID_MAP` | ソース別 UUID の JSON（任意） |

### 5-2. ワークフローの確認

```bash
# ローカルでのテスト実行（手動トリガー相当）
node dist/collectors/collect-cli.js

# 実行後、data/collected_items.jsonl が生成されることを確認
ls -la data/
```

### 5-3. GitHub Actions の有効化確認

1. GitHub リポジトリ → Actions タブ
2. 「Collect Data」ワークフローが表示されること
3. 「Run workflow」ボタンで手動実行してテスト

---

## 6. 承認サーバーのセットアップ（Tailscale）

ドラフト承認 UI（スマホアクセス用）を設定します。

### 6-1. Tailscale のインストール

```bash
# macOS
brew install tailscale

# Ubuntu
curl -fsSL https://tailscale.com/install.sh | sh
```

### 6-2. Tailscale にログイン

```bash
sudo tailscale up
# 表示された URL にブラウザでアクセスして認証
```

### 6-3. Tailscale IP の確認

```bash
tailscale ip -4
# 100.x.x.x の形式の IP が表示される
```

この IP を `APPROVAL_SERVER_URL` に設定:
```bash
export APPROVAL_SERVER_URL="http://100.x.x.x:8080"
```

### 6-4. 承認サーバーの起動

```bash
node dist/approval/server.js
# または自動起動スクリプトを設定
```

> **スマホからのアクセス**: スマホにも Tailscale をインストールして同じアカウントでログインすると、承認 URL にアクセスできます。

---

## 7. Gumroad Webhook サーバーのセットアップ

### 7-1. サーバーの起動

```bash
# 環境変数が設定済みであることを確認
echo $GUMROAD_WEBHOOK_SECRET

# サーバー起動
node dist/webhook-server-cli.js
# [webhook-server-cli] Listening on port 8081
```

### 7-2. 公開エンドポイントの設定

Webhook サーバーは Cloudflare Tunnel または ngrok 等で公開する必要があります。

#### cloudflared のインストール（未インストールの場合）

**macOS:**
```bash
brew install cloudflared
```

**Ubuntu / WSL2:**
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

インストール確認:
```bash
cloudflared --version
```

#### トンネルの起動

```bash
# Cloudflare Tunnel（推奨・認証不要）
cloudflared tunnel --url http://localhost:8081

# ngrok（要アカウント登録・authtoken 設定が必要）
# https://dashboard.ngrok.com/signup でアカウント作成後:
# ngrok config add-authtoken <YOUR_AUTHTOKEN>
# ngrok http 8081
```

表示された URL（例: `https://abc.trycloudflare.com`）を Gumroad の Webhook URL として設定:
```
Webhook URL: https://abc.trycloudflare.com/webhook/gumroad
```

### 7-3. 動作確認

```bash
# ヘルスチェック
curl http://localhost:8081/health
# {"status":"ok"}
```

---

## 8. 日常運用の流れ

### 8-1. 朝の確認

```bash
# 1. 収集データの確認（GitHub Actions が自動実行）
wc -l data/collected_items.jsonl

# 2. STAGE 2: 要約・スコアリング（Haiku 4.5）
node dist/summarizers/summarize-cli.js
# → data/scored_items.jsonl に保存

# 3. STAGE 3: ドラフト生成（Sonnet 4.6）
node dist/generators/draft-cli.js
# → data/drafts.jsonl に保存

# 4. Slack/Discord へ通知送信
node dist/notify-cli.js
# → スマホに通知が届く
```

### 8-2. スマホで承認

1. Slack/Discord 通知の承認URLをタップ
2. 承認 UI でドラフトを確認
3. 「Approve」→ 投稿先（dev.to / Blog）を選択 →「Submit」

### 8-3. 承認後の自動投稿

```bash
# STAGE 6: 承認済みドラフトを投稿
node dist/publish-cli.js
# → dev.to + 自社ブログへ自動投稿
# → data/posts.jsonl に記録
```

### 8-4. 月次レポート生成

```bash
# 前月のレポートを生成
node dist/report-cli.js
# または特定月を指定
node dist/report-cli.js --year 2026 --month 5

# → data/reports/2026-05.json に保存
# → data/scoring_weights.json が更新される（次回スコアリングに反映）
```

### 8-5. クリックデータの同期（Cloudflare KV 経由の場合）

```bash
# data/kv_clicks.json を Cloudflare KV から取得後に実行
node dist/kv-sync-cli.js
# → data/clicks.jsonl に追記
```

---

## 9. 3D パイプラインのセットアップ（Phase 3 以降）

### 9-1. citygml-tools のインストール

```bash
# Java 17 が必要
java --version

# GitHub Releases からダウンロード
# https://github.com/citygml4j/citygml-tools/releases

# 展開して PATH に追加
export CITYGML_TOOLS_PATH="/path/to/citygml-tools/bin/citygml-tools"
```

### 9-2. Blender のインストール

```bash
# Linux
wget https://mirror.clarkson.edu/blender/release/Blender4.x/blender-4.x-linux-x64.tar.xz
tar -xf blender-4.x-linux-x64.tar.xz
export BLENDER_PATH="/path/to/blender-4.x/blender"

# macOS
brew install --cask blender
export BLENDER_PATH="/Applications/Blender.app/Contents/MacOS/Blender"
```

### 9-3. PLATEAU データの配置

```bash
# 大阪データを配置する構造
mkdir -p data/plateau/osaka/dotonbori/lod1
mkdir -p data/plateau/osaka/dotonbori/lod2
mkdir -p data/plateau/osaka/dotonbori/textures

# CityGML ファイルを配置
cp /path/to/osaka_dotonbori_*.gml data/plateau/osaka/dotonbori/lod1/
```

### 9-4. データ整備状況の確認

```bash
node dist/osaka-release-cli.js --check-readiness
# 各エリアの LOD・テクスチャ整備状況が表示される
# data/osaka_readiness.json に保存される
```

### 9-5. エリアのビルド

```bash
# Dotonbori のビルド
node dist/osaka-release-cli.js --build dotonbori
# → pipeline/output/osaka/dotonbori/*.zip が生成される

# Mega Pack の作成（全エリア揃った後）
node dist/osaka-release-cli.js --bundle
# → pipeline/output/osaka/osaka-mega-pack.zip が生成される
```

---

## 10. 動作確認チェックリスト

セットアップ後に以下を確認してください。

### 基本動作

```bash
# ビルドとテスト
npm run build
npm test

# STAGE 1: 収集テスト（API キー不要なソースで確認）
node dist/collectors/collect-cli.js
cat data/collected_items.jsonl | wc -l   # 1件以上あること

# AI 処理テスト（ANTHROPIC_API_KEY が必要）
node dist/summarizers/summarize-cli.js
cat data/scored_items.jsonl | wc -l     # 処理済みアイテムがあること
```

### 承認サーバー

```bash
# Tailscale で接続してヘルスチェック
curl http://100.x.x.x:8080/health
# {"status":"ok"}

# ドラフト一覧ページ
curl http://100.x.x.x:8080/drafts
# HTML が返ること
```

### Webhook サーバー

```bash
curl http://localhost:8081/health
# {"status":"ok"}
```

### 通知テスト

```bash
# ドラフトが存在する状態で通知をテスト
node dist/notify-cli.js
# Slack/Discord に通知が届くこと
```

---

## 11. トラブルシューティング

### `ANTHROPIC_API_KEY is not set` エラー

```bash
# 環境変数を確認
echo $ANTHROPIC_API_KEY

# 設定されていない場合
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 収集アイテムが増えない

```bash
# GitHub Actions のログを確認
# GitHub → Actions → Collect Data → 最新の実行

# ローカルで手動実行してエラーを確認
node dist/collectors/collect-cli.js
```

### 承認 UI にスマホからアクセスできない

1. Tailscale がスマホ・PC 両方で同じアカウントにログインしているか確認
2. `tailscale ip -4` で取得した IP を `APPROVAL_SERVER_URL` に設定しているか確認
3. 承認サーバーが起動しているか確認（`curl http://100.x.x.x:8080/health`）

### Gumroad Webhook が届かない

1. Gumroad の Ping endpoint 設定を確認
2. Webhook サーバーが起動しているか確認（`curl http://localhost:8081/health`）
3. Cloudflare Tunnel / ngrok が起動しているか確認

### 3D パイプラインのエラー（exit code 5）

```bash
# Blender が正しく設定されているか確認
$BLENDER_PATH --version

# citygml-tools が動作するか確認
$CITYGML_TOOLS_PATH --version

# データ整備状況を確認
node dist/osaka-release-cli.js --check-readiness
```

### 依存関係のエラー

```bash
# node_modules を削除して再インストール
rm -rf node_modules
npm install

# ビルドキャッシュのクリア
rm -rf dist
npm run build
```

---

## 付録: 環境変数一覧

| 変数名 | 必須 | 説明 |
|-------|------|------|
| `ANTHROPIC_API_KEY` | ✅ STAGE 2/3 | Claude API キー（従量課金） |
| `ESTAT_API_KEY` | 任意 | e-Stat API キー |
| `SLACK_WEBHOOK_URL` | どちらか必須 | Slack Incoming Webhook URL |
| `DISCORD_WEBHOOK_URL` | どちらか必須 | Discord Webhook URL |
| `APPROVAL_SERVER_URL` | ✅ 承認 | Tailscale 経由の承認サーバー URL |
| `DEVTO_API_KEY` | ✅ 投稿 | dev.to API キー |
| `BLOG_DIR` | 任意 | 自社ブログのローカルパス |
| `SHORTENER_BASE_URL` | 任意 | 短縮 URL サービスの URL |
| `PORT` | 任意 | Webhook サーバーポート（デフォルト 8081） |
| `HEALTHCHECK_BASE_URL` | 任意 | Healthchecks.io ベース URL |
| `HEALTHCHECK_UUID_MAP` | 任意 | ソース別 UUID の JSON 文字列 |
| `BLENDER_PATH` | Phase 3 | Blender 実行ファイルパス |
| `CITYGML_TOOLS_PATH` | Phase 3 | citygml-tools 実行ファイルパス |
| `UNITY_PATH` | Phase 3 | Unity 実行ファイルパス |

## 付録: CLI コマンド一覧

| コマンド | 説明 | STAGE |
|---------|------|-------|
| `node dist/collectors/collect-cli.js` | データ収集（GitHub Actions も実行） | 1 |
| `node dist/summarizers/summarize-cli.js` | 要約・スコアリング（Haiku 4.5） | 2 |
| `node dist/generators/draft-cli.js` | ドラフト生成（Sonnet 4.6） | 3 |
| `node dist/notify-cli.js` | スマホ通知送信 | 4 |
| `node dist/publish-cli.js` | 承認済みドラフト投稿 | 6 |
| `node dist/webhook-server-cli.js` | Gumroad Webhook サーバー起動 | 常時 |
| `node dist/kv-sync-cli.js` | KV クリックデータ同期 | 計測 |
| `node dist/report-cli.js [--year YYYY --month MM]` | 月次レポート生成 | 月次 |
| `node dist/build-3d-cli.js --area <name> --input <path>` | 3D アセットビルド | Phase 3 |
| `node dist/osaka-release-cli.js --check-readiness` | PLATEAU データ整備確認 | Phase 3 |
| `node dist/osaka-release-cli.js --build <area>` | 大阪エリアビルド | Phase 3 |
| `node dist/osaka-release-cli.js --bundle` | Mega Pack 作成 | Phase 3 |

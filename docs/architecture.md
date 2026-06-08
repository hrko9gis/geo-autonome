# 技術仕様書 (Architecture Design Document)

## テクノロジースタック

### 言語・ランタイム

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Python | 3.12 | 自律エージェント全スクリプト・承認サーバー |
| TypeScript | 5.x | Cloudflare Workers（短縮 URL / Webhook 受信） |
| Node.js | 20.x LTS | TypeScript ランタイム（Wrangler 経由） |

**Python 3.12 選定理由**:
- 地理空間・AI・科学系ライブラリ（`anthropic`, `geopandas`, `scikit-learn`, `bpy`）が最も充実
- `asyncio` ネイティブ対応で複数 API の並列呼び出しが容易
- スクリプト単体で完結し、Dev Containers での環境再現が容易
- 型ヒント（`TypeVar`, `dataclass`）が強化されコードの可読性が高い

**TypeScript / Node.js 選定理由**:
- Cloudflare Workers の公式 SDK（Wrangler）が TypeScript ファースト
- KV / R2 / D1 の型安全な API が提供されている
- エッジ実行環境（V8 Isolate）では Python が動作しないため TypeScript を使用

### フレームワーク・ライブラリ（Python）

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| FastAPI | 0.115.x | 承認 Web サーバー | 非同期対応・自動 OpenAPI 生成・Pydantic 統合 |
| uvicorn | 0.34.x | ASGI サーバー | 軽量・単一コマンドで起動 |
| anthropic | 0.52.x | Claude API クライアント | 公式 SDK・プロンプトキャッシュ対応 |
| httpx | 0.28.x | 非同期 HTTP クライアント | `asyncio` ネイティブ、URL 疎通確認に使用 |
| feedparser | 6.x | RSS/Atom パーサー | PLATEAU/国交省フィードの解析 |
| praw | 7.x | Reddit API クライアント | 公式ライブラリ・OAuth2 対応 |
| geopy | 2.x | ジオコーディング | 地名→座標変換（Nominatim / Google Maps） |
| scikit-learn | 1.6.x | TF-IDF・コサイン類似度 | 新規性スコアリングと類似記事チェック |
| boto3 | 1.x | Cloudflare R2 クライアント | S3 互換 API で R2 にアクセス |
| schedule | 1.2.x | ローカルスケジューラ | エージェントのローカル起動管理（GitHub Actions が主） |

### フレームワーク・ライブラリ（TypeScript / Workers）

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| Wrangler | 4.x | CF Workers デプロイ CLI | 公式ツール・ローカル dev 環境も提供 |
| itty-router | 5.x | Workers 内ルーティング | 超軽量・Workers に最適化 |
| Astro | 5.x | 自社ブログフレームワーク | SSG で高速・Markdown 記事投稿が容易・CF Pages と公式統合 |

### 3D パイプライン

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| Blender | 4.x | CityGML → FBX/glTF/USD 変換 | OSS・Python API (bpy) 完備・headless 実行可能 |
| citygml-tools | 2.x | CityGML パーサー (Java CLI) | PLATEAU 公式推奨・LOD 別抽出対応 |
| Unity | 2022.3 LTS | FBX 取り込み検証 | `-batchmode` CLI でヘッドレス検証可能 |

### 開発ツール

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| Docker / Dev Containers | 24.x / 1.x | 開発環境統一 | ローカル差分をゼロにしチームレス開発を標準化 |
| pytest | 8.x | Python テストランナー | 標準的・プラグイン豊富 |
| ruff | 0.9.x | Python リンター / フォーマッター | uv と統合・高速 |
| uv | 0.6.x | Python パッケージ管理 | pip 比 10-100x 高速・lockfile 対応 |
| GitHub Actions | — | CI/CD・cron ジョブ | 収集処理の 24/7 稼働・無料枠あり |

---

## アーキテクチャパターン

### パイプライン + イベント駆動アーキテクチャ

GeoAutonome は CLIツール・Web サービスではなく**自律型パイプライン**であるため、
レイヤードアーキテクチャではなく「ステージ分離パイプライン」パターンを採用する。

```
┌─────────────────────────────────────────────────────────┐
│  STAGE 1: 収集 (GitHub Actions cron / 1h)               │
│  collect.sh → HN/Reddit/e-Stat/PLATEAU → items テーブル │
└────────────────────────┬────────────────────────────────┘
                         │ DB write
┌────────────────────────▼────────────────────────────────┐
│  STAGE 2: 要約・スコアリング (ローカル / 1h)              │
│  summarize.py → Haiku 4.5 API → scored_items テーブル    │
└────────────────────────┬────────────────────────────────┘
                         │ DB write
┌────────────────────────▼────────────────────────────────┐
│  STAGE 3: ドラフト生成 (ローカル / 1日1〜2回)             │
│  draft.py → Sonnet 4.6 API → drafts テーブル             │
└────────────────────────┬────────────────────────────────┘
                         │ DB write
┌────────────────────────▼────────────────────────────────┐
│  STAGE 4: 事実検証 (ローカル / ドラフト後)               │
│  verify.py → URL チェック + ジオコーディング + 類似度      │
└────────────────────────┬────────────────────────────────┘
                         │ 通知
┌────────────────────────▼────────────────────────────────┐
│  STAGE 5: 人間承認 (スマホ / オンデマンド)               │
│  Slack/Discord 通知 → 承認 Web UI (Tailscale 経由)       │
└────────────────────────┬────────────────────────────────┘
                         │ 承認イベント
┌────────────────────────▼────────────────────────────────┐
│  STAGE 6: 投稿・販売 (ローカル / 承認トリガー)            │
│  publish.py → dev.to API / git push → CF Pages          │
└────────────────────────┬────────────────────────────────┘
                         │ 並行
┌────────────────────────▼────────────────────────────────┐
│  STAGE 7: 計測・評価 (1h ごと + 月次)                    │
│  sync_sales.py → CF KV + Webhook → sales / clicks       │
└─────────────────────────────────────────────────────────┘
```

### レイヤー責務

#### 収集レイヤー（Collector）
- **責務**: 外部 API / RSS / ローカルファイルからデータを取得し `items` テーブルへ書き込む
- **許可される操作**: HTTP GET、SQLite write
- **禁止される操作**: AI API 呼び出し、ビジネスロジック

#### AI 処理レイヤー（Summarizer / DraftGenerator）
- **責務**: Claude API を呼び出し、要約・スコアリング・記事生成を行う
- **許可される操作**: Anthropic API 呼び出し、SQLite read/write
- **禁止される操作**: 外部 API への投稿、ユーザーへの直接通知

#### 検証レイヤー（FactVerifier）
- **責務**: ドラフトの事実精度を検証し結果を DB に保存する
- **許可される操作**: HTTP GET（URL 疎通）、ジオコーディング API
- **禁止される操作**: ドラフト内容の自動修正

#### 配信レイヤー（Publisher）
- **責務**: 承認済みドラフトを外部プラットフォームへ投稿する
- **許可される操作**: dev.to API、git push、CF Workers API
- **禁止される操作**: 未承認ドラフトの投稿

#### エッジレイヤー（Cloudflare Workers）
- **責務**: 短縮 URL リダイレクト・クリック計測・Webhook 受信
- **許可される操作**: KV read/write、R2 read、302 リダイレクト
- **禁止される操作**: SQLite への直接アクセス、長時間処理

---

## インフラストラクチャ構成

### 実行環境マトリクス

| コンポーネント | 実行環境 | トリガー | 停止耐性 |
|--------------|----------|---------|---------|
| collect.sh | GitHub Actions | cron 毎時 | ローカル停止でも継続 |
| summarize.py | ローカル PC | cron 毎時 | ローカル停止で一時停止 |
| draft.py | ローカル PC | cron 1日2回 | ローカル停止で一時停止 |
| verify.py | ローカル PC | draft.py 完了後 | 〃 |
| notify.py | ローカル PC | verify.py 完了後 | 〃 |
| publish.py | ローカル PC | 承認 Webhook | 〃 |
| sync_sales.py | ローカル PC | cron 毎時 | 〃 |
| report.py | ローカル PC | cron 月次 | 〃 |
| build_3d.py | ローカル PC / RunPod | 手動 / cron | GPU 要件あり |
| ApprovalServer | ローカル PC | 常時起動 | Tailscale 要 |
| CF Workers (短縮URL) | Cloudflare Edge | HTTP リクエスト | 99.99% SLA |
| CF Workers (Webhook) | Cloudflare Edge | HTTP POST | 99.99% SLA |
| 自社ブログ | Cloudflare Pages | git push | 99.99% SLA |

### ネットワーク構成

```
インターネット
    │
    ├─── Cloudflare Edge（Workers / Pages）
    │        ├── geo.example.com/r/{code}  → KV クリック記録 + 302 リダイレクト
    │        ├── geo.example.com/webhook/* → HMAC 検証 + KV キュー積み
    │        └── blog.example.com         → 自社ブログ（SSG）
    │
    └─── ローカルマシン（Tailscale ネットワーク内）
             ├── 100.x.x.x:8080  → 承認 Web サーバー（Tailscale のみ到達可）
             └── SQLite DB        → 全エージェントの状態管理
```

---

## データ永続化戦略

### ストレージ方式

| データ種別 | ストレージ | フォーマット | 理由 |
|-----------|----------|-------------|------|
| 収集アイテム・ドラフト・承認・投稿・売上 | SQLite (local) | バイナリ | 依存ゼロ・単一ファイル・個人規模に十分 |
| クリックカウンタ（リアルタイム） | Cloudflare KV | JSON | エッジ実行の書き込み遅延が最小 |
| Webhook キュー | Cloudflare KV | JSON | エッジ→ローカルの非同期橋渡し |
| 3D アセット・ブログ記事ソース | Cloudflare R2 | バイナリ / Markdown | ローカルディスク節約・S3 互換 |
| SQLite 日次バックアップ | Cloudflare R2 | バイナリ | 障害時復元・コスト最小 |
| シークレット（API キー等） | pass (GPG) / 1Password | 暗号化 | `.env` 直書き禁止 |

### バックアップ戦略

- **頻度**: 毎日 JST 02:00 に SQLite を R2 へアップロード
- **保存先**: `r2://geo-autonome-backup/db/geo_autonome_{YYYYMMDD}.db`
- **世代管理**: 直近 30 日分を保持、それ以前は削除
- **3D アセット**: ビルド成功時に即時 `r2://geo-autonome-assets/{area}/{version}/` へ保存
- **復元方法**: `aws s3 cp s3://... geo_autonome.db --endpoint-url $R2_ENDPOINT`

### SQLite 最適化設定

```sql
PRAGMA journal_mode = WAL;       -- 読み書き競合を最小化
PRAGMA synchronous = NORMAL;     -- パフォーマンスと安全性のバランス
PRAGMA foreign_keys = ON;        -- 参照整合性の強制
PRAGMA auto_vacuum = INCREMENTAL; -- ディスク使用量の自動管理
```

---

## AI API 利用設計

### Claude API 二系統分離

```
┌─────────────────────────────────────────┐
│ Claude Code Pro ($20/月)                 │
│ 用途: 人間の開発・デバッグ・レビュー      │
│ クレデンシャル: 開発環境にのみ存在       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Claude API (従量課金)                    │
│ 用途: 自律エージェント処理               │
│ クレデンシャル: ANTHROPIC_API_KEY (pass) │
│  ├── Haiku 4.5: 要約・スコアリング       │
│  └── Sonnet 4.6: 英語記事ドラフト生成    │
└─────────────────────────────────────────┘
```

### プロンプトキャッシュ設計

`anthropic` SDK のプロンプトキャッシュ機能を活用してコストを削減する。

```python
# summarize.py: システムプロンプトをキャッシュ
messages = client.messages.create(
    model="claude-haiku-4-5",
    system=[
        {
            "type": "text",
            "text": SYSTEM_PROMPT,           # 1000 token 超のシステムプロンプト
            "cache_control": {"type": "ephemeral"}  # キャッシュ有効化
        }
    ],
    messages=[{"role": "user", "content": item_text}]
)
```

- **Summarizer**: システムプロンプト（スコアリングルール）をキャッシュ、バッチ処理でキャッシュ有効期間内に複数アイテムを処理
- **DraftGenerator**: 競合記事テキストと執筆ガイドラインをキャッシュ

### API コスト上限設定

Anthropic Console で月次予算上限（例: 2,000円）を設定し、
超過時は API 呼び出しを自動停止する。
`summarize.py` 起動時に残高チェックを行い、残高 < 200円 の場合はスマホ通知。

---

## パフォーマンス要件

### レスポンスタイム

| 操作 | 目標時間 | 測定環境 |
|------|---------|---------|
| 収集サイクル全体 (collect.sh) | 5分以内 | GitHub Actions ubuntu-latest |
| 要約・スコアリング 50件 | 10分以内 | ローカル PC + Haiku 4.5 API |
| ドラフト生成 1本 | 3分以内 | ローカル PC + Sonnet 4.6 API |
| 承認画面の初回表示 | 500ms 以内 | Tailscale 同一ネットワーク |
| 短縮 URL リダイレクト | 100ms 以内 | Cloudflare Workers グローバル |
| Webhook 受信〜KV 書き込み | 200ms 以内 | Cloudflare Workers グローバル |
| 3D 変換 1街区 | 30分以内 | ローカル GPU または RunPod A6000 |
| SQLite クエリ（集計） | 1秒以内 | 10万行想定 |

### リソース使用量

| リソース | 上限 | 理由 |
|---------|------|------|
| ローカルメモリ（エージェント合計） | 2GB | 個人 PC 8GB 前提、他作業への影響最小化 |
| Cloudflare KV 書き込み | 1,000回/日 | 無料枠 1,000回/日 内に収める |
| Cloudflare Workers CPU | 10ms/リクエスト | 無料枠制限 |
| Anthropic API 月次コスト | 2,000円 | 月額バジェット 10,000円内 |
| GPU クラウド (RunPod) 月次コスト | 2,000円 | 月額バジェット内 |
| SQLite ファイルサイズ | 1GB | 3年分の収集データ想定 |

---

## セキュリティアーキテクチャ

### シークレット管理フロー

```
pass (GPG 暗号化) または 1Password CLI
           │
           │ `pass show geo-autonome/anthropic_api_key`
           │  または `op read op://vault/item/field`
           ▼
スクリプト実行時に環境変数として注入
           │
           │ export ANTHROPIC_API_KEY=...
           ▼
Python スクリプト / GitHub Actions Secrets
```

**禁止事項**:
- `.env` ファイルへの平文保存
- ソースコード内へのハードコード
- `git log` に残るコミット

### 承認サーバーのアクセス制御

```python
# FastAPI ミドルウェアで Tailscale IP のみ許可
@app.middleware("http")
async def tailscale_only(request: Request, call_next):
    client_ip = request.client.host
    if not client_ip.startswith("100."):  # Tailscale CGNAT レンジ
        return Response(status_code=403)
    return await call_next(request)
```

### Webhook 署名検証

```python
# Gumroad HMAC-SHA256 検証
import hmac, hashlib

def verify_gumroad_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

### データ保護

- SQLite バックアップ: R2 アップロード前に AES-256 で暗号化（`openssl enc -aes-256-cbc`）
- R2 バケット: パブリックアクセス無効、Workers サービスアカウントのみ read 許可
- Tailscale ACL: 承認サーバーへのアクセスを特定デバイス（スマホ + 開発 PC）のみに限定

---

## スケーラビリティ設計

### データ増加への対応

**想定データ量（12ヶ月運用後）**:
- `items`: 約 8,760件/年（1時間ごとに平均 1件）
- `scored_items`: 同上
- `drafts`: 約 730件/年（1日2本）
- `posts`: 約 500件/年
- `sales`: 数百〜数千件/年

**対策**:
- 収集後 90日以上経過した未選択 `items` は `archived_items` へ移動
- `clicks` テーブルは月次集計後、生データを削除（集計結果のみ保持）
- SQLite インデックス: `items(source, collected_at)`, `scored_items(total_score DESC)`, `sales(sold_at)`

**SQLite → PostgreSQL 移行トリガー**:
- 商品数 50点超または売上 1,000件超で Cloudflare D1（PostgreSQL 互換）への移行を実施
- 移行スクリプト `migrate_to_d1.py` を事前に整備

### 収集ソース追加への対応

新しい収集ソースは `BaseCollector` を継承するクラスを追加するだけで対応可能。
`collect.sh` は `collectors/` ディレクトリを自動検出して全コレクターを実行する。

```bash
# collect.sh の自動検出
for collector in agents/collectors/*.py; do
    python "$collector" || notify_failure "$collector"
done
```

### Cloudflare Workers のスケール

- 短縮 URL リダイレクト: Workers の無料枠 10万リクエスト/日を超えたら有料プラン（$5/月）へ移行
- KV 書き込み: 無料枠 1,000回/日を超えたら有料プラン（$0.50/100万書き込み）へ移行

---

## テスト戦略

### ユニットテスト
- **フレームワーク**: pytest 8.x + pytest-asyncio
- **対象**:
  - `ScoringEngine` の各スコア計算関数（境界値・エッジケース）
  - `FactVerifier.check_urls()` のモック HTTP レスポンス
  - `LicenseValidator` のライセンスマトリクス判定
  - 短縮コード生成の衝突回避ロジック
  - HMAC 署名検証（正常・改ざんケース）
- **カバレッジ目標**: ビジネスロジック 80% 以上

### 統合テスト
- **方法**: pytest + SQLite インメモリ DB
- **対象**:
  - Collector → Summarizer → DraftGenerator のパイプライン全体
  - ApprovalServer の承認フロー（TestClient 使用）
  - sync_sales.py の Webhook キュー処理

### E2E テスト
- **ツール**: `wrangler dev`（Workers ローカル実行）+ pytest
- **シナリオ**:
  - 短縮 URL リダイレクト + KV クリック記録の確認
  - Gumroad Webhook 受信 → KV キュー → SQLite 同期
  - dev.to API への投稿（sandbox / draft モード使用）

### CI パイプライン（GitHub Actions）

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  test:
    steps:
      - run: uv sync
      - run: ruff check .
      - run: pytest tests/ --cov=agents --cov-report=xml
  license-check:
    steps:
      - run: python agents/validate_licenses.py  # 全商品のライセンス検証
```

---

## 技術的制約

### 環境要件

| 項目 | 要件 |
|------|------|
| OS | macOS 14+ / Ubuntu 22.04+ / Windows WSL2 |
| Python | 3.12 以上 |
| Node.js | 20 LTS 以上 |
| Docker | 24 以上 |
| Blender | 4.0 以上（3D パイプライン使用時） |
| Java | 17 以上（citygml-tools 使用時） |
| GPU（推奨） | VRAM 8GB 以上（Blender Cycles レンダー） |
| ディスク | 20GB 以上（3D アセット作業用） |
| メモリ | 8GB 以上 |
| ネットワーク | Tailscale 接続済み |

### パフォーマンス制約

- GitHub Actions の cron は UTC 基準、JST 変換が必要
- Anthropic API の rate limit: Haiku 4.5 は 8,192 TPM（Tier 1）、バッチサイズを制限
- Reddit API: 60リクエスト/分、`praw` のビルトインレート制限を使用
- Cloudflare Workers: CPU time 10ms/リクエスト（無料）、KV 読み書き遅延 ~50ms
- Blender headless: シングルスレッド実行のため並列化不可（複数エリアは逐次処理）

### セキュリティ制約

- Tailscale デバイス登録なしでは承認サーバーに接続不可
- `pass` の GPG 鍵を紛失した場合、シークレットは復元不可（別の保管場所を必ず用意）
- PLATEAU データは CC BY 4.0 のため出典明記が必須、省略した商品の販売は許可されない
- ODbL ライセンスを含む OSM 派生データは商用販売不可（`license_matrix.csv` で管理）

---

## 依存関係管理

### Python パッケージ管理（uv）

```toml
# pyproject.toml
[project]
requires-python = ">=3.12"
dependencies = [
    "anthropic>=0.52,<0.60",       # API 互換性のためマイナーバージョン上限
    "fastapi>=0.115,<0.120",
    "httpx>=0.28,<0.30",
    "praw>=7.0,<8.0",              # v8 で破壊的変更の可能性
    "feedparser>=6.0,<7.0",
    "geopy>=2.0,<3.0",
    "scikit-learn>=1.6,<2.0",
    "boto3>=1.35,<2.0",
]

[tool.uv]
lock = true    # uv.lock で完全固定
```

**方針**:
- 外部 API クライアント（`anthropic`, `praw`）はマイナーバージョン上限を設定（破壊的変更リスク）
- `scikit-learn` 等のデータ処理ライブラリはメジャーバージョン固定
- `uv.lock` をコミットし再現性を保証

### Cloudflare Workers 依存関係（npm）

```json
{
  "dependencies": {
    "itty-router": "^5.0.0"
  },
  "devDependencies": {
    "wrangler": "^4.0.0",
    "typescript": "~5.3.0"
  }
}
```

### セキュリティアップデート方針

- `dependabot` で週次に依存関係の脆弱性スキャン
- `uv sync --upgrade` を月次で実行しパッチバージョンを更新
- メジャーバージョンアップは手動テスト後に適用

# リポジトリ構造定義書 (Repository Structure Document)

## プロジェクト構造（全体）

```
geo-autonome/
├── agents/                    # 自律エージェントスクリプト群 (Python)
│   ├── collectors/            # 外部ソース収集コレクター
│   ├── summarizers/           # 要約・スコアリング処理
│   ├── generators/            # 記事ドラフト生成
│   ├── verifiers/             # 事実検証
│   ├── publishers/            # 投稿・配信
│   ├── trackers/              # 売上・クリック追跡
│   ├── reporters/             # レポート生成
│   ├── shared/                # エージェント共通モジュール
│   ├── collect.sh             # 収集エントリーポイント
│   ├── summarize.py           # 要約・スコアリング起動スクリプト
│   ├── draft.py               # ドラフト生成起動スクリプト
│   ├── verify.py              # 検証起動スクリプト
│   ├── notify.py              # 通知起動スクリプト
│   ├── publish.py             # 投稿起動スクリプト
│   ├── sync_sales.py          # 売上同期起動スクリプト
│   └── report.py              # レポート生成起動スクリプト
├── approval/                  # 承認 Web サーバー (FastAPI)
│   ├── routers/               # API ルーター定義
│   ├── templates/             # Jinja2 HTML テンプレート
│   ├── static/                # CSS / JS
│   ├── middleware.py          # Tailscale IP 制限ミドルウェア
│   └── main.py                # FastAPI アプリケーション起動
├── workers/                   # Cloudflare Workers (TypeScript)
│   ├── short-url/             # 短縮 URL リダイレクト + クリック計測
│   └── webhook/               # 販売 Webhook 受信
├── blog/                      # 自社英語ブログ (Astro + CF Pages)
│   ├── src/
│   │   ├── content/posts/     # 投稿済み記事 Markdown
│   │   ├── layouts/           # ページレイアウト
│   │   └── pages/             # ルーティングページ
│   └── astro.config.mjs
├── pipeline/                  # 3D 変換パイプライン
│   ├── blender_scripts/       # Blender Python スクリプト (bpy)
│   ├── unity_scripts/         # Unity バッチモード検証スクリプト
│   └── build_3d.py            # 3D パイプライン起動スクリプト
├── data/                      # ローカルデータ
│   ├── geo_autonome.db        # SQLite メイン DB
│   ├── license_matrix.csv     # データソースライセンスマトリクス
│   └── verified_sources.csv   # 検証済みソース初期データ
├── tests/                     # テストコード
│   ├── unit/                  # ユニットテスト
│   ├── integration/           # 統合テスト
│   └── e2e/                   # E2E テスト
├── docs/                      # 永続的プロジェクトドキュメント
├── .github/
│   └── workflows/             # GitHub Actions ワークフロー
├── .steering/                 # 作業単位のドキュメント
├── .claude/                   # Claude Code 設定
├── .devcontainer/             # Dev Containers 設定
├── pyproject.toml             # Python パッケージ設定 (uv)
├── uv.lock                    # Python 依存ロックファイル
└── README.md
```

---

## ディレクトリ詳細

### agents/ (自律エージェント)

**役割**: 24/7 で自動実行される全スクリプトと共通モジュールを配置する

#### agents/collectors/

**役割**: 各外部ソースからデータを取得し `items` テーブルへ書き込むコレクター群

**配置ファイル**:
- `base.py`: `BaseCollector` 抽象クラス（`collect()`, `save_to_db()` インターフェース定義）
- `hacker_news.py`: `HackerNewsCollector`
- `reddit.py`: `RedditCollector`
- `estat.py`: `EStatCollector`
- `plateau_feed.py`: `PlateauFeedCollector`
- `local_file.py`: `LocalFileCollector`

**命名規則**:
- ファイル名: `snake_case.py`
- クラス名: `PascalCase` + `Collector` 接尾辞

**依存関係**:
- 依存可能: `agents/shared/`
- 依存禁止: `agents/generators/`, `agents/publishers/`（AI 処理・配信レイヤーへの直接アクセス不可）

**例**:
```
agents/collectors/
├── base.py              # BaseCollector 抽象クラス
├── hacker_news.py       # HackerNewsCollector
├── reddit.py            # RedditCollector
├── estat.py             # EStatCollector
├── plateau_feed.py      # PlateauFeedCollector
└── local_file.py        # LocalFileCollector
```

---

#### agents/summarizers/

**役割**: 収集アイテムを Claude Haiku 4.5 で要約・スコアリングする処理群

**配置ファイル**:
- `summarizer.py`: `Summarizer` クラス（バッチ処理オーケストレーション）
- `scoring_engine.py`: `ScoringEngine` クラス（スコア計算ロジック）
- `prompts.py`: システムプロンプト定数

**依存関係**:
- 依存可能: `agents/shared/`
- 依存禁止: `agents/publishers/`, `agents/generators/`

---

#### agents/generators/

**役割**: スコア上位アイテムから Claude Sonnet 4.6 で英語記事ドラフトを生成する処理群

**配置ファイル**:
- `draft_generator.py`: `DraftGenerator` クラス
- `prompts.py`: システムプロンプト・ユーザープロンプトテンプレート

**依存関係**:
- 依存可能: `agents/shared/`
- 依存禁止: `agents/publishers/`（生成とは別責務）

---

#### agents/verifiers/

**役割**: 記事ドラフトの事実精度を自動検証する処理群

**配置ファイル**:
- `fact_verifier.py`: `FactVerifier` クラス（検証オーケストレーション）
- `url_checker.py`: URL 到達確認
- `source_checker.py`: 統計年度・出典突合
- `geo_checker.py`: 地名・座標検証（ジオコーディング）
- `similarity_checker.py`: 過去記事類似度計算

**依存関係**:
- 依存可能: `agents/shared/`
- 依存禁止: `agents/generators/`（検証はドラフト修正を行わない）

---

#### agents/publishers/

**役割**: 承認済みドラフトを外部プラットフォームへ投稿する配信処理群

**配置ファイル**:
- `publisher.py`: `Publisher` オーケストレーター
- `devto.py`: `DevToPublisher`（dev.to API 投稿）
- `blog.py`: `BlogPublisher`（git push → CF Pages）
- `url_shortener.py`: `URLShortenerClient`（CF Workers API）

**依存関係**:
- 依存可能: `agents/shared/`
- 依存禁止: `agents/collectors/`, `agents/generators/`

---

#### agents/trackers/

**役割**: 売上 Webhook の処理と Cloudflare KV との同期

**配置ファイル**:
- `sales_syncer.py`: `SalesSyncer`（KV → SQLite 同期）
- `webhook_processor.py`: Webhook キュー処理
- `hmac_verifier.py`: HMAC 署名検証

**依存関係**:
- 依存可能: `agents/shared/`
- 依存禁止: その他エージェントモジュール（独立して動作）

---

#### agents/reporters/

**役割**: 月次 ROI レポート生成とスコアリング重み更新

**配置ファイル**:
- `report_generator.py`: `ReportGenerator`
- `queries.py`: 集計 SQL クエリ定数

**依存関係**:
- 依存可能: `agents/shared/`

---

#### agents/shared/

**役割**: 全エージェントで共通利用するユーティリティ・型定義・DB アクセス

**配置ファイル**:
- `database.py`: SQLite 接続管理・マイグレーション
- `models.py`: `dataclass` によるエンティティ定義（`Item`, `Draft`, `Sale` 等）
- `notifier.py`: Slack / Discord Webhook 通知
- `logger.py`: ログ設定（structlog ベース）
- `config.py`: 環境変数・設定値の読み込み
- `retry.py`: リトライデコレーター（指数バックオフ）
- `exit_codes.py`: 終了コード定数（0〜6）

**依存関係**:
- 依存可能: なし（他モジュールへの依存禁止）
- 依存禁止: 全エージェントモジュール（共通基盤であるため）

---

### approval/ (承認 Web サーバー)

**役割**: Tailscale 経由でスマホからアクセスする承認 UI を提供する FastAPI アプリケーション

```
approval/
├── routers/
│   ├── drafts.py        # GET /drafts/{id}
│   └── approvals.py     # POST /approvals
├── templates/
│   ├── base.html        # ベーステンプレート
│   ├── draft_list.html  # ドラフト一覧
│   └── draft_detail.html # ドラフト詳細・承認画面
├── static/
│   ├── style.css        # モバイル対応 CSS
│   └── app.js           # 承認アクション JS
├── middleware.py        # Tailscale IP 制限
└── main.py              # FastAPI app, uvicorn 起動設定
```

**命名規則**:
- ルーターファイル: `snake_case.py`（リソース名の複数形）
- テンプレート: `snake_case.html`

**依存関係**:
- 依存可能: `agents/shared/`（DB アクセスのみ）
- 依存禁止: `agents/generators/`, `agents/collectors/`（承認 UI はビジネスロジックを持たない）

---

### workers/ (Cloudflare Workers)

**役割**: エッジで実行する短縮 URL リダイレクトと Webhook 受信の 2 Workers

```
workers/
├── short-url/
│   ├── src/
│   │   └── index.ts     # リダイレクト + KV クリックカウント
│   ├── wrangler.toml
│   └── package.json
└── webhook/
    ├── src/
    │   ├── index.ts     # Webhook ルーティング
    │   ├── gumroad.ts   # Gumroad Webhook ハンドラー
    │   ├── sketchfab.ts # Sketchfab Webhook ハンドラー
    │   └── hmac.ts      # HMAC 検証ユーティリティ
    ├── wrangler.toml
    └── package.json
```

**命名規則**:
- ファイル名: `camelCase.ts`
- ルーティングハンドラー: `handle{Resource}.ts` または `{platform}.ts`

**依存関係**:
- 依存可能: Cloudflare KV / R2 バインディング（wrangler.toml で定義）
- 依存禁止: Python エージェントモジュール（実行環境が別）

---

### blog/ (自社英語ブログ)

**役割**: Astro で構築した SSG ブログ。`blog/` は Publisher が自動 push する対象

```
blog/
├── src/
│   ├── content/
│   │   └── posts/       # 投稿済み記事 (.md / .mdx)
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── PostLayout.astro
│   └── pages/
│       ├── index.astro  # トップページ
│       └── posts/
│           └── [...slug].astro
├── public/              # 静的アセット
├── astro.config.mjs
└── package.json
```

**命名規則**:
- 記事ファイル: `YYYY-MM-DD-slug.md`（Publisher が自動生成）
- コンポーネント: `PascalCase.astro`

---

### pipeline/ (3D 変換パイプライン)

**役割**: PLATEAU CityGML から 3D マーケット向けアセットを生成するスクリプト群

```
pipeline/
├── blender_scripts/
│   ├── convert.py       # CityGML → FBX/glTF/USD 変換メインスクリプト
│   ├── lod_generator.py # LOD 自動生成 (Decimate Modifier)
│   ├── texture_atlas.py # テクスチャアトラス化
│   ├── promo_render.py  # プロモーション用 Cycles レンダー
│   └── utils.py         # Blender bpy ユーティリティ
├── unity_scripts/
│   └── validate_import.cs # Unity -batchmode FBX 取り込み検証
├── license_validator.py # ライセンスマトリクス検証
├── packager.py          # アセット ZIP パッケージング
├── upload_product.py    # Gumroad / Sketchfab 自動アップロード
└── build_3d.py          # 3D パイプライン起動スクリプト
```

**命名規則**:
- Blender スクリプト: `snake_case.py`（Blender の bpy 慣習に合わせる）
- Unity スクリプト: `PascalCase.cs`（Unity の C# 慣習）

---

### data/ (ローカルデータ)

**役割**: SQLite DB と静的設定データを配置する

```
data/
├── geo_autonome.db        # SQLite メイン DB（.gitignore に追加）
├── license_matrix.csv     # データソースライセンスマトリクス（バージョン管理対象）
└── verified_sources.csv   # 検証済みソース初期データ（バージョン管理対象）
```

**注意**: `geo_autonome.db` は `.gitignore` に追加し、バージョン管理対象外とする。
バックアップは Cloudflare R2 で管理。

---

### tests/ (テストコード)

**役割**: ユニット・統合・E2E テストの全コードを配置する

```
tests/
├── unit/
│   ├── agents/
│   │   ├── summarizers/
│   │   │   └── test_scoring_engine.py
│   │   ├── verifiers/
│   │   │   ├── test_url_checker.py
│   │   │   ├── test_similarity_checker.py
│   │   │   └── test_geo_checker.py
│   │   └── trackers/
│   │       └── test_hmac_verifier.py
│   └── pipeline/
│       └── test_license_validator.py
├── integration/
│   ├── test_collect_summarize_pipeline.py  # 収集→要約パイプライン
│   ├── test_draft_verify_pipeline.py       # 生成→検証パイプライン
│   └── test_approval_server.py             # 承認サーバー TestClient
└── e2e/
    ├── test_short_url_worker.py             # Workers ローカル実行テスト
    └── test_publish_devto_draft.py          # dev.to draft モードで投稿確認
```

**命名規則**:
- ファイル名: `test_{対象モジュール名}.py`（pytest 自動検出に準拠）
- テスト関数: `test_{テスト内容}_{期待結果}()`

**テスト配置規則**:
- `tests/unit/` 以下はソースディレクトリ構造を鏡像にする
- 統合テストは機能シナリオ単位でフラットに配置
- E2E テストは外部サービスモック（`wrangler dev`, dev.to sandbox）を使用

---

### .github/workflows/ (CI/CD)

```
.github/
└── workflows/
    ├── collect.yml         # 毎時 cron: collect.sh を GitHub Actions で実行
    ├── ci.yml              # push/PR: ruff lint + pytest
    └── license_check.yml   # 商品ビルド時: license_validator.py を実行
```

**collect.yml のスケジュール**:
```yaml
on:
  schedule:
    - cron: '0 * * * *'   # 毎時 0 分 (UTC)
  workflow_dispatch:        # 手動実行も可能
```

---

### .steering/ (作業単位ドキュメント)

**役割**: 特定の開発作業における「今回何をするか」を定義するファイル群

```
.steering/
└── YYYYMMDD-task-name/    # 例: 20260527-add-reddit-collector
    ├── requirements.md    # 今回の要求内容
    ├── design.md          # 変更内容の設計
    └── tasklist.md        # タスクリスト（チェックボックス）
```

**命名規則**: `YYYYMMDD-kebab-case-task-name` 形式
**注意**: `.gitignore` には追加しない（作業履歴として保持）

---

### .devcontainer/ (開発環境)

```
.devcontainer/
├── devcontainer.json      # VS Code Dev Containers 設定
└── post-create.sh         # コンテナ作成後の初期セットアップ
```

---

## ファイル配置規則

### ソースファイル

| ファイル種別 | 配置先 | 命名規則 | 例 |
|------------|--------|---------|-----|
| コレクタークラス | `agents/collectors/` | `snake_case.py` | `hacker_news.py` |
| エージェント起動スクリプト | `agents/` | `snake_case.py` / `.sh` | `summarize.py`, `collect.sh` |
| FastAPI ルーター | `approval/routers/` | `snake_case.py`（複数形） | `drafts.py` |
| Workers ハンドラー | `workers/{name}/src/` | `camelCase.ts` | `gumroad.ts` |
| Blender スクリプト | `pipeline/blender_scripts/` | `snake_case.py` | `lod_generator.py` |
| 共通モジュール | `agents/shared/` | `snake_case.py` | `database.py` |
| 型定義（dataclass） | `agents/shared/models.py` | 単一ファイルに集約 | `models.py` |
| 定数・設定 | `agents/shared/` | `snake_case.py` | `exit_codes.py`, `config.py` |
| Astro 記事 | `blog/src/content/posts/` | `YYYY-MM-DD-slug.md` | `2026-05-27-deck-gl-plateau.md` |

### テストファイル

| テスト種別 | 配置先 | 命名規則 | 例 |
|-----------|--------|---------|-----|
| ユニットテスト | `tests/unit/{module}/` | `test_{対象}.py` | `test_scoring_engine.py` |
| 統合テスト | `tests/integration/` | `test_{シナリオ}.py` | `test_collect_summarize_pipeline.py` |
| E2E テスト | `tests/e2e/` | `test_{フロー}.py` | `test_short_url_worker.py` |

### 設定ファイル

| ファイル種別 | 配置先 | 例 |
|------------|--------|----|
| Python パッケージ設定 | プロジェクトルート | `pyproject.toml` |
| Python 依存ロック | プロジェクトルート | `uv.lock` |
| Workers 設定 | `workers/{name}/` | `wrangler.toml` |
| npm 依存 | `workers/{name}/` | `package.json` |
| GitHub Actions | `.github/workflows/` | `collect.yml` |
| Dev Container | `.devcontainer/` | `devcontainer.json` |
| ライセンスマトリクス | `data/` | `license_matrix.csv` |

---

## 命名規則

### ディレクトリ名

- **コンポーネントディレクトリ**: 複数形、`snake_case`
  - 例: `collectors/`, `summarizers/`, `publishers/`
- **機能ディレクトリ（Workers）**: `kebab-case`
  - 例: `short-url/`, `webhook/`
- **作業ディレクトリ（.steering）**: `YYYYMMDD-kebab-case`
  - 例: `20260601-add-sketchfab-uploader/`

### ファイル名

- **Python スクリプト・モジュール**: `snake_case.py`
  - 例: `draft_generator.py`, `scoring_engine.py`
- **TypeScript Workers**: `camelCase.ts`
  - 例: `gumroad.ts`, `hmac.ts`
- **Astro コンポーネント**: `PascalCase.astro`
  - 例: `PostLayout.astro`
- **Astro 記事**: `YYYY-MM-DD-slug.md`
  - 例: `2026-05-27-plateau-deck-gl-tutorial.md`
- **設定ファイル**: ツール標準の命名に従う
  - 例: `pyproject.toml`, `wrangler.toml`, `astro.config.mjs`

### Python クラス・関数

| 種別 | 規則 | 例 |
|------|------|-----|
| クラス名 | `PascalCase` + 役割接尾辞 | `HackerNewsCollector`, `ScoringEngine` |
| 関数名 | `snake_case`、動詞で始める | `collect_items()`, `calculate_score()` |
| 定数名 | `UPPER_SNAKE_CASE` | `EXIT_CODE_API_ERROR = 2` |
| dataclass フィールド | `snake_case` | `scored_at`, `total_score` |

---

## 依存関係のルール

### エージェントレイヤー間の依存

```
agents/shared/              ← 全モジュールが依存可能（基盤）
    ↑
agents/collectors/          ← shared のみに依存
agents/summarizers/         ← shared のみに依存
agents/generators/          ← shared のみに依存
agents/verifiers/           ← shared のみに依存
agents/publishers/          ← shared のみに依存
agents/trackers/            ← shared のみに依存
agents/reporters/           ← shared のみに依存

approval/                   ← agents/shared のみに依存（DB アクセスのみ）
pipeline/                   ← agents/shared のみに依存（DB + config 参照）
```

**禁止される依存**:
- `collectors/` → `generators/`（収集レイヤーが AI 処理レイヤーに依存することは禁止）
- `publishers/` → `collectors/`（配信レイヤーが収集レイヤーに依存することは禁止）
- `workers/` → `agents/`（実行環境が異なるため物理的に不可能）
- `approval/` → `agents/generators/`（承認 UI がビジネスロジックを持つことは禁止）

### モジュール間の循環依存の回避

共通型定義はすべて `agents/shared/models.py` に集約する。
各モジュールは `agents/shared/models.py` からインポートし、
モジュール間で直接インポートしない。

```python
# ✅ 良い例
from agents.shared.models import Draft, ScoredItem

# ❌ 悪い例（循環依存の原因）
from agents.generators.draft_generator import Draft
```

---

## スケーリング戦略

### 新コレクターの追加

`BaseCollector` を継承するクラスを `agents/collectors/` に追加するだけで対応可能。
`collect.sh` が `collectors/*.py` を自動検出して実行する。

```
# 追加例: YouTube Data API コレクター
agents/collectors/youtube.py  ← YoutubeCollector を追加するだけ
```

### 新販売プラットフォームへの対応

1. `workers/webhook/src/` に `{platform}.ts` を追加
2. `agents/trackers/webhook_processor.py` にプラットフォーム固有の処理を追加
3. `data/license_matrix.csv` にライセンス情報を追加

### ファイルサイズの管理

- 1ファイル 300行以下を推奨
- `agents/shared/models.py` が 300行を超えたら `models/` サブディレクトリに分割
- 起動スクリプト（`summarize.py` 等）は 100行以下に抑え、処理はサブモジュールへ委譲

### SQLite → D1 移行時の対応

商品数 50点・売上 1,000件を超えた段階で移行。
`agents/shared/database.py` の接続設定のみ変更し、SQL クエリは互換性を維持。

---

## 除外設定

### .gitignore

```gitignore
# データ
data/geo_autonome.db
data/geo_autonome.db-wal
data/geo_autonome.db-shm

# 3D アセット生成物（R2 で管理）
pipeline/output/

# Python
__pycache__/
*.pyc
.venv/
.uv/

# Node.js
node_modules/
dist/
.wrangler/

# Astro ビルド
blog/dist/
blog/.astro/

# シークレット・環境設定
.env
.env.local
*.key

# OS
.DS_Store
Thumbs.db

# ログ
*.log
logs/
```

### .dockerignore

```dockerignore
.git/
.steering/
docs/
tests/
*.md
data/geo_autonome.db
pipeline/output/
blog/dist/
node_modules/
__pycache__/
```

---

## ドキュメント配置

### プロジェクトルート

- `README.md`: セットアップ手順・システム概要

### docs/ (永続的ドキュメント)

| ファイル | 内容 |
|---------|------|
| `product-requirements.md` | プロダクト要求定義書 (PRD) |
| `functional-design.md` | 機能設計書 |
| `architecture.md` | 技術仕様書 |
| `repository-structure.md` | 本ドキュメント |
| `development-guidelines.md` | 開発ガイドライン |
| `glossary.md` | ユビキタス言語・用語集 |

### docs/ideas/ (アイデア・壁打ちメモ)

| ファイル | 内容 |
|---------|------|
| `initial-requirements.md` | プロジェクト初期アイデアメモ |

### .steering/ (作業単位ドキュメント)

作業ごとに `YYYYMMDD-task-name/` ディレクトリを作成し、
`requirements.md`, `design.md`, `tasklist.md` の 3 ファイルを配置する。

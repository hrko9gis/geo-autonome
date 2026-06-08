# 開発ガイドライン (Development Guidelines)

## コーディング規約

### 共通原則

1. **読みやすさを優先**: 省略より明瞭さを選ぶ。関数名・変数名は役割が一目でわかる形にする
2. **エラーを無視しない**: 例外は握りつぶさず、適切なログ出力と終了コードで上位へ伝播させる
3. **マジックナンバー禁止**: 数値リテラルは定数に抽出し、`agents/shared/config.py` または `exit_codes.py` に集約する
4. **シークレットをコードに書かない**: API キー・トークンは `pass` / 1Password CLI 経由で取得し、`.env` 直書き・コードハードコードを禁止する

---

### Python コーディング規約

#### 命名規則

```python
# 変数・関数: snake_case、動詞で始める（関数）、名詞（変数）
user_count = 42
scored_items = []

def collect_items() -> list[Item]: ...
def calculate_total_score(relevance: float, novelty: float) -> float: ...

# Boolean: is_, has_, should_ で始める
is_processed = True
has_short_url = False
should_retry = True

# クラス: PascalCase + 役割を示す接尾辞
class HackerNewsCollector: ...
class ScoringEngine: ...
class FactVerifier: ...

# 定数: UPPER_SNAKE_CASE、agents/shared/config.py または exit_codes.py に集約
MAX_RETRY_COUNT = 3
EXIT_CODE_API_ERROR = 2
SCORING_RELEVANCE_WEIGHT = 0.40
```

#### 型ヒント（必須）

Python 3.12 の組み込み型と `dataclasses` を積極的に使用する。

```python
# ✅ 良い例: 型ヒントを必ず記載
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class ScoredItem:
    id: str
    item_id: str
    summary_en: str
    relevance_score: float   # 0-100
    novelty_score: float     # 0-100
    potential_score: float   # 0-100
    total_score: float       # 加重平均スコア
    scored_at: datetime
    selected: bool = False

def calculate_total_score(
    relevance: float,
    novelty: float,
    potential: float,
) -> float:
    return (
        relevance * SCORING_RELEVANCE_WEIGHT
        + novelty * SCORING_NOVELTY_WEIGHT
        + potential * SCORING_POTENTIAL_WEIGHT
    )

# ❌ 悪い例: 型なし
def calc(r, n, p):
    return r * 0.4 + n * 0.35 + p * 0.25
```

#### 関数設計

- **目標**: 20〜30行以内、単一責務
- **パラメータが 4個以上** になる場合は `dataclass` にまとめる
- **副作用（DB 書き込み・API 呼び出し）** はビジネスロジックと分離する

```python
# ✅ 良い例: 責務の分離
class DraftGenerator:
    def generate(self, scored_item: ScoredItem) -> Draft:
        prompt = self._build_prompt(scored_item)
        content = self._call_api(prompt)
        return self._parse_response(content, scored_item)

    def _build_prompt(self, item: ScoredItem) -> str: ...
    def _call_api(self, prompt: str) -> str: ...
    def _parse_response(self, content: str, item: ScoredItem) -> Draft: ...

# ❌ 悪い例: 全処理が 1関数に混在
def generate_draft(scored_item):
    # プロンプト構築、API呼び出し、パース、DB保存、通知まで全部ここに...
```

#### エラーハンドリング

終了コード体系（`agents/shared/exit_codes.py`）に準拠したカスタム例外を使用する。

```python
# agents/shared/exceptions.py
class GeoAutonomeError(Exception):
    """基底例外クラス"""
    exit_code: int = 1

class ExternalApiError(GeoAutonomeError):
    """外部 API エラー (exit code 2)"""
    exit_code = 2

class AuthError(GeoAutonomeError):
    """認証・権限エラー (exit code 3)"""
    exit_code = 3

class DataFileError(GeoAutonomeError):
    """データファイルエラー (exit code 4)"""
    exit_code = 4

class PipelineError(GeoAutonomeError):
    """3D パイプラインエラー (exit code 5)"""
    exit_code = 5

class VerificationError(GeoAutonomeError):
    """検証ゲートエラー (exit code 6)"""
    exit_code = 6
```

```python
# ✅ 良い例: 具体的なエラークラス + ログ + 終了コード
import sys
from agents.shared.logger import get_logger

logger = get_logger(__name__)

def main() -> None:
    try:
        run_summarizer()
    except ExternalApiError as e:
        logger.error("API呼び出し失敗", error=str(e))
        sys.exit(e.exit_code)
    except GeoAutonomeError as e:
        logger.error("エージェントエラー", error=str(e))
        sys.exit(e.exit_code)
    except Exception as e:
        logger.exception("予期しないエラー", error=str(e))
        sys.exit(1)

# ❌ 悪い例: エラーを握りつぶす
try:
    run_summarizer()
except Exception:
    pass
```

#### 非同期処理

複数 API を並列呼び出しする場合は `asyncio` を使用する。

```python
# ✅ 良い例: asyncio で並列処理
import asyncio
import httpx

async def check_urls(urls: list[str]) -> list[bool]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        tasks = [_check_url(client, url) for url in urls]
        return await asyncio.gather(*tasks, return_exceptions=True)

async def _check_url(client: httpx.AsyncClient, url: str) -> bool:
    try:
        resp = await client.head(url)
        return resp.status_code == 200
    except httpx.RequestError:
        return False

# Haiku 4.5 への並列バッチ呼び出し
async def summarize_batch(items: list[Item]) -> list[ScoredItem]:
    tasks = [summarize_one(item) for item in items]
    return await asyncio.gather(*tasks)
```

#### コメント規約

CLAUDE.md の原則に従い、**コメントはデフォルトで書かない**。
「なぜ」が非自明な箇所のみに 1 行コメントを追加する。

```python
# ✅ 良い例: 制約・回避策・非自明な理由を説明
# Haiku 4.5 は 8,192 TPM 制限のため 1バッチ最大50件に制限
HAIKU_BATCH_LIMIT = 50

# ODbL Share-Alike のため OSM 派生データは商用販売対象外
if "osm" in product_sources:
    raise LicenseViolationError("OSM-derived data cannot be sold commercially")

# ❌ 悪い例: コードを読めば分かることを説明
# items リストの長さを取得する
count = len(items)
```

---

### TypeScript（Cloudflare Workers）コーディング規約

#### 命名規則

```typescript
// 変数・関数: camelCase
const shortCode = generateCode();
async function handleGumroadWebhook(request: Request): Promise<Response> { }

// 定数: UPPER_SNAKE_CASE
const CLICK_COUNTER_PREFIX = "click:";
const HMAC_ALGORITHM = "SHA-256";

// 型・インターフェース: PascalCase
interface SaleEvent {
  productId: string;
  amountUsd: number;
  soldAt: string;  // ISO 8601
}
```

#### 型定義（必須）

```typescript
// ✅ 良い例: Env 型で KV/R2 バインディングを明示
export interface Env {
  CLICK_COUNTER: KVNamespace;
  WEBHOOK_QUEUE: KVNamespace;
  GUMROAD_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/r/")) {
      return handleRedirect(request, env);
    }
    return new Response("Not Found", { status: 404 });
  },
};
```

#### エラーハンドリング

```typescript
// ✅ 良い例: 予期されるエラーは 4xx、予期しないエラーは 500
async function handleWebhook(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.arrayBuffer();
    const signature = request.headers.get("X-Gumroad-Signature") ?? "";

    if (!(await verifyHmac(body, signature, env.GUMROAD_SECRET))) {
      return new Response("Unauthorized", { status: 401 });
    }

    await env.WEBHOOK_QUEUE.put(`sale:${Date.now()}`, body);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
```

---

### コードフォーマット

| 言語 | ツール | 設定 |
|------|--------|------|
| Python | ruff format + ruff check | `pyproject.toml` |
| TypeScript | Prettier | `workers/{name}/.prettierrc` |

**Python ruff 設定**（`pyproject.toml`）:
```toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM"]
ignore = ["E501"]  # line-length は formatter に任せる

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

---

## セキュリティ規約

### シークレット管理（必須ルール）

```python
# ✅ 良い例: pass または 1Password CLI 経由で取得
import subprocess

def get_secret(key: str) -> str:
    result = subprocess.run(
        ["pass", f"geo-autonome/{key}"],
        capture_output=True, text=True, check=True
    )
    return result.stdout.strip()

ANTHROPIC_API_KEY = get_secret("anthropic_api_key")

# または環境変数（GitHub Actions Secrets 経由）
import os
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

# ❌ 絶対禁止
ANTHROPIC_API_KEY = "sk-ant-..."  # ハードコード
```

### Webhook 署名検証（必須）

Gumroad / Sketchfab からの Webhook は HMAC 署名を必ず検証する。
未検証のまま売上を記録することを禁止する。

```python
# agents/trackers/hmac_verifier.py
import hmac
import hashlib

def verify_gumroad_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode("utf-8"), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

### SQL インジェクション対策

SQLite クエリは必ずパラメータバインディングを使用する。

```python
# ✅ 良い例: パラメータバインディング
cursor.execute(
    "SELECT * FROM items WHERE source = ? AND collected_at > ?",
    (source, since)
)

# ❌ 悪い例: 文字列フォーマット（SQLインジェクション脆弱性）
cursor.execute(f"SELECT * FROM items WHERE source = '{source}'")
```

---

## Git 運用ルール

### ブランチ戦略（個人開発簡略版）

```
main ─────────────────────── (本番・安定版)
  └── feature/add-reddit-collector
  └── fix/scoring-edge-case
  └── refactor/database-layer
```

**運用ルール**:
- `main` へは直接コミットしない（原則 PR 経由）
- フィーチャーブランチ: `feature/kebab-case-description`
- バグ修正: `fix/kebab-case-description`
- リファクタリング: `refactor/kebab-case-description`
- 緊急修正（本番障害）: `hotfix/kebab-case-description`（main から分岐）

### コミットメッセージ規約（Conventional Commits）

```
<type>(<scope>): <subject>

<body>（任意）

<footer>（任意）
```

**Type 一覧**:

| Type | 用途 | 例 |
|------|------|-----|
| `feat` | 新機能 | `feat(collector): Reddit コレクター追加` |
| `fix` | バグ修正 | `fix(scoring): 類似度計算の除算ゼロ対応` |
| `docs` | ドキュメント | `docs: functional-design.md 更新` |
| `refactor` | リファクタリング | `refactor(database): 接続管理をコンテキストマネージャに変更` |
| `test` | テスト追加・修正 | `test(scoring): ポテンシャルスコア境界値テスト追加` |
| `chore` | ビルド・依存関係 | `chore: anthropic SDK 0.52 → 0.53 更新` |
| `ci` | CI/CD 設定 | `ci: collect.yml に Healthchecks.io Ping 追加` |

**良いコミットメッセージ例**:
```
feat(collector): Hacker News コレクター実装

HN の /topstories エンドポイントから地理空間・3D・可視化関連の
キーワードにマッチした記事を1時間ごとに取得する。

- `HackerNewsCollector` クラスを `collectors/hacker_news.py` に追加
- キーワードフィルタリングロジックを実装（GEO_KEYWORDS 定数を使用）
- レート制限対応（10 req/sec 以下に制限）

Closes #12
```

### プルリクエスト テンプレート

```markdown
## 変更の種類
- [ ] 新機能 (feat)
- [ ] バグ修正 (fix)
- [ ] リファクタリング (refactor)
- [ ] ドキュメント (docs)
- [ ] その他 (chore/ci)

## 何を変更したか
[簡潔な説明]

## なぜ変更したか
[背景・理由]

## テスト
- [ ] ユニットテスト追加・更新
- [ ] 統合テストで動作確認
- [ ] 手動テスト実施（内容を記載）

## チェックリスト
- [ ] `ruff check .` / `ruff format --check .` が通る
- [ ] `pytest tests/` が通る
- [ ] シークレットがコードに含まれていない
- [ ] 終了コード体系に準拠している
```

---

## テスト戦略

### テストピラミッドと目標比率

```
       /\
      /E2E\       10% (Workers ローカル実行 + dev.to sandbox)
     /------\
    / 統合   \    20% (SQLite インメモリ + TestClient)
   /----------\
  / ユニット   \  70% (スコアリング・検証・ライセンス判定)
 /--------------\
```

### カバレッジ目標

| ディレクトリ | 目標カバレッジ |
|------------|-------------|
| `agents/summarizers/` | 90% 以上（スコアリングロジック） |
| `agents/verifiers/` | 85% 以上（事実検証ロジック） |
| `agents/trackers/` | 85% 以上（HMAC・売上処理） |
| `pipeline/license_validator.py` | 95% 以上（ライセンス判定） |
| `agents/collectors/` | 70% 以上（外部 API 依存） |
| `approval/` | 70% 以上（Web レイヤー） |

### テスト命名規則

```python
# パターン: test_{対象}_{条件}_{期待結果}
def test_calculate_total_score_equal_weights_returns_weighted_average(): ...
def test_verify_url_unreachable_returns_failure(): ...
def test_validate_license_osm_source_raises_license_violation(): ...
```

### テストの書き方（Given-When-Then）

```python
# tests/unit/agents/summarizers/test_scoring_engine.py
import pytest
from agents.summarizers.scoring_engine import ScoringEngine

class TestScoringEngineNoveltyScore:
    def test_identical_to_past_article_returns_zero(self):
        # Given: 過去記事と同一テキスト
        engine = ScoringEngine()
        past_texts = ["PLATEAU deck.gl tutorial Japan open data"]
        new_text = "PLATEAU deck.gl tutorial Japan open data"

        # When: 新規性スコアを計算
        score = engine.novelty_score(new_text, past_texts)

        # Then: 類似度 1.0 → 新規性スコア 0
        assert score == pytest.approx(0.0, abs=1.0)

    def test_completely_different_text_returns_high_score(self):
        # Given: 全く異なるトピック
        engine = ScoringEngine()
        past_texts = ["Python machine learning tutorial"]
        new_text = "Osaka PLATEAU 3D Unity game asset pack"

        # When
        score = engine.novelty_score(new_text, past_texts)

        # Then: 類似度が低い → 新規性スコア 70 以上
        assert score >= 70.0
```

### モックポリシー

| 依存先 | テスト種別 | モック方針 |
|--------|-----------|-----------|
| Anthropic API | ユニット・統合 | `pytest-mock` でモック（コスト・速度） |
| SQLite | ユニット | インメモリ DB (`:memory:`) |
| SQLite | 統合 | テスト用 DB ファイル（テスト後削除） |
| 外部 URL（疎通チェック） | ユニット | `httpx.MockTransport` でモック |
| Cloudflare Workers | E2E | `wrangler dev` のローカル実行 |
| dev.to API | E2E | `?draft=true` パラメータで実際に投稿 |

---

## 開発環境セットアップ

### 必要なツール

| ツール | バージョン | インストール方法 |
|--------|-----------|-----------------|
| Python | 3.12 以上 | Dev Container に含まれる |
| uv | 0.6 以上 | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node.js | 20 LTS 以上 | Dev Container に含まれる |
| Wrangler | 4.x | `npm install -g wrangler` |
| Tailscale | 最新 | OS 別インストーラー |
| pass | 2.x | `apt install pass` または `brew install pass` |
| Docker | 24 以上 | Docker Desktop |

### セットアップ手順

```bash
# 1. リポジトリのクローン
git clone <repo-url>
cd geo-autonome

# 2. Dev Container で起動（推奨）
# VS Code: Ctrl+Shift+P → "Dev Containers: Reopen in Container"

# 3. Python 依存関係のインストール
uv sync

# 4. Cloudflare Workers の依存関係
cd workers/short-url && npm install
cd ../webhook && npm install
cd ../..

# 5. シークレットの設定（pass 初期設定済み前提）
# Anthropic API キーを登録
pass insert geo-autonome/anthropic_api_key

# GitHub Actions Secrets の設定（リポジトリ Settings）
# - ANTHROPIC_API_KEY
# - HEALTHCHECKS_URL
# - CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET

# 6. SQLite DB の初期化
uv run python -c "from agents.shared.database import init_db; init_db()"

# 7. 動作確認
uv run python agents/collect.sh --dry-run
uv run pytest tests/unit/ -v
```

### ローカル開発時のコマンド

```bash
# リント・フォーマット
uv run ruff check .
uv run ruff format .

# テスト
uv run pytest tests/unit/ -v
uv run pytest tests/integration/ -v
uv run pytest --cov=agents --cov-report=term-missing

# 承認サーバー起動（ローカル確認用）
uv run uvicorn approval.main:app --host 0.0.0.0 --port 8080 --reload

# Workers ローカル実行
cd workers/short-url && npx wrangler dev
cd workers/webhook && npx wrangler dev

# 個別エージェント手動実行
uv run python agents/summarize.py
uv run python agents/draft.py
```

---

## CI/CD パイプライン

### GitHub Actions ワークフロー

#### ci.yml（push / PR 時）

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
        with:
          python-version: "3.12"
      - run: uv sync
      - run: uv run ruff check .
      - run: uv run ruff format --check .
      - run: uv run pytest tests/unit/ tests/integration/
             --cov=agents --cov-fail-under=75
      - run: uv run python pipeline/license_validator.py --check-all
```

#### collect.yml（1時間ごと cron）

```yaml
name: Collect
on:
  schedule:
    - cron: '0 * * * *'
  workflow_dispatch:
jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync
      - run: bash agents/collect.sh
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          R2_ENDPOINT: ${{ secrets.CLOUDFLARE_R2_ENDPOINT }}
      - name: Ping Healthchecks.io
        if: success()
        run: curl -fsS "${{ secrets.HEALTHCHECKS_URL }}"
```

---

## コードレビュー基準

### レビューチェックリスト

**機能性**:
- [ ] 終了コード体系（0〜6）に準拠しているか
- [ ] エッジケース（空リスト・API タイムアウト・DB ロック）が考慮されているか
- [ ] リトライロジックが `agents/shared/retry.py` を使用しているか

**セキュリティ**:
- [ ] シークレットがコード・ログに含まれていないか
- [ ] Webhook 署名検証が実装されているか
- [ ] SQL クエリがパラメータバインディングを使用しているか

**可読性**:
- [ ] 型ヒントが記載されているか
- [ ] 関数の長さが 50 行以内か
- [ ] マジックナンバーが定数に抽出されているか

**テスト**:
- [ ] ユニットテストが追加されているか
- [ ] Given-When-Then パターンに従っているか
- [ ] モックが過剰でなく、実際の DB / ロジックをテストしているか

### レビューコメントの書き方

```markdown
[必須] セキュリティ: HMAC 検証なしで売上を記録しています。
       `hmac_verifier.verify_gumroad_signature()` を追加してください。

[推奨] パフォーマンス: Haiku を 1件ずつ逐次呼び出しています。
       `asyncio.gather()` で並列化するとバッチ処理が高速になります。

[提案] 可読性: `calc_score()` より `calculate_relevance_score()` の方が
       役割が明確になりそうです。

[質問] `potential_score` が 0 になる条件を教えてください。
```

---

## 実装チェックリスト（タスク完了前に確認）

### コード品質
- [ ] 型ヒントが全関数・メソッドに記載されている
- [ ] マジックナンバーが定数に抽出されている
- [ ] 関数が単一責務を持ち、50 行以内に収まっている
- [ ] `ruff check .` と `ruff format --check .` がエラーなし

### セキュリティ
- [ ] シークレットがコード・ログ・コミットに含まれていない
- [ ] Webhook はすべて HMAC 署名検証済み
- [ ] SQL クエリはすべてパラメータバインディング

### エラーハンドリング
- [ ] 終了コード体系に準拠した例外クラスを使用している
- [ ] エラー時のスマホ通知が実装されている（重要オペレーションのみ）
- [ ] リトライロジックが `agents/shared/retry.py` を経由している

### テスト
- [ ] ユニットテストが追加・更新されている
- [ ] `pytest tests/` がすべてパスする
- [ ] ライセンス検証スクリプトがパスする

### ドキュメント
- [ ] `.steering/` の `tasklist.md` が更新されている
- [ ] 非自明なロジックにコメントがある（CLAUDE.md の原則に従い最小限）

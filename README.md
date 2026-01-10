# すっぽん一本

## プロジェクト概要
すっぽん一本は、審査員が投票する投票システムです。PC集計画面と審査員用携帯画面で構成されています。

## 📱 本番環境URL

- **本番URL**: https://suppon-ippon.pages.dev
- **最新デプロイ**: https://b6cef93a.suppon-ippon.pages.dev

### アクセス方法

**PC集計画面** (司会者用)
- https://suppon-ippon.pages.dev

**審査員画面** (携帯用)
- 審査員1: https://suppon-ippon.pages.dev/judge/1
- 審査員2: https://suppon-ippon.pages.dev/judge/2
- 審査員3: https://suppon-ippon.pages.dev/judge/3
- 審査員4: https://suppon-ippon.pages.dev/judge/4
- 審査員5: https://suppon-ippon.pages.dev/judge/5

## 🎮 機能

### PC集計画面
- リアルタイムで審査員の投票状況を表示
- 各審査員の投票数を色分け表示（🟡1票 / 🟠2票 / 🔴3票）
- 投票数が8票以上で「SUPPON!」バナー表示と音声再生
- 投票があると決定音が再生
- YO〜ボタンでYO音声再生
- リセットボタンで次のお題へ移行

### 審査員画面
- 1/2/3票ボタンで投票
- 一度投票すると再投票不可（リセットまで）
- 投票完了メッセージ表示
- YO〜ボタンでYO音声をPC集計画面に送信
- レスポンシブデザイン（携帯・タブレット対応）

## 🗄️ データアーキテクチャ

### Cloudflare D1 Database
- **データベース名**: suppon-ippon-production
- **テーブル**:
  - `sessions`: セッション管理（ラウンド、アクティブ状態）
  - `judges`: 審査員情報（5人）
  - `votes`: 投票データ（セッションID、審査員ID、投票数）
  - `yo_events`: YO〜イベント履歴

### データフロー
1. 審査員が投票ボタンをタップ
2. `/api/vote` APIに投票データを送信
3. D1データベースに投票数を保存
4. PC集計画面が200msごとにポーリング
5. 投票数の変化を検知して音声再生と画面更新

## 🛠️ 技術スタック

- **フレームワーク**: Hono (Edge Runtime)
- **デプロイ**: Cloudflare Pages
- **データベース**: Cloudflare D1 (SQLite)
- **フロントエンド**: Vanilla JavaScript + Tailwind CSS
- **音声**: HTML5 Audio API

## 🚀 デプロイ方法

### 1. ビルド
```bash
npm run build
```

### 2. 本番デプロイ
```bash
npx wrangler pages deploy dist --project-name suppon-ippon
```

### 3. データベースマイグレーション（初回のみ）
```bash
npx wrangler d1 migrations apply suppon-ippon-production
```

## 💻 ローカル開発

### 開発サーバー起動
```bash
npm run build
pm2 start ecosystem.config.cjs
```

### ローカルデータベース
```bash
# マイグレーション適用
npm run db:migrate:local

# データベースリセット
npm run db:reset
```

## 📊 投票システム仕様

- **審査員数**: 5人
- **各審査員の最大投票数**: 3票
- **全体の最大投票数**: 15票
- **SUPPON判定**: 8票以上
- **投票制限**: 一度投票すると再投票不可（リセットまで）

## 🎵 音声ファイル

- `ippon.m4a`: SUPPON!音声
- `yo-sound.m4a`: YO〜音声
- `vote-sound.mp3`: 投票時の決定音

## 📦 プロジェクト構造

```
webapp/
├── src/
│   └── index.tsx          # Honoバックエンド
├── public/
│   ├── index.html         # PC集計画面
│   ├── pc.js              # PC集計画面ロジック
│   ├── judge.html         # 審査員画面
│   ├── judge.js           # 審査員画面ロジック
│   ├── suppon-logo.png    # ロゴ
│   └── *.mp3, *.m4a       # 音声ファイル
├── migrations/            # D1マイグレーション
├── wrangler.jsonc         # Cloudflare設定
└── package.json
```

## 🔄 リセット機能

PC集計画面の「次のお題へリセット」ボタンをクリックすると:
- 新しいセッションが作成される
- すべての審査員の投票数が0にリセットされる
- 審査員画面のボタンが再度有効化される（3秒以内）

## 🌐 GitHub

- **リポジトリ**: https://github.com/kkkkk-01/https-suppon-ippon.pages.dev-

## 📝 最終更新

- **日付**: 2026-01-10
- **デプロイ状態**: ✅ Active
- **最新バージョン**: b6cef93a

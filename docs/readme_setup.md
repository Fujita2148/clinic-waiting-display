# 📺 待合室表示システム v2.0

メンタルクリニック向け待合室表示システム（40型モニタ最適化）

## 🎯 システム概要

- **表示画面**: 患者向け大画面表示（index.html）
- **操作画面**: スタッフ向け管理画面（control.html）
- **対象モニタ**: 40型前後（16:9）、視聴距離3-5m
- **主な機能**: メンタルヘルスTIPS表示、診察順案内、メッセージ表示

## 📁 ファイル構成

```
mental-display/
├── index.html              # 📺 患者向け表示画面
├── control.html            # 🎛️ スタッフ操作画面
├── .htaccess               # 🔒 Basic認証設定
├── .htpasswd               # 🔑 認証ファイル（要作成）
│
├── css/
│   └── style.css           # 🎨 40型モニタ最適化CSS
│
├── js/
│   ├── common.js           # 🔧 共通JavaScript
│   └── display.js          # 📱 表示制御ロジック
│
├── php/
│   ├── get_files.php       # 📂 ファイル一覧取得API
│   ├── save_settings.php   # ⚙️ 設定保存API
│   ├── save_message.php    # 💬 メッセージ保存API
│   └── save_status.php     # 🏥 診察順保存API
│
├── data/
│   ├── contents/           # 📄 コンテンツフォルダ
│   │   └── mental_tips.json     # 🧠 メンタルヘルスTIPS
│   ├── settings.json       # ⚙️ システム設定
│   ├── message.json        # 💬 メッセージ設定
│   └── status.json         # 🏥 診察順設定
│
├── assets/
│   ├── background.mp4      # 🎬 背景動画（オプション）
│   └── demo_bg.jpg         # 🖼️ デモ用背景
│
└── README.md               # 📖 このファイル
```

## 🚀 セットアップ手順

### 1. ファイルアップロード

さくらのレンタルサーバの公開フォルダに全ファイルをアップロード

```bash
# FTPまたはファイルマネージャーで以下をアップロード
mental-display/ 内の全ファイル
```

### 2. Basic認証設定

#### .htpasswd ファイルの作成

```bash
# コマンドライン（SSH接続時）
htpasswd -c /home/username/.htpasswd admin

# または、オンラインツールで生成
# https://www.web2generators.com/apache-tools/htpasswd-generator
```

#### .htaccess の設定確認

```apache
# .htaccess 内のパスを環境に合わせて修正
AuthUserFile /home/username/.htpasswd
```

### 3. ディレクトリ権限設定

```bash
# 書き込み権限の設定
chmod 755 data/
chmod 666 data/*.json
chmod 755 php/
```

### 4. 初期コンテンツの配置

```bash
# メンタルヘルスTIPSファイルを配置
data/contents/mental_tips.json
```

### 5. 動作確認

1. **表示画面**: `https://yourdomain.com/mental-display/`
2. **操作画面**: `https://yourdomain.com/mental-display/control.html`
   - Basic認証でログイン
   - 診察順、メッセージを設定してテスト

## 🎛️ 基本操作

### 診察順の設定

1. control.html にアクセス
2. 「診察順番のご案内」で番号を入力
3. 「表示」チェックボックスをON
4. 「診察順を更新」ボタンで保存

### メッセージの設定

1. 「メッセージ管理」でテキストを入力（200文字以内）
2. 「表示する/しない」を選択
3. 「メッセージを更新」ボタンで保存

### システム設定

- **表示切替間隔**: コンテンツの表示間隔（5-600秒）
- **メッセージ表示モード**: 
  - 常時表示: メッセージを常に表示
  - コンテンツ同期: コンテンツと交互に表示

## 📄 コンテンツファイルの管理

### 新しいコンテンツファイルの追加

1. `data/contents/` フォルダに JSONファイルを配置

```json
{
  "meta": {
    "title": "健康管理のポイント",
    "icon": "🌱",
    "displayMode": "random"
  },
  "items": [
    {
      "icon": "💧",
      "title": "ポイント1: 水分補給を心がけよう",
      "text": "1日1.5〜2リットルを目安に..."
    }
  ]
}
```

2. ファイルは自動的に検出され、システムで利用可能になります

### 表示モードの設定

- **random**: ランダム表示（重み付き）
- **order**: 順番表示（他のファイルと混在）
- **sequence**: 連続表示（最初から最後まで）

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 表示が更新されない

```bash
# 1. ファイル権限の確認
chmod 666 data/*.json

# 2. キャッシュのクリア
# ブラウザの強制更新（Ctrl+F5）

# 3. エラーログの確認
tail -f error_log
```

#### API エラーが発生する

```bash
# 1. PHP のエラーログを確認
# 2. ファイルパスの確認
# 3. JSON形式の検証
```

#### Basic認証でアクセスできない

```bash
# 1. .htpasswd ファイルのパス確認
# 2. ユーザー名・パスワードの再設定
htpasswd -c /home/username/.htpasswd admin

# 3. .htaccess のパス修正
```

### ログファイルの確認

```bash
# エラーログの場所（さくらサーバの場合）
~/www/logs/error_log

# 最新のエラーを確認
tail -20 ~/www/logs/error_log
```

## 📱 システム要件

### サーバー要件

- **PHP**: 7.4以上
- **ウェブサーバー**: Apache（.htaccess対応）
- **ディスク容量**: 50MB以上
- **メモリ**: 256MB以上

### クライアント要件

#### 表示端末（患者向け）
- **ブラウザ**: Chrome 90+, Edge 90+
- **解像度**: 1920x1080推奨
- **画面サイズ**: 40型前後
- **接続**: 院内LAN

#### 操作端末（スタッフ向け）
- **ブラウザ**: Chrome, Edge, Safari, Firefox最新版
- **デバイス**: PC、タブレット
- **解像度**: 1024x768以上

## 🔒 セキュリティ

### Basic認証の設定

- control.html へのアクセス制限
- PHP API へのアクセス制限
- データファイルへの直接アクセス禁止

### データ保護

```apache
# .htaccess でデータディレクトリを保護
<DirectoryMatch "^.*/data/">
    Order Deny,Allow
    Deny from all
</DirectoryMatch>
```

## 📈 パフォーマンス最適化

### 推奨設定

```apache
# .htaccess で圧縮を有効化
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE application/json
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/javascript
</IfModule>
```

### モニタリング

- 定期的なエラーログ確認
- ディスク使用量の監視
- メモリ使用量の確認

## 🆕 バージョンアップ

### 安全なアップデート手順

1. **バックアップ**: 現在のファイルをバックアップ
2. **テスト環境**: 別ディレクトリでテスト
3. **段階的適用**: ファイルを順次更新
4. **動作確認**: 全機能のテスト

### バックアップ対象

```bash
# 重要ファイル
data/settings.json
data/message.json
data/status.json
data/contents/
.htpasswd
```

## 📞 サポート

### 設定に関するお問い合わせ

- システム設定の調整
- 新機能の追加
- カスタマイズ要望

### 緊急時の対応

1. **表示システム停止**: index.html を一時的に差し替え
2. **操作画面アクセス不可**: .htaccess の一時無効化
3. **データ破損**: バックアップからの復旧

---

## 📋 チェックリスト

### 初期セットアップ

- [ ] ファイルアップロード完了
- [ ] Basic認証設定完了
- [ ] ディレクトリ権限設定完了
- [ ] コンテンツファイル配置完了
- [ ] 表示画面の動作確認
- [ ] 操作画面の動作確認
- [ ] 診察順表示のテスト
- [ ] メッセージ表示のテスト

### 運用開始前

- [ ] 40型モニタでの表示確認
- [ ] 3-5m距離での視認性確認
- [ ] スタッフ操作研修完了
- [ ] 緊急時対応手順の共有
- [ ] バックアップ体制の確立

### 定期メンテナンス

- [ ] 月1回: エラーログ確認
- [ ] 月1回: ディスク容量確認
- [ ] 週1回: コンテンツ更新
- [ ] 四半期: バックアップ確認

---

**🎉 セットアップ完了後は、快適な待合室環境をお楽しみください！**
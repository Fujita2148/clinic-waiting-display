# 待合室表示システム 使用説明書

## 概要
クリニック待合室向けに、背景動画＋TIPS／メッセージ／診察順を表示するWebアプリです。
index.html を全画面表示、control.html で操作を行います。

## 初期セットアップ
1. リポジトリをクローン：
   git clone https://github.com/yourname/clinic-waiting-display.git
2. サーバにアップロード（さくらのレンタルサーバ推奨）。
3. `.htaccess` と `.htpasswd` を設定し、control.html へのBasic認証を有効化。

## 操作手順
- control.html で「切替間隔」「表示継続時間」を設定し「保存」。
- 「差し込みメッセージ」に入力し「保存」。
- 「診察順表示」でラベル・番号の編集とON/OFF切替。

## Tips編集
- data/tips.json をテキストエディタで編集。アイコン／タイトル／本文を追加・削除してください。

## 障害対応
- JSON読み込みエラー時はファイルの整合性を確認。
- PHP書き込み失敗時はファイルパーミッション（chmod）を 664 以上に設定。

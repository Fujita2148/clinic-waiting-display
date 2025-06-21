<?php
/**
 * メッセージ保存API
 * message.json を更新する
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

// POSTメソッドのみ許可
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'status' => 'error',
        'message' => 'POSTメソッドのみ許可されています'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// エラーレポートを制御
error_reporting(E_ALL);
ini_set('display_errors', 0);

try {
    // リクエストデータを取得
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if ($data === null) {
        throw new Exception('無効なJSONデータです');
    }
    
    // 必須フィールドの確認
    if (!isset($data['text'])) {
        throw new Exception('メッセージテキストが指定されていません');
    }
    
    // データの検証とサニタイズ
    $text = strip_tags(trim($data['text']));
    $visible = isset($data['visible']) ? (bool)$data['visible'] : true;
    
    // 文字数制限
    if (mb_strlen($text) > 200) {
        throw new Exception('メッセージは200文字以内で入力してください');
    }
    
    // 保存するデータ
    $messageData = [
        'text' => $text,
        'visible' => $visible,
        'lastUpdated' => date('Y-m-d H:i:s'),
        'updatedBy' => getClientInfo()
    ];
    
    // ファイルパス
    $messageFile = __DIR__ . '/../data/message.json';
    $dataDir = dirname($messageFile);
    
    // dataディレクトリが存在しない場合は作成
    if (!is_dir($dataDir)) {
        if (!mkdir($dataDir, 0755, true)) {
            throw new Exception('データディレクトリの作成に失敗しました');
        }
    }
    
    // JSONファイルに保存
    $jsonContent = json_encode($messageData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($jsonContent === false) {
        throw new Exception('JSON エンコードに失敗しました');
    }
    
    $result = file_put_contents($messageFile, $jsonContent, LOCK_EX);
    if ($result === false) {
        throw new Exception('メッセージファイルの保存に失敗しました');
    }
    
    // 成功レスポンス
    $response = [
        'status' => 'success',
        'message' => 'メッセージを保存しました',
        'data' => [
            'text' => $text,
            'visible' => $visible,
            'length' => mb_strlen($text)
        ],
        'savedSize' => $result,
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    // エラーレスポンス
    http_response_code(400);
    
    $errorResponse = [
        'status' => 'error',
        'message' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    echo json_encode($errorResponse, JSON_UNESCAPED_UNICODE);
    
    // エラーログに記録
    error_log('save_message.php error: ' . $e->getMessage());
}

/**
 * クライアント情報を取得
 * @return array クライアント情報
 */
function getClientInfo() {
    return [
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'timestamp' => date('Y-m-d H:i:s')
    ];
}

/**
 * HTMLタグを除去してテキストのみ抽出
 * @param string $text 入力テキスト
 * @return string サニタイズされたテキスト
 */
function sanitizeText($text) {
    // HTMLタグを除去
    $text = strip_tags($text);
    
    // 前後の空白を除去
    $text = trim($text);
    
    // 連続する空白を単一スペースに変換
    $text = preg_replace('/\s+/', ' ', $text);
    
    // 特殊文字をエスケープ
    $text = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    
    return $text;
}

/**
 * メッセージの履歴を保存（オプション機能）
 * @param array $messageData メッセージデータ
 */
function saveMessageHistory($messageData) {
    $historyFile = __DIR__ . '/../data/message_history.json';
    $history = [];
    
    // 既存履歴の読み込み
    if (file_exists($historyFile)) {
        $historyContent = file_get_contents($historyFile);
        if ($historyContent !== false) {
            $history = json_decode($historyContent, true) ?: [];
        }
    }
    
    // 新しいエントリを追加
    $history[] = [
        'text' => $messageData['text'],
        'visible' => $messageData['visible'],
        'timestamp' => $messageData['lastUpdated'],
        'client' => $messageData['updatedBy']
    ];
    
    // 履歴を最新10件に制限
    if (count($history) > 10) {
        $history = array_slice($history, -10);
    }
    
    // 履歴ファイルに保存
    $historyJson = json_encode($history, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($historyJson !== false) {
        file_put_contents($historyFile, $historyJson, LOCK_EX);
    }
}
?>
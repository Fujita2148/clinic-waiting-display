<?php
/**
 * ラベル履歴保存API
 * label_history.json を更新する
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

error_reporting(E_ALL);
ini_set('display_errors', 0);

try {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if ($data === null) {
        throw new Exception('無効なJSONデータです');
    }

    if (!isset($data['history']) || !is_array($data['history'])) {
        throw new Exception('履歴データが指定されていません');
    }

    // 履歴データの検証とサニタイズ
    $validatedHistory = [];
    foreach ($data['history'] as $label) {
        if (is_string($label)) {
            $cleanLabel = strip_tags(trim($label));
            if (!empty($cleanLabel) && mb_strlen($cleanLabel) <= 20) {
                $validatedHistory[] = $cleanLabel;
            }
        }
    }

    // 重複削除と件数制限
    $validatedHistory = array_unique($validatedHistory);
    $validatedHistory = array_slice($validatedHistory, 0, 10);

    // 保存するデータ
    $historyData = [
        'history' => array_values($validatedHistory),
        'lastUpdated' => date('Y-m-d H:i:s'),
        'count' => count($validatedHistory)
    ];

    $historyFile = __DIR__ . '/../data/label_history.json';
    $dataDir = dirname($historyFile);

    if (!is_dir($dataDir)) {
        if (!mkdir($dataDir, 0755, true)) {
            throw new Exception('データディレクトリの作成に失敗しました');
        }
    }

    $jsonContent = json_encode($historyData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($jsonContent === false) {
        throw new Exception('JSON エンコードに失敗しました');
    }

    $result = file_put_contents($historyFile, $jsonContent, LOCK_EX);
    if ($result === false) {
        throw new Exception('履歴ファイルの保存に失敗しました');
    }

    $response = [
        'status' => 'success',
        'message' => 'ラベル履歴を保存しました',
        'data' => [
            'count' => count($validatedHistory),
            'history' => $validatedHistory
        ],
        'timestamp' => date('Y-m-d H:i:s')
    ];

    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(400);

    $errorResponse = [
        'status' => 'error',
        'message' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ];

    echo json_encode($errorResponse, JSON_UNESCAPED_UNICODE);
    error_log('save_label_history.php error: ' . $e->getMessage());
}
?>

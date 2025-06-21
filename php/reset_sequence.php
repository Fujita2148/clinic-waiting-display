<?php
/**
 * 順番表示リセットAPI
 * 順番表示の進捗を最初に戻す
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
    // 順番表示の進捗ファイルをリセット
    $progressFile = __DIR__ . '/../data/sequential_progress.json';
    
    // 現在の進捗状況を読み込み（ログ用）
    $currentProgress = [];
    if (file_exists($progressFile)) {
        $progressContent = file_get_contents($progressFile);
        if ($progressContent !== false) {
            $currentProgress = json_decode($progressContent, true) ?: [];
        }
    }
    
    // 進捗をリセット
    $resetProgress = [];
    
    // 各ファイルの進捗を0にリセット
    foreach ($currentProgress as $filename => $data) {
        $resetProgress[$filename] = [
            'currentIndex' => 0,
            'lastReset' => date('Y-m-d H:i:s')
        ];
    }
    
    // リセット後の進捗を保存
    $newContent = json_encode($resetProgress, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $result = file_put_contents($progressFile, $newContent, LOCK_EX);
    
    if ($result === false) {
        throw new Exception('進捗ファイルの保存に失敗しました');
    }
    
    // 成功レスポンス
    $response = [
        'status' => 'success',
        'message' => '順番表示を最初にリセットしました',
        'data' => [
            'resetFiles' => array_keys($resetProgress),
            'resetCount' => count($resetProgress),
            'resetTime' => date('Y-m-d H:i:s')
        ],
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
    // ログに記録
    error_log('Sequential display reset: ' . count($resetProgress) . ' files reset to beginning');
    
} catch (Exception $e) {
    // エラーレスポンス
    http_response_code(500);
    
    $errorResponse = [
        'status' => 'error',
        'message' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    echo json_encode($errorResponse, JSON_UNESCAPED_UNICODE);
    
    // エラーログに記録
    error_log('reset_sequence.php error: ' . $e->getMessage());
}
?>
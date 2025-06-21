<?php
/**
 * 診察順保存API
 * status.json を更新する
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
    if (!isset($data['room1']) || !isset($data['room2'])) {
        throw new Exception('診察室情報が不完全です');
    }
    
    // データの検証とサニタイズ
    $statusData = [
        'room1' => validateRoomData($data['room1'], '第1診察室'),
        'room2' => validateRoomData($data['room2'], '第2診察室'),
        'lastUpdated' => date('Y-m-d H:i:s'),
        'updatedBy' => getClientInfo()
    ];
    
    // ファイルパス
    $statusFile = __DIR__ . '/../data/status.json';
    $dataDir = dirname($statusFile);
    
    // dataディレクトリが存在しない場合は作成
    if (!is_dir($dataDir)) {
        if (!mkdir($dataDir, 0755, true)) {
            throw new Exception('データディレクトリの作成に失敗しました');
        }
    }
    
    // JSONファイルに保存
    $jsonContent = json_encode($statusData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($jsonContent === false) {
        throw new Exception('JSON エンコードに失敗しました');
    }
    
    $result = file_put_contents($statusFile, $jsonContent, LOCK_EX);
    if ($result === false) {
        throw new Exception('診察順ファイルの保存に失敗しました');
    }
    
    // 成功レスポンス
    $response = [
        'status' => 'success',
        'message' => '診察順を保存しました',
        'data' => [
            'room1' => $statusData['room1'],
            'room2' => $statusData['room2']
        ],
        'savedSize' => $result,
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
    // 操作ログを記録
    logStatusUpdate($statusData);
    
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
    error_log('save_status.php error: ' . $e->getMessage());
}

/**
 * 診察室データの検証
 * @param array $roomData 診察室データ
 * @param string $defaultLabel デフォルトラベル
 * @return array 検証済み診察室データ
 * @throws Exception 検証エラー
 */
function validateRoomData($roomData, $defaultLabel) {
    if (!is_array($roomData)) {
        throw new Exception('診察室データは配列である必要があります');
    }
    
    $validated = [];
    
    // ラベルの検証
    $label = isset($roomData['label']) ? strip_tags(trim($roomData['label'])) : $defaultLabel;
    if (mb_strlen($label) > 20) {
        throw new Exception('診察室ラベルは20文字以内で設定してください');
    }
    if (empty($label)) {
        $label = $defaultLabel;
    }
    $validated['label'] = $label;
    
    // 番号の検証
    $number = isset($roomData['number']) ? (int)$roomData['number'] : 0;
    if ($number < 0 || $number > 999) {
        throw new Exception('診察順番号は0-999の範囲で設定してください');
    }
    $validated['number'] = $number;
    
    // 表示フラグの検証
    $validated['visible'] = isset($roomData['visible']) ? (bool)$roomData['visible'] : false;
    
    return $validated;
}

/**
 * クライアント情報を取得
 * @return array クライアント情報
 */
function getClientInfo() {
    return [
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ];
}

/**
 * 診察順更新のログを記録
 * @param array $statusData 診察順データ
 */
function logStatusUpdate($statusData) {
    $logFile = __DIR__ . '/../data/status_log.json';
    $logEntries = [];
    
    // 既存ログの読み込み
    if (file_exists($logFile)) {
        $logContent = file_get_contents($logFile);
        if ($logContent !== false) {
            $logEntries = json_decode($logContent, true) ?: [];
        }
    }
    
    // 新しいログエントリを追加
    $logEntry = [
        'timestamp' => date('Y-m-d H:i:s'),
        'room1' => [
            'label' => $statusData['room1']['label'],
            'number' => $statusData['room1']['number'],
            'visible' => $statusData['room1']['visible']
        ],
        'room2' => [
            'label' => $statusData['room2']['label'],
            'number' => $statusData['room2']['number'],
            'visible' => $statusData['room2']['visible']
        ],
        'client' => $statusData['updatedBy']
    ];
    
    $logEntries[] = $logEntry;
    
    // ログを最新50件に制限
    if (count($logEntries) > 50) {
        $logEntries = array_slice($logEntries, -50);
    }
    
    // ログファイルに保存
    $logJson = json_encode($logEntries, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($logJson !== false) {
        file_put_contents($logFile, $logJson, LOCK_EX);
    }
}

/**
 * 診察順の自動リセット機能（オプション）
 * 指定時間に自動的に番号をリセット
 */
function checkAutoReset() {
    $currentHour = (int)date('H');
    $resetHours = [8, 13, 18]; // リセット時刻（8時、13時、18時）
    
    if (in_array($currentHour, $resetHours)) {
        $lastResetFile = __DIR__ . '/../data/last_reset.txt';
        $today = date('Y-m-d');
        
        // 今日まだリセットしていない場合
        if (!file_exists($lastResetFile) || file_get_contents($lastResetFile) !== $today) {
            // 番号をリセット
            $resetData = [
                'room1' => ['label' => '第1診察室', 'number' => 0, 'visible' => false],
                'room2' => ['label' => '第2診察室', 'number' => 0, 'visible' => false],
                'lastUpdated' => date('Y-m-d H:i:s'),
                'updatedBy' => ['auto_reset' => true]
            ];
            
            $statusFile = __DIR__ . '/../data/status.json';
            $jsonContent = json_encode($resetData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            file_put_contents($statusFile, $jsonContent, LOCK_EX);
            
            // リセット日時を記録
            file_put_contents($lastResetFile, $today);
            
            error_log('診察順を自動リセットしました: ' . date('Y-m-d H:i:s'));
        }
    }
}

// 自動リセットチェック（オプション機能）
// checkAutoReset();
?>
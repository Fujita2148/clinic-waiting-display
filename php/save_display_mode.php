<?php
/**
 * 表示モード設定保存API
 * コンテンツファイルの表示モードを更新
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
    if (!isset($data['filename']) || !isset($data['displayMode'])) {
        throw new Exception('ファイル名と表示モードが必要です');
    }
    
    $filename = $data['filename'];
    $displayMode = $data['displayMode'];
    
    // 表示モードの検証
    $validModes = ['random', 'sequence', 'order'];
    if (!in_array($displayMode, $validModes)) {
        throw new Exception('無効な表示モードです');
    }
    
    // ファイル名の検証（セキュリティ）
    if (!preg_match('/^[a-zA-Z0-9_\-\.]+\.json$/', $filename)) {
        throw new Exception('無効なファイル名です');
    }
    
    // 設定ファイルの読み込み
    $settingsFile = __DIR__ . '/../data/settings.json';
    
    if (!file_exists($settingsFile)) {
        throw new Exception('設定ファイルが見つかりません');
    }
    
    $settingsContent = file_get_contents($settingsFile);
    if ($settingsContent === false) {
        throw new Exception('設定ファイルの読み込みに失敗しました');
    }
    
    $settings = json_decode($settingsContent, true);
    if ($settings === null) {
        throw new Exception('設定ファイルの解析に失敗しました');
    }
    
    // ファイル設定が存在しない場合は作成
    if (!isset($settings['files'])) {
        $settings['files'] = [];
    }
    
    if (!isset($settings['files'][$filename])) {
        $settings['files'][$filename] = [
            'enabled' => true,
            'duration' => 8,
            'weight' => 1,
            'displayName' => generateDisplayName($filename)
        ];
    }
    
    // 表示モードを更新
    $settings['files'][$filename]['displayMode'] = $displayMode;
    $settings['lastUpdated'] = date('Y-m-d H:i:s');
    
    // 順番表示に変更された場合、進捗をリセット
    if ($displayMode === 'sequence') {
        clearSequentialProgress($filename);
    }
    
    // 設定ファイルに保存
    $jsonContent = json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($jsonContent === false) {
        throw new Exception('JSON エンコードに失敗しました');
    }
    
    $result = file_put_contents($settingsFile, $jsonContent, LOCK_EX);
    if ($result === false) {
        throw new Exception('設定ファイルの保存に失敗しました');
    }
    
    // コンテンツファイルの表示モードも更新（オプション）
    updateContentFileDisplayMode($filename, $displayMode);
    
    // 成功レスポンス
    $response = [
        'status' => 'success',
        'message' => '表示モードを保存しました',
        'data' => [
            'filename' => $filename,
            'displayMode' => $displayMode,
            'displayModeText' => getDisplayModeText($displayMode)
        ],
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
    error_log('save_display_mode.php error: ' . $e->getMessage());
}

/**
 * ファイル名から表示名を生成
 * @param string $filename ファイル名
 * @return string 表示名
 */
function generateDisplayName($filename) {
    $name = str_replace('.json', '', $filename);
    $name = str_replace('_', ' ', $name);
    return ucwords($name);
}

/**
 * 表示モードの日本語テキストを取得
 * @param string $mode 表示モード
 * @return string 日本語テキスト
 */
function getDisplayModeText($mode) {
    switch ($mode) {
        case 'sequence':
            return '順番表示';
        case 'order':
            return '順番表示（混在）';
        case 'random':
        default:
            return 'ランダム表示';
    }
}

/**
 * 順番表示の進捗をクリア
 * @param string $filename ファイル名
 */
function clearSequentialProgress($filename) {
    $progressFile = __DIR__ . '/../data/sequential_progress.json';
    
    if (file_exists($progressFile)) {
        $progressContent = file_get_contents($progressFile);
        if ($progressContent !== false) {
            $progress = json_decode($progressContent, true);
            if ($progress && isset($progress[$filename])) {
                $progress[$filename] = ['currentIndex' => 0];
                
                $newContent = json_encode($progress, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
                file_put_contents($progressFile, $newContent, LOCK_EX);
            }
        }
    }
}

/**
 * コンテンツファイルの表示モードも更新（オプション）
 * @param string $filename ファイル名
 * @param string $displayMode 表示モード
 */
function updateContentFileDisplayMode($filename, $displayMode) {
    $contentFile = __DIR__ . "/../data/contents/{$filename}";
    
    if (file_exists($contentFile)) {
        try {
            $contentData = json_decode(file_get_contents($contentFile), true);
            
            if ($contentData && isset($contentData['meta'])) {
                $contentData['meta']['displayMode'] = $displayMode;
                $contentData['meta']['lastUpdated'] = date('Y-m-d H:i:s');
                
                $newContent = json_encode($contentData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
                file_put_contents($contentFile, $newContent, LOCK_EX);
            }
        } catch (Exception $e) {
            // コンテンツファイルの更新は失敗しても処理を継続
            error_log("Failed to update content file display mode: " . $e->getMessage());
        }
    }
}
?>
<?php
/**
 * 順番表示状態取得API
 * 順番表示の現在位置と進行状況を取得
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

// エラーレポートを制御
error_reporting(E_ALL);
ini_set('display_errors', 0);

try {
    // 順番表示ファイルの特定
    $sequentialFiles = getSequentialFiles();
    
    if (empty($sequentialFiles)) {
        // 順番表示ファイルがない場合
        $response = [
            'status' => 'success',
            'message' => '順番表示モードのファイルが見つかりません',
            'data' => [
                'hasSequentialFiles' => false,
                'currentPosition' => 1,
                'totalItems' => 0,
                'progress' => '0%'
            ]
        ];
        
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
    
    // 進捗ファイルの読み込み
    $progressFile = __DIR__ . '/../data/sequential_progress.json';
    $progress = [];
    
    if (file_exists($progressFile)) {
        $progressContent = file_get_contents($progressFile);
        if ($progressContent !== false) {
            $progress = json_decode($progressContent, true) ?: [];
        }
    }
    
    // メインの順番表示ファイル（通常は最初のファイル）
    $mainFile = $sequentialFiles[0];
    $filename = $mainFile['filename'];
    
    // 現在の進捗を取得
    $currentIndex = 0;
    if (isset($progress[$filename]) && isset($progress[$filename]['currentIndex'])) {
        $currentIndex = (int)$progress[$filename]['currentIndex'];
    }
    
    // コンテンツファイルの読み込み
    $contentFile = __DIR__ . "/../data/contents/{$filename}";
    $totalItems = 0;
    
    if (file_exists($contentFile)) {
        $contentData = json_decode(file_get_contents($contentFile), true);
        if ($contentData) {
            if (isset($contentData['items']) && is_array($contentData['items'])) {
                $totalItems = count($contentData['items']);
            } elseif (is_array($contentData)) {
                $totalItems = count($contentData);
            }
        }
    }
    
    // 現在位置の調整（1から始まる）
    $currentPosition = $currentIndex + 1;
    if ($currentPosition > $totalItems && $totalItems > 0) {
        $currentPosition = 1; // 範囲外の場合は1に戻す
    }
    
    // 進行率の計算
    $progressPercent = $totalItems > 0 ? round(($currentPosition / $totalItems) * 100, 1) : 0;
    
    // 詳細情報
    $details = [];
    foreach ($sequentialFiles as $fileInfo) {
        $fname = $fileInfo['filename'];
        $fIndex = 0;
        
        if (isset($progress[$fname]) && isset($progress[$fname]['currentIndex'])) {
            $fIndex = (int)$progress[$fname]['currentIndex'];
        }
        
        $details[] = [
            'filename' => $fname,
            'displayName' => $fileInfo['displayName'],
            'currentIndex' => $fIndex,
            'currentPosition' => $fIndex + 1,
            'totalItems' => $fileInfo['totalItems']
        ];
    }
    
    // 成功レスポンス
    $response = [
        'status' => 'success',
        'message' => '順番表示の状態を取得しました',
        'data' => [
            'hasSequentialFiles' => true,
            'mainFile' => $filename,
            'currentPosition' => $currentPosition,
            'totalItems' => $totalItems,
            'progress' => $progressPercent . '%',
            'progressRaw' => $progressPercent,
            'allFiles' => $details,
            'lastUpdated' => isset($progress[$filename]['lastReset']) ? 
                           $progress[$filename]['lastReset'] : 
                           date('Y-m-d H:i:s')
        ],
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
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
    error_log('get_sequence_status.php error: ' . $e->getMessage());
}

/**
 * 順番表示モードのファイルを取得
 * @return array 順番表示ファイルの一覧
 */
function getSequentialFiles() {
    $sequentialFiles = [];
    
    try {
        // 設定ファイルから順番表示ファイルを特定
        $settingsFile = __DIR__ . '/../data/settings.json';
        
        if (!file_exists($settingsFile)) {
            return [];
        }
        
        $settings = json_decode(file_get_contents($settingsFile), true);
        if (!$settings || !isset($settings['files'])) {
            return [];
        }
        
        foreach ($settings['files'] as $filename => $fileSettings) {
            $displayMode = $fileSettings['displayMode'] ?? 'random';
            
            if ($displayMode === 'sequence') {
                // コンテンツファイルの情報を取得
                $contentFile = __DIR__ . "/../data/contents/{$filename}";
                $totalItems = 0;
                $displayName = $fileSettings['displayName'] ?? $filename;
                
                if (file_exists($contentFile)) {
                    $contentData = json_decode(file_get_contents($contentFile), true);
                    if ($contentData) {
                        if (isset($contentData['items']) && is_array($contentData['items'])) {
                            $totalItems = count($contentData['items']);
                        } elseif (is_array($contentData)) {
                            $totalItems = count($contentData);
                        }
                        
                        // メタデータから表示名を取得
                        if (isset($contentData['meta']['title'])) {
                            $displayName = $contentData['meta']['title'];
                        }
                    }
                }
                
                $sequentialFiles[] = [
                    'filename' => $filename,
                    'displayName' => $displayName,
                    'totalItems' => $totalItems
                ];
            }
        }
        
    } catch (Exception $e) {
        error_log('Error getting sequential files: ' . $e->getMessage());
    }
    
    return $sequentialFiles;
}
?>
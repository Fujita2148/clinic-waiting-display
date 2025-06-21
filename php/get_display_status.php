<?php
/**
 * 表示システム状態取得API
 * 表示システムの詳細状態を取得（デバッグ情報含む）
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

// エラーレポートを制御
error_reporting(E_ALL);
ini_set('display_errors', 0);

try {
    // システム設定の読み込み
    $settings = loadSettings();
    
    // コンテンツファイルの分析
    $contentAnalysis = analyzeContentFiles($settings);
    
    // 順番表示の状態
    $sequentialStatus = getSequentialStatus();
    
    // システム全体の状態
    $systemStatus = [
        'displayMode' => $contentAnalysis['primaryDisplayMode'],
        'isSequentialMode' => $contentAnalysis['hasSequentialFiles'],
        'contentFiles' => $contentAnalysis['files'],
        'totalItems' => $contentAnalysis['totalItems'],
        'queueLength' => $contentAnalysis['queueLength'],
        'sequential' => $sequentialStatus,
        'settings' => [
            'interval' => $settings['interval'] ?? 20,
            'duration' => $settings['duration'] ?? 8,
            'showTips' => $settings['showTips'] ?? true
        ],
        'lastUpdated' => $settings['lastUpdated'] ?? null
    ];
    
    // 成功レスポンス
    $response = [
        'status' => 'success',
        'message' => '表示システムの状態を取得しました',
        'data' => $systemStatus,
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
    error_log('get_display_status.php error: ' . $e->getMessage());
}

/**
 * 設定ファイルの読み込み
 * @return array 設定データ
 */
function loadSettings() {
    $settingsFile = __DIR__ . '/../data/settings.json';
    
    if (!file_exists($settingsFile)) {
        return [
            'interval' => 20,
            'duration' => 8,
            'showTips' => true,
            'files' => []
        ];
    }
    
    $content = file_get_contents($settingsFile);
    if ($content === false) {
        throw new Exception('設定ファイルの読み込みに失敗しました');
    }
    
    $settings = json_decode($content, true);
    if ($settings === null) {
        throw new Exception('設定ファイルの解析に失敗しました');
    }
    
    return $settings;
}

/**
 * コンテンツファイルの分析
 * @param array $settings 設定データ
 * @return array 分析結果
 */
function analyzeContentFiles($settings) {
    $analysis = [
        'files' => [],
        'hasSequentialFiles' => false,
        'hasRandomFiles' => false,
        'hasOrderFiles' => false,
        'primaryDisplayMode' => 'unknown',
        'totalItems' => 0,
        'queueLength' => 0
    ];
    
    $contentDir = __DIR__ . '/../data/contents/';
    
    if (!is_dir($contentDir)) {
        return $analysis;
    }
    
    $files = scandir($contentDir);
    if ($files === false) {
        return $analysis;
    }
    
    $displayModes = [];
    
    foreach ($files as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) === 'json') {
            $filePath = $contentDir . $file;
            $fileInfo = analyzeContentFile($file, $filePath, $settings);
            
            if ($fileInfo) {
                $analysis['files'][] = $fileInfo;
                $analysis['totalItems'] += $fileInfo['itemCount'];
                
                $mode = $fileInfo['displayMode'];
                $displayModes[] = $mode;
                
                switch ($mode) {
                    case 'sequence':
                        $analysis['hasSequentialFiles'] = true;
                        break;
                    case 'order':
                        $analysis['hasOrderFiles'] = true;
                        $analysis['queueLength'] += $fileInfo['itemCount'];
                        break;
                    case 'random':
                        $analysis['hasRandomFiles'] = true;
                        $analysis['queueLength'] += $fileInfo['itemCount'] * ($fileInfo['weight'] ?? 1);
                        break;
                }
            }
        }
    }
    
    // 主要な表示モードを決定
    if ($analysis['hasSequentialFiles']) {
        $analysis['primaryDisplayMode'] = 'sequence';
    } elseif ($analysis['hasOrderFiles'] && $analysis['hasRandomFiles']) {
        $analysis['primaryDisplayMode'] = 'mixed';
    } elseif ($analysis['hasOrderFiles']) {
        $analysis['primaryDisplayMode'] = 'order';
    } elseif ($analysis['hasRandomFiles']) {
        $analysis['primaryDisplayMode'] = 'random';
    }
    
    return $analysis;
}

/**
 * 個別コンテンツファイルの分析
 * @param string $filename ファイル名
 * @param string $filePath ファイルパス
 * @param array $settings 設定データ
 * @return array|null ファイル情報
 */
function analyzeContentFile($filename, $filePath, $settings) {
    try {
        $content = file_get_contents($filePath);
        if ($content === false) {
            return null;
        }
        
        $data = json_decode($content, true);
        if ($data === null) {
            return null;
        }
        
        // アイテム数の取得
        $itemCount = 0;
        $title = $filename;
        
        if (isset($data['items']) && is_array($data['items'])) {
            $itemCount = count($data['items']);
            if (isset($data['meta']['title'])) {
                $title = $data['meta']['title'];
            }
        } elseif (is_array($data)) {
            $itemCount = count($data);
        }
        
        // 設定からの情報取得
        $fileSettings = $settings['files'][$filename] ?? [];
        $enabled = $fileSettings['enabled'] ?? true;
        $displayMode = $fileSettings['displayMode'] ?? 
                      ($data['meta']['displayMode'] ?? 'random');
        $weight = $fileSettings['weight'] ?? 1;
        $duration = $fileSettings['duration'] ?? 8;
        
        return [
            'filename' => $filename,
            'title' => $title,
            'enabled' => $enabled,
            'itemCount' => $itemCount,
            'displayMode' => $displayMode,
            'weight' => $weight,
            'duration' => $duration,
            'fileSize' => filesize($filePath),
            'lastModified' => date('Y-m-d H:i:s', filemtime($filePath))
        ];
        
    } catch (Exception $e) {
        error_log("Error analyzing file {$filename}: " . $e->getMessage());
        return null;
    }
}

/**
 * 順番表示の状態取得
 * @return array 順番表示の状態
 */
function getSequentialStatus() {
    $status = [
        'hasProgress' => false,
        'files' => [],
        'currentFile' => null,
        'totalProgress' => 0
    ];
    
    try {
        $progressFile = __DIR__ . '/../data/sequential_progress.json';
        
        if (file_exists($progressFile)) {
            $content = file_get_contents($progressFile);
            if ($content !== false) {
                $progress = json_decode($content, true);
                if ($progress) {
                    $status['hasProgress'] = true;
                    
                    foreach ($progress as $filename => $data) {
                        $status['files'][$filename] = [
                            'currentIndex' => $data['currentIndex'] ?? 0,
                            'lastReset' => $data['lastReset'] ?? null
                        ];
                    }
                    
                    // 最初のファイルを現在のファイルとする
                    if (!empty($status['files'])) {
                        $status['currentFile'] = array_keys($status['files'])[0];
                    }
                }
            }
        }
        
    } catch (Exception $e) {
        error_log('Error getting sequential status: ' . $e->getMessage());
    }
    
    return $status;
}
?>
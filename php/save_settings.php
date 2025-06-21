<?php
/**
 * システム設定保存API（改善版）
 * interval/duration分離・改行対応
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
    
    // データの検証とサニタイズ
    $validatedData = validateSettingsData($data);
    
    // ファイルパス
    $settingsFile = __DIR__ . '/../data/settings.json';
    $dataDir = dirname($settingsFile);
    
    // dataディレクトリが存在しない場合は作成
    if (!is_dir($dataDir)) {
        if (!mkdir($dataDir, 0755, true)) {
            throw new Exception('データディレクトリの作成に失敗しました');
        }
    }
    
    // 既存設定の読み込み（マージ用）
    $existingSettings = [];
    if (file_exists($settingsFile)) {
        $existingContent = file_get_contents($settingsFile);
        if ($existingContent !== false) {
            $existingSettings = json_decode($existingContent, true) ?: [];
        }
    }
    
    // 設定をマージ
    $mergedSettings = array_merge($existingSettings, $validatedData);
    $mergedSettings['lastUpdated'] = date('Y-m-d H:i:s');
    
    // JSONファイルに保存
    $jsonContent = json_encode($mergedSettings, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($jsonContent === false) {
        throw new Exception('JSON エンコードに失敗しました');
    }
    
    $result = file_put_contents($settingsFile, $jsonContent, LOCK_EX);
    if ($result === false) {
        throw new Exception('設定ファイルの保存に失敗しました');
    }
    
    // 成功レスポンス
    $response = [
        'status' => 'success',
        'message' => '設定を保存しました',
        'data' => [
            'interval' => $validatedData['interval'] ?? null,
            'duration' => $validatedData['duration'] ?? null,
            'showTips' => $validatedData['showTips'] ?? null
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
    error_log('save_settings.php error: ' . $e->getMessage());
}

/**
 * 設定データの検証とサニタイズ（改善版）
 * @param array $data 入力データ
 * @return array 検証済みデータ
 * @throws Exception 検証エラー
 */
function validateSettingsData($data) {
    $validated = [];
    
    // コンテンツ切替間隔の検証
    if (isset($data['interval'])) {
        $interval = (int)$data['interval'];
        if ($interval < 5 || $interval > 120) {
            throw new Exception('コンテンツ切替間隔は5-120秒の範囲で設定してください');
        }
        $validated['interval'] = $interval;
    }
    
    // コンテンツ表示時間の検証
    if (isset($data['duration'])) {
        $duration = (int)$data['duration'];
        if ($duration < 3 || $duration > 60) {
            throw new Exception('コンテンツ表示時間は3-60秒の範囲で設定してください');
        }
        $validated['duration'] = $duration;
    }
    
    // コンテンツ表示ON/OFFの検証
    if (isset($data['showTips'])) {
        $validated['showTips'] = (bool)$data['showTips'];
    }
    
    // ファイル別設定の検証（既存のロジックを維持）
    if (isset($data['files']) && is_array($data['files'])) {
        $validated['files'] = [];
        
        foreach ($data['files'] as $filename => $fileSettings) {
            // ファイル名の検証（セキュリティ）
            if (!preg_match('/^[a-zA-Z0-9_\-\.]+\.json$/', $filename)) {
                throw new Exception("無効なファイル名: $filename");
            }
            
            $validatedFile = [];
            
            if (isset($fileSettings['enabled'])) {
                $validatedFile['enabled'] = (bool)$fileSettings['enabled'];
            }
            
            if (isset($fileSettings['duration'])) {
                $duration = (int)$fileSettings['duration'];
                if ($duration < 1 || $duration > 60) {
                    throw new Exception("表示時間は1-60秒の範囲で設定してください: $filename");
                }
                $validatedFile['duration'] = $duration;
            }
            
            if (isset($fileSettings['weight'])) {
                $weight = (int)$fileSettings['weight'];
                if ($weight < 1 || $weight > 10) {
                    throw new Exception("重みは1-10の範囲で設定してください: $filename");
                }
                $validatedFile['weight'] = $weight;
            }
            
            if (isset($fileSettings['displayMode'])) {
                $displayMode = trim($fileSettings['displayMode']);
                if (!in_array($displayMode, ['random', 'order', 'sequence'])) {
                    throw new Exception("表示モードは random, order, sequence のいずれかを指定してください: $filename");
                }
                $validatedFile['displayMode'] = $displayMode;
            }
            
            if (isset($fileSettings['displayName'])) {
                $displayName = strip_tags(trim($fileSettings['displayName']));
                if (mb_strlen($displayName) > 50) {
                    throw new Exception("表示名は50文字以内で設定してください: $filename");
                }
                $validatedFile['displayName'] = $displayName;
            }
            
            $validated['files'][$filename] = $validatedFile;
        }
    }
    
    return $validated;
}
?>
<?php
/**
 * コンテンツファイル一覧取得API
 * data/contents/ フォルダ内のJSONファイルを検索して返す
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// エラーレポートを制御
error_reporting(E_ALL);
ini_set('display_errors', 0);

try {
    // コンテンツディレクトリのパス
    $contentDir = __DIR__ . '/../data/contents/';
    $files = [];
    
    // ディレクトリの存在確認・作成
    if (!is_dir($contentDir)) {
        if (!mkdir($contentDir, 0755, true)) {
            throw new Exception('コンテンツディレクトリの作成に失敗しました');
        }
    }
    
    // JSONファイルを検索
    $fileList = scandir($contentDir);
    if ($fileList === false) {
        throw new Exception('ディレクトリの読み込みに失敗しました');
    }
    
    foreach ($fileList as $file) {
        // JSONファイルのみ処理
        if (pathinfo($file, PATHINFO_EXTENSION) === 'json') {
            $filePath = $contentDir . $file;
            
            // ファイル情報を取得
            $fileSize = filesize($filePath);
            $lastModified = filemtime($filePath);
            $contentCount = 0;
            
            // ファイル内容を解析してアイテム数を取得
            try {
                $jsonContent = file_get_contents($filePath);
                if ($jsonContent !== false) {
                    $data = json_decode($jsonContent, true);
                    
                    if (json_last_error() === JSON_ERROR_NONE) {
                        if (isset($data['items']) && is_array($data['items'])) {
                            // 新フォーマット
                            $contentCount = count($data['items']);
                        } elseif (is_array($data)) {
                            // 旧フォーマット
                            $contentCount = count($data);
                        }
                    }
                }
            } catch (Exception $e) {
                // JSON解析エラーは無視してファイル情報のみ返す
                error_log("JSON parse error for file {$file}: " . $e->getMessage());
            }
            
            // ファイル情報を配列に追加
            $files[] = [
                'filename' => $file,
                'displayName' => generateDisplayName($file),
                'path' => 'data/contents/' . $file,
                'size' => $fileSize,
                'contentCount' => $contentCount,
                'lastModified' => $lastModified,
                'lastModifiedFormatted' => date('Y-m-d H:i:s', $lastModified)
            ];
        }
    }
    
    // ファイル名でソート
    usort($files, function($a, $b) {
        return strcmp($a['filename'], $b['filename']);
    });
    
    // 成功レスポンス
    $response = [
        'status' => 'success',
        'files' => $files,
        'totalFiles' => count($files),
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
    
    echo json_encode($errorResponse, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
    // エラーログに記録
    error_log('get_files.php error: ' . $e->getMessage());
}

/**
 * ファイル名から表示名を生成
 * @param string $filename ファイル名
 * @return string 表示名
 */
function generateDisplayName($filename) {
    // .json を除去
    $name = str_replace('.json', '', $filename);
    
    // アンダースコアをスペースに変換
    $name = str_replace('_', ' ', $name);
    
    // 各単語の最初を大文字に
    $name = ucwords($name);
    
    return $name;
}

/**
 * ファイルサイズを人間が読みやすい形式に変換
 * @param int $size バイト数
 * @return string フォーマットされたサイズ
 */
function formatFileSize($size) {
    if ($size < 1024) {
        return $size . ' B';
    } elseif ($size < 1024 * 1024) {
        return round($size / 1024, 1) . ' KB';
    } else {
        return round($size / (1024 * 1024), 1) . ' MB';
    }
}
?>
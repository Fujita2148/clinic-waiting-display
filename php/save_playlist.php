<?php
/**
 * プレイリスト保存API
 * プレイリスト文字列と設定を保存
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

require_once __DIR__ . '/content_file_utils.php';

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
    if (!isset($data['playlistString'])) {
        throw new Exception('プレイリスト文字列が指定されていません');
    }
    
    $playlistString = trim($data['playlistString']);
    if (empty($playlistString)) {
        throw new Exception('プレイリスト文字列が空です');
    }
    
    // プレイリスト文字列の解析
    $playlistItems = parsePlaylistString($playlistString);
    
    // 利用可能なコンテンツファイルを取得
    $availableFiles = getAvailableContentFiles();
    
    // プレイリストの検証と構築
    $playlist = buildPlaylist($playlistItems, $availableFiles);
    
    // 短縮形マップの生成
    $shortcutMap = generateShortcutMap($availableFiles);
    
    // 統計情報の計算
    $totalItems = 0;
    foreach ($playlist as $item) {
        $totalItems += $item['itemCount'];
    }
    
    // 保存データの構築
    $playlistData = [
        'playlist' => $playlist,
        'playlistString' => $playlistString,
        'shortcutMap' => $shortcutMap,
        'totalFiles' => count($playlist),
        'totalItems' => $totalItems,
        'currentPlaylistIndex' => 0,
        'currentFileIndex' => 0,
        'lastUpdated' => date('Y-m-d H:i:s'),
        'updatedBy' => getClientInfo()
    ];
    
    // ファイルパス
    $playlistFile = __DIR__ . '/../data/playlist.json';
    $dataDir = dirname($playlistFile);
    
    // dataディレクトリが存在しない場合は作成
    if (!is_dir($dataDir)) {
        if (!mkdir($dataDir, 0755, true)) {
            throw new Exception('データディレクトリの作成に失敗しました');
        }
    }
    
    // JSONファイルに保存
    $jsonContent = json_encode($playlistData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($jsonContent === false) {
        throw new Exception('JSON エンコードに失敗しました');
    }
    
    $result = file_put_contents($playlistFile, $jsonContent, LOCK_EX);
    if ($result === false) {
        throw new Exception('プレイリストファイルの保存に失敗しました');
    }
    
    // 成功レスポンス
    $response = [
        'status' => 'success',
        'message' => 'プレイリストを保存しました',
        'data' => [
            'playlistString' => $playlistString,
            'totalFiles' => count($playlist),
            'totalItems' => $totalItems,
            'shortcutMap' => $shortcutMap
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
    error_log('save_playlist.php error: ' . $e->getMessage());
}

/**
 * プレイリスト文字列を解析
 * @param string $playlistString プレイリスト文字列
 * @return array 解析されたアイテムの配列
 */
function parsePlaylistString($playlistString) {
    // カンマで分割
    $items = explode(',', $playlistString);
    
    // 各アイテムをトリムして空白を除去
    $parsedItems = [];
    foreach ($items as $item) {
        $trimmed = trim($item);
        if (!empty($trimmed)) {
            $parsedItems[] = $trimmed;
        }
    }
    
    if (empty($parsedItems)) {
        throw new Exception('有効なプレイリストアイテムがありません');
    }
    
    return $parsedItems;
}

/**
 * 利用可能なコンテンツファイルを取得
 * @return array コンテンツファイル情報の配列
 */
function getAvailableContentFiles() {
    $contentDir = __DIR__ . '/../data/contents/';
    $files = [];
    
    if (!is_dir($contentDir)) {
        throw new Exception('コンテンツディレクトリが見つかりません');
    }
    
    $fileList = scandir($contentDir);
    if ($fileList === false) {
        throw new Exception('コンテンツディレクトリの読み込みに失敗しました');
    }
    
    foreach ($fileList as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) === 'json') {
            $filePath = $contentDir . $file;

            $info = readContentFileInfo($filePath, $file);
            if ($info === null) {
                continue;
            }

            $files[$file] = [
                'filename' => $file,
                'displayName' => $info['displayName'],
                'itemCount' => $info['itemCount']
            ];
        }
    }
    
    if (empty($files)) {
        throw new Exception('利用可能なコンテンツファイルがありません');
    }
    
    return $files;
}

/**
 * プレイリストを構築
 * @param array $items プレイリストアイテム
 * @param array $availableFiles 利用可能なファイル
 * @return array プレイリスト
 */
function buildPlaylist($items, $availableFiles) {
    $playlist = [];
    $shortcutMap = generateShortcutMap($availableFiles);
    
    foreach ($items as $item) {
        $filename = null;
        
        // 短縮形（A, B, C...）の場合
        if (strlen($item) === 1 && isset($shortcutMap[$item])) {
            $filename = $shortcutMap[$item];
        }
        // ファイル名の場合
        elseif (isset($availableFiles[$item])) {
            $filename = $item;
        }
        // .jsonなしのファイル名の場合
        elseif (isset($availableFiles[$item . '.json'])) {
            $filename = $item . '.json';
        }
        
        if ($filename && isset($availableFiles[$filename])) {
            $playlist[] = $availableFiles[$filename];
        } else {
            throw new Exception("無効なプレイリストアイテム: $item");
        }
    }
    
    return $playlist;
}

/**
 * 短縮形マップを生成
 * @param array $files ファイル一覧
 * @return array 短縮形マップ
 */
function generateShortcutMap($files) {
    $map = [];
    $index = 0;
    
    // ファイル名でソート
    $sortedFiles = array_keys($files);
    sort($sortedFiles);
    
    foreach ($sortedFiles as $filename) {
        $letter = chr(65 + $index); // A, B, C...
        $map[$letter] = $filename;
        $index++;
        
        // Zを超えたら停止
        if ($index > 25) break;
    }
    
    return $map;
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
?>

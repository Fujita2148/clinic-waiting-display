<?php
/**
 * プレイリスト再生状況取得API
 * 現在の再生位置と進行状況を取得
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

// エラーレポートを制御
error_reporting(E_ALL);
ini_set('display_errors', 0);

try {
    // プレイリストファイルの読み込み
    $playlistFile = __DIR__ . '/../data/playlist.json';
    
    if (!file_exists($playlistFile)) {
        // プレイリストがない場合のデフォルトレスポンス
        $response = [
            'status' => 'success',
            'message' => 'プレイリストが設定されていません',
            'data' => [
                'hasPlaylist' => false,
                'playlistString' => '',
                'totalFiles' => 0,
                'totalItems' => 0,
                'currentPlaylistIndex' => 0,
                'currentFileIndex' => 0,
                'currentFile' => null,
                'progress' => '0%',
                'playlist' => []
            ],
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
    
    // プレイリストデータの読み込み
    $playlistContent = file_get_contents($playlistFile);
    if ($playlistContent === false) {
        throw new Exception('プレイリストファイルの読み込みに失敗しました');
    }
    
    $playlistData = json_decode($playlistContent, true);
    if ($playlistData === null) {
        throw new Exception('プレイリストファイルの解析に失敗しました');
    }
    
    // 現在のファイル情報を取得
    $currentFile = null;
    $currentFileItems = 0;
    
    if (isset($playlistData['playlist']) && 
        isset($playlistData['currentPlaylistIndex']) && 
        isset($playlistData['playlist'][$playlistData['currentPlaylistIndex']])) {
        
        $currentFile = $playlistData['playlist'][$playlistData['currentPlaylistIndex']];
        
        // ファイルの詳細情報を取得
        if (isset($currentFile['filename'])) {
            $contentFile = __DIR__ . '/../data/contents/' . $currentFile['filename'];
            if (file_exists($contentFile)) {
                $content = json_decode(file_get_contents($contentFile), true);
                if ($content) {
                    if (isset($content['items'])) {
                        $currentFileItems = count($content['items']);
                        
                        // 現在のアイテム情報を追加
                        $currentItemIndex = $playlistData['currentFileIndex'] ?? 0;
                        if (isset($content['items'][$currentItemIndex])) {
                            $currentFile['currentItem'] = [
                                'index' => $currentItemIndex,
                                'title' => $content['items'][$currentItemIndex]['title'] ?? '',
                                'icon' => $content['items'][$currentItemIndex]['icon'] ?? ''
                            ];
                        }
                    }
                }
            }
        }
    }
    
    // 進行率の計算
    $totalPlaylistItems = count($playlistData['playlist'] ?? []);
    $currentPlaylistIndex = $playlistData['currentPlaylistIndex'] ?? 0;
    $progressPercent = $totalPlaylistItems > 0 
        ? round((($currentPlaylistIndex + 1) / $totalPlaylistItems) * 100, 1) 
        : 0;
    
    // 次のファイル情報
    $nextFile = null;
    $nextIndex = ($currentPlaylistIndex + 1) % $totalPlaylistItems;
    if (isset($playlistData['playlist'][$nextIndex])) {
        $nextFile = $playlistData['playlist'][$nextIndex];
    }
    
    // レスポンスの構築
    $response = [
        'status' => 'success',
        'message' => 'プレイリストの状態を取得しました',
        'data' => [
            'hasPlaylist' => true,
            'playlistString' => $playlistData['playlistString'] ?? '',
            'totalFiles' => $playlistData['totalFiles'] ?? 0,
            'totalItems' => $playlistData['totalItems'] ?? 0,
            'currentPlaylistIndex' => $currentPlaylistIndex,
            'currentFileIndex' => $playlistData['currentFileIndex'] ?? 0,
            'currentFile' => $currentFile,
            'currentFileItems' => $currentFileItems,
            'nextFile' => $nextFile,
            'progress' => $progressPercent . '%',
            'progressRaw' => $progressPercent,
            'playlist' => $playlistData['playlist'] ?? [],
            'lastUpdated' => $playlistData['lastUpdated'] ?? null
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
    error_log('get_playlist_status.php error: ' . $e->getMessage());
}

/**
 * プレイリストの検証
 * @param array $playlistData プレイリストデータ
 * @return array 検証結果
 */
function validatePlaylist($playlistData) {
    $issues = [];
    
    // 必須フィールドの確認
    if (!isset($playlistData['playlist']) || !is_array($playlistData['playlist'])) {
        $issues[] = 'プレイリストが設定されていません';
    }
    
    if (!isset($playlistData['playlistString'])) {
        $issues[] = 'プレイリスト文字列が設定されていません';
    }
    
    // インデックスの範囲確認
    $playlistCount = count($playlistData['playlist'] ?? []);
    $currentIndex = $playlistData['currentPlaylistIndex'] ?? 0;
    
    if ($currentIndex >= $playlistCount && $playlistCount > 0) {
        $issues[] = '現在のプレイリストインデックスが範囲外です';
    }
    
    return [
        'isValid' => empty($issues),
        'issues' => $issues
    ];
}

/**
 * プレイリストの統計情報を計算
 * @param array $playlist プレイリスト
 * @return array 統計情報
 */
function calculatePlaylistStats($playlist) {
    $stats = [
        'totalFiles' => count($playlist),
        'totalItems' => 0,
        'fileTypes' => []
    ];
    
    foreach ($playlist as $file) {
        $stats['totalItems'] += $file['itemCount'] ?? 0;
        
        $type = pathinfo($file['filename'] ?? '', PATHINFO_FILENAME);
        if (!isset($stats['fileTypes'][$type])) {
            $stats['fileTypes'][$type] = 0;
        }
        $stats['fileTypes'][$type]++;
    }
    
    return $stats;
}
?>

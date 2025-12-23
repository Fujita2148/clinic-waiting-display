<?php
/**
 * コンテンツファイル共通ユーティリティ
 */

/**
 * コンテンツファイルを解析して表示名と件数を取得
 * @param string $filePath ファイルパス
 * @param string $fallbackName フォールバックの表示名
 * @return array|null 解析結果
 */
function readContentFileInfo($filePath, $fallbackName) {
    $content = file_get_contents($filePath);
    if ($content === false) {
        return null;
    }

    $data = json_decode($content, true);
    if ($data === null || json_last_error() !== JSON_ERROR_NONE) {
        return null;
    }

    $itemCount = 0;
    $displayName = $fallbackName;
    $metaTitle = null;

    if (isset($data['meta']) && isset($data['items']) && is_array($data['items'])) {
        $itemCount = count($data['items']);
        if (!empty($data['meta']['title'])) {
            $metaTitle = $data['meta']['title'];
            $displayName = $metaTitle;
        }
    } elseif (is_array($data)) {
        $itemCount = count($data);
    }

    return [
        'displayName' => $displayName,
        'metaTitle' => $metaTitle,
        'itemCount' => $itemCount
    ];
}
?>

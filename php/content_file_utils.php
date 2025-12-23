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
    $id = generateContentFileId($data, $content);

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
        'id' => $id,
        'displayName' => $displayName,
        'metaTitle' => $metaTitle,
        'itemCount' => $itemCount
    ];
}

/**
 * コンテンツファイルの固定IDを生成
 * @param array $data デコード済みJSON
 * @param string $rawContent JSONファイルの生データ
 * @return string 固定ID
 */
function generateContentFileId($data, $rawContent) {
    if (isset($data['meta']) && isset($data['meta']['id'])) {
        $metaId = trim((string) $data['meta']['id']);
        if ($metaId !== '') {
            return $metaId;
        }
    }

    return 'cf_' . substr(sha1($rawContent), 0, 12);
}
?>

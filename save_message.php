<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['error'=>'Invalid method']); exit;
}
$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['text'])) {
    http_response_code(400); echo json_encode(['error'=>'Missing text']); exit;
}
$text = mb_substr(strip_tags($data['text']), 0, 200);
$file = __DIR__ . '/data/message.json';
file_put_contents($file, json_encode(['text'=>$text], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
echo json_encode(['status'=>'ok']);

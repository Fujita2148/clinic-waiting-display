<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['error'=>'Invalid method']); exit;
}
$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['room1'], $data['room2'])) {
    http_response_code(400); echo json_encode(['error'=>'Missing rooms']); exit;
}
$file = __DIR__ . '/data/status.json';
file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
echo json_encode(['status'=>'ok']);

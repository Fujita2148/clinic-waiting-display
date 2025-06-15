<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD']!=='POST') {
    http_response_code(405);
    exit;
}
$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['interval'],$data['duration'],$data['msgMode'],$data['showTips'],$data['message'])) {
    http_response_code(400);
    echo json_encode(['error'=>'Invalid payload']);
    exit;
}

// 保存：settings.json
file_put_contents(__DIR__.'/data/settings.json',
  json_encode([
    'interval' => intval($data['interval']),
    'duration' => intval($data['duration']),
    'msgMode'  => in_array($data['msgMode'],['always','sync'])?$data['msgMode']:'sync',
    'showTips' => (bool)$data['showTips']
  ], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)
);

// 保存：message.json
$msg = $data['message'];
file_put_contents(__DIR__.'/data/message.json',
  json_encode([
    'text'    => mb_substr(strip_tags($msg['text']),0,200),
    'visible' => (bool)$msg['visible']
  ], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)
);

echo json_encode(['status'=>'ok']);

<?php
/* POST /api/logout.php → {"ok": true}
   Kilépés akkor is sikeres, ha nem volt bejelentkezve senki. */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Nem támogatott metódus!"], JSON_UNESCAPED_UNICODE);
    exit;
}

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}
session_destroy();

echo json_encode(["ok" => true], JSON_UNESCAPED_UNICODE);

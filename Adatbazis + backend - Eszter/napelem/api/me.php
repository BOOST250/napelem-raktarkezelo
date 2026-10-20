<?php
/* GET /api/me.php
   Válasz: {"user": {...}} ha van élő session, egyébként 401.
   A felületek ezzel döntik el induláskor, hogy be kell-e léptetni. */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["error" => "Nem támogatott metódus!"], JSON_UNESCAPED_UNICODE);
    exit;
}

$user = aktualis_felhasznalo();
if ($user === null) {
    http_response_code(401);
    echo json_encode(["error" => "Nincs bejelentkezve."], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(["user" => $user], JSON_UNESCAPED_UNICODE);

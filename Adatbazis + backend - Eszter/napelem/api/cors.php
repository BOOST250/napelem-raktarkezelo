<?php
/* =====================================================================
   Közös fejlécek. A Slim CorsMiddleware a mérvadó; ez a fájl akkor fut,
   ha valaki még közvetlenül behúzza.

   A kérés http(s) originjét tükrözzük (localhost, 127.0.0.1 vagy a gép
   IP-címe, tetszőleges port). A "*" origin credentials mellett nem jó,
   ezért csak akkor használjuk, ha nincs ilyen Origin.
   ===================================================================== */

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && preg_match('~^https?://([A-Za-z0-9.-]+|\[[0-9A-Fa-f:]+\])(:\d+)?$~', $origin) === 1) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
} else {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Access-Control-Max-Age: 86400');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

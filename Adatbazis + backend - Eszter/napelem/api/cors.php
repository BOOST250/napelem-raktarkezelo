<?php
/* =====================================================================
   Közös fejlécek minden API-végponthoz.
   Minden api/*.php fájl elején: require_once __DIR__ . '/cors.php';

   Miért kell külön fájlba?
   1) A böngésző a JSON-törzsű POST/PUT kérés elé egy OPTIONS kérést küld
      (CORS preflight). Erre a tényleges feldolgozás előtt válaszolni kell,
      különben a fájlok végén lévő "Nem támogatott metódus!" 405-be fut,
      és a böngésző eldobja az egész kérést.
   2) A bejelentkezés PHP session-cookie-val működik, a sütit viszont a
      böngésző csak akkor küldi el másik portról, ha a válaszban szerepel
      az Access-Control-Allow-Credentials, és az Allow-Origin NEM "*",
      hanem a konkrét origin. Ezért tükrözzük vissza a kérés originjét.
   ===================================================================== */

header('Content-Type: application/json; charset=utf-8');

// Csak a fejlesztői gépen futó frontendeket engedjük (pl. a python -m http.server 8123-at).
// Ha a felületek a XAMPP htdocs alól futnak, ugyanaz az origin, és CORS nem is játszik.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && preg_match('~^https?://(localhost|127\.0\.0\.1)(:\d+)?$~', $origin)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
} else {
    // Nincs vagy nem ismert origin: süti nélküli (nyilvános) hozzáférés.
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

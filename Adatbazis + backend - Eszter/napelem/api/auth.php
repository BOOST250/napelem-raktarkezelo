<?php
/* =====================================================================
   Bejelentkezés-kezelés (PHP session).
   Használat: require_once __DIR__ . '/auth.php';  (a cors.php UTÁN)

   A session-cookie a localhost összes portján ugyanaz (a same-site
   szabály a portot nem veszi figyelembe), ezért a 8123-as porton futó
   frontend is kap sütit – de csak akkor, ha a kérés credentials-szel
   megy, és a válaszban ott van az Access-Control-Allow-Credentials
   (lásd cors.php).
   ===================================================================== */

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/** A bejelentkezett felhasználó, vagy null. */
function aktualis_felhasznalo(): ?array
{
    if (!isset($_SESSION['user'])) {
        return null;
    }
    return $_SESSION['user'];
}

/**
 * Megállítja a kérést, ha nincs bejelentkezve (401), vagy ha nincs meg
 * a kért szerepkör (403). Üres $szerepkorok = bármelyik bejelentkezett.
 */
function kotelezo_bejelentkezes(array $szerepkorok = []): array
{
    $user = aktualis_felhasznalo();
    if ($user === null) {
        http_response_code(401);
        echo json_encode(["error" => "Nincs bejelentkezve."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($szerepkorok !== [] && !in_array($user['role'], $szerepkorok, true)) {
        http_response_code(403);
        echo json_encode(["error" => "Ehhez a művelethez nincs jogosultságod."], JSON_UNESCAPED_UNICODE);
        exit;
    }
    return $user;
}

/** A JSON kéréstörzs tömbként (hibás/üres törzs esetén üres tömb). */
function keres_torzs(): array
{
    $input = json_decode(file_get_contents('php://input'), true);
    return is_array($input) ? $input : [];
}

<?php
/* =====================================================================
   Régi belépés-segéd. Az új kéréseket a Slim SessionMiddleware és
   RoleMiddleware kezeli; ez a fájl csak a még közvetlenül behúzott
   kód miatt maradt.

   A süti domainje szándékosan nincs beállítva: ahhoz a hoszthoz kötődik,
   ahonnan az oldalt megnyitották (localhost vagy a gép IP-címe).
   ===================================================================== */

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
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

<?php

/**
 * MySQL a XAMPP-gépen. A `localhost` itt a adatbázis-kiszolgáló, nem a böngésző címe.
 * Másik gépről a felületet a szerver IP-címén nyitod meg; a MySQL ettől még ezen a gépen marad,
 * a 3306-os portot nem kell kinyitni a hálózatra.
 */
$host = 'localhost';
$username = 'root';
$password = '';
$database = 'napelemrendszer';

// A szerveren (InfinityFree) a database.local.php felülírja a fenti helyi XAMPP-adatokat.
// Ezt a fájlt a GitHub Actions hozza létre telepítéskor, a repóba nem kerül be.
if (file_exists(__DIR__ . '/database.local.php')) {
    require __DIR__ . '/database.local.php';
}

// A Slim alkalmazás csak a fenti változókat olvassa, és saját PDO-kapcsolatot nyit.
if (defined('NAPELEM_DB_CONFIG_ONLY') && NAPELEM_DB_CONFIG_ONLY) {
    return;
}

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $conn = new mysqli($host, $username, $password, $database);
    $conn->set_charset('utf8mb4');
    $conn->query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
} catch (mysqli_sql_exception $e) {
    error_log('Adatbázis kapcsolat hiba: ' . $e->getMessage());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => 'Adatbázis kapcsolat hiba.'], JSON_UNESCAPED_UNICODE);
    exit;
}

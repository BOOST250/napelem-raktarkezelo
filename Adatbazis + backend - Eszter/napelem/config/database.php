<?php
$host = 'localhost';
$username = 'root';
$password = '';
$database = 'napelemrendszer';

// A szerveren (InfinityFree) a database.local.php felülírja a fenti helyi XAMPP-adatokat.
// Ezt a fájlt a GitHub Actions hozza létre telepítéskor, a repóba nem kerül be.
if (file_exists(__DIR__ . '/database.local.php')) {
    require __DIR__ . '/database.local.php';
}

$conn = new mysqli($host, $username, $password, $database);

if ($conn->connect_error) {
    die(json_encode([
        "success" => false,
        "error" => "Adatbázis kapcsolat hiba: " . $conn->connect_error
    ]));
}

$conn->set_charset("utf8mb4");
?>
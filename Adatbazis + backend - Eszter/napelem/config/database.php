<?php
$host = 'localhost';
$username = 'root';
$password = '';
$database = 'napelemrendszer';

$conn = new mysqli($host, $username, $password, $database);

if ($conn->connect_error) {
    die(json_encode([
        "success" => false,
        "error" => "Adatbázis kapcsolat hiba: " . $conn->connect_error
    ]));
}

$conn->set_charset("utf8mb4");
?>
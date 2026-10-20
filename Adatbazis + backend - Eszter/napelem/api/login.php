<?php
/* POST /api/login.php   {"username": "...", "password": "..."}
   Válasz: {"success": true, "user": {"id": 1, "username": "...", "role": "..."}}
   A frontendek (login.js) ezt a formát várják. */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth.php';
require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Nem támogatott metódus!"], JSON_UNESCAPED_UNICODE);
    exit;
}

$input = keres_torzs();
$username = trim((string)($input['username'] ?? ''));
$password = (string)($input['password'] ?? '');

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(["error" => "Add meg a felhasználónevet és a jelszót."], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt = $conn->prepare("SELECT id, username, password, role FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

// Szándékosan ugyanaz a hibaüzenet hibás névre és hibás jelszóra:
// így nem lehet kitalálni, melyik felhasználónév létezik.
$hibas = ["error" => "Hibás felhasználónév vagy jelszó."];

if (!$row) {
    http_response_code(401);
    echo json_encode($hibas, JSON_UNESCAPED_UNICODE);
    exit;
}

$tarolt = (string)$row['password'];
$rendben = password_verify($password, $tarolt);

// Átmeneti visszafelé-kompatibilitás: a users.php korábban nyílt szövegként
// mentette a jelszót. Ha ilyen régi sorba futunk, elfogadjuk, de azonnal
// hash-re cseréljük. Új adatbázisban (napelemrendszer.sql) ez sosem fut le.
if (!$rendben && $tarolt === $password) {
    $rendben = true;
    $uj = password_hash($password, PASSWORD_DEFAULT);
    $up = $conn->prepare("UPDATE users SET password = ? WHERE id = ?");
    $up->bind_param("si", $uj, $row['id']);
    $up->execute();
    $up->close();
}

if (!$rendben) {
    http_response_code(401);
    echo json_encode($hibas, JSON_UNESCAPED_UNICODE);
    exit;
}

$user = [
    "id"       => (int)$row['id'],
    "username" => $row['username'],
    "role"     => $row['role'],
];

// Session-fixation ellen: új azonosító a sikeres belépés után.
session_regenerate_id(true);
$_SESSION['user'] = $user;

echo json_encode(["success" => true, "user" => $user], JSON_UNESCAPED_UNICODE);

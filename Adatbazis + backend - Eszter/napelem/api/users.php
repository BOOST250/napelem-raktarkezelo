<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth.php';
kotelezo_bejelentkezes(['admin']);   // felhasználókezelés csak adminnak


require_once __DIR__ . '/../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sql = "SELECT id, username, role, created_at FROM users ORDER BY id ASC";
    $result = $conn->query($sql);
    $users = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }
    }
    echo json_encode($users, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['username']) || !isset($input['password']) || !isset($input['role'])) {
        http_response_code(400);
        echo json_encode(["error" => "Hiányzó kötelező mező: username, password vagy role"]);
        exit;
    }
    $username = $input['username'];
    // a jelszó csak hash-elve kerül az adatbázisba (bejelentkezéskor password_verify ellenőrzi)
    $password = password_hash($input['password'], PASSWORD_DEFAULT);
    $role = $input['role'];

    $check = $conn->prepare("SELECT id FROM users WHERE username = ?");
    $check->bind_param("s", $username);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows > 0) {
        http_response_code(409);
        echo json_encode(["error" => "Ez a felhasználónév már létezik!"]);
        exit;
    }
    $check->close();

    $stmt = $conn->prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $username, $password, $role);

    if ($stmt->execute()) {
        $new_id = $conn->insert_id;
        http_response_code(201);
        echo json_encode([
            "success" => true,
            "message" => "Felhasználó sikeresen létrehozva!",
            "id" => $new_id
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Adatbázis hiba: " . $stmt->error]);
    }
    $stmt->close();
    exit;
}

if ($method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($_GET['id'])) {
        http_response_code(400);
        echo json_encode(["error" => "Hiányzó felhasználó ID!"]);
        exit;
    }

    $id = intval($_GET['id']);

    $check = $conn->prepare("SELECT id FROM users WHERE id = ?");
    $check->bind_param("i", $id);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(["error" => "Nincs ilyen felhasználó!"]);
        exit;
    }
    $check->close();

    $fields = [];
    $params = [];
    $types = "";

    if (isset($input['username'])) {
        $fields[] = "username = ?";
        $params[] = $input['username'];
        $types .= "s";
    }
    if (isset($input['password'])) {
        $fields[] = "password = ?";
        $params[] = password_hash($input['password'], PASSWORD_DEFAULT);
        $types .= "s";
    }
    if (isset($input['role'])) {
        $fields[] = "role = ?";
        $params[] = $input['role'];
        $types .= "s";
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(["error" => "Nincs módosítandó mező!"]);
        exit;
    }

    $sql = "UPDATE users SET " . implode(", ", $fields) . " WHERE id = ?";
    $params[] = $id;
    $types .= "i";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Felhasználó sikeresen módosítva!",
            "id" => $id
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Adatbázis hiba: " . $stmt->error]);
    }
    $stmt->close();
    exit;
}

if ($method === 'DELETE') {
    if (!isset($_GET['id'])) {
        http_response_code(400);
        echo json_encode(["error" => "Hiányzó felhasználó ID!"]);
        exit;
    }

    $id = intval($_GET['id']);

    $check = $conn->prepare("SELECT id FROM users WHERE id = ?");
    $check->bind_param("i", $id);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(["error" => "Nincs ilyen felhasználó!"]);
        exit;
    }
    $check->close();

    $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Felhasználó sikeresen törölve!",
            "id" => $id
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Adatbázis hiba: " . $stmt->error]);
    }
    $stmt->close();
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Nem támogatott metódus!"]);
?>
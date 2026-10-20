<?php
require_once __DIR__ . '/cors.php';


require_once __DIR__ . '/../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sql = "SELECT * FROM parts ORDER BY id ASC";
    $result = $conn->query($sql);
    $parts = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $parts[] = $row;
        }
    }
    echo json_encode($parts, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['name']) || !isset($input['price']) || !isset($input['max_per_bin'])) {
        http_response_code(400);
        echo json_encode(["error" => "Hiányzó kötelező mező: name, price vagy max_per_bin"]);
        exit;
    }
    $name = $input['name'];
    $price = $input['price'];
    $max_per_bin = $input['max_per_bin'];

    $stmt = $conn->prepare("INSERT INTO parts (name, price, max_per_bin) VALUES (?, ?, ?)");
    $stmt->bind_param("sdi", $name, $price, $max_per_bin);

    if ($stmt->execute()) {
        $new_id = $conn->insert_id;
        http_response_code(201);
        echo json_encode([
            "success" => true,
            "message" => "Alkatrész sikeresen létrehozva!",
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
        echo json_encode(["error" => "Hiányzó alkatrész ID!"]);
        exit;
    }

    $id = intval($_GET['id']);

    $check = $conn->prepare("SELECT id FROM parts WHERE id = ?");
    $check->bind_param("i", $id);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(["error" => "Nincs ilyen alkatrész!"]);
        exit;
    }
    $check->close();

    $fields = [];
    $params = [];
    $types = "";

    if (isset($input['name'])) {
        $fields[] = "name = ?";
        $params[] = $input['name'];
        $types .= "s";
    }
    if (isset($input['price'])) {
        $fields[] = "price = ?";
        $params[] = $input['price'];
        $types .= "d";
    }
    if (isset($input['max_per_bin'])) {
        $fields[] = "max_per_bin = ?";
        $params[] = $input['max_per_bin'];
        $types .= "i";
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(["error" => "Nincs módosítandó mező!"]);
        exit;
    }

    $sql = "UPDATE parts SET " . implode(", ", $fields) . " WHERE id = ?";
    $params[] = $id;
    $types .= "i";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Alkatrész sikeresen módosítva!",
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
        echo json_encode(["error" => "Hiányzó alkatrész ID!"]);
        exit;
    }

    $id = intval($_GET['id']);

    $check = $conn->prepare("SELECT id FROM parts WHERE id = ?");
    $check->bind_param("i", $id);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(["error" => "Nincs ilyen alkatrész!"]);
        exit;
    }
    $check->close();

    $stmt = $conn->prepare("DELETE FROM parts WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Alkatrész sikeresen törölve!",
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
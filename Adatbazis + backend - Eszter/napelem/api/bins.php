<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth.php';
kotelezo_bejelentkezes();   // bármelyik bejelentkezett felhasználó


require_once __DIR__ . '/../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sql = "SELECT * FROM bins ORDER BY row_num, col_num, level_num ASC";
    $result = $conn->query($sql);
    $bins = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $bins[] = $row;
        }
    }
    echo json_encode($bins, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['row_num']) || !isset($input['col_num']) || !isset($input['level_num']) || !isset($input['identifier']) || !isset($input['max_capacity'])) {
        http_response_code(400);
        echo json_encode(["error" => "Hiányzó kötelező mező: row_num, col_num, level_num, identifier vagy max_capacity"]);
        exit;
    }
    $row_num = $input['row_num'];
    $col_num = $input['col_num'];
    $level_num = $input['level_num'];
    $identifier = $input['identifier'];
    $max_capacity = $input['max_capacity'];
    $part_id = $input['part_id'] ?? null;
    $quantity = $input['quantity'] ?? 0;

    $stmt = $conn->prepare("INSERT INTO bins (row_num, col_num, level_num, identifier, part_id, quantity, max_capacity) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("iiisiii", $row_num, $col_num, $level_num, $identifier, $part_id, $quantity, $max_capacity);

    if ($stmt->execute()) {
        $new_id = $conn->insert_id;
        http_response_code(201);
        echo json_encode([
            "success" => true,
            "message" => "Rekesz sikeresen létrehozva!",
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
        echo json_encode(["error" => "Hiányzó rekesz ID!"]);
        exit;
    }

    $id = intval($_GET['id']);

    $check = $conn->prepare("SELECT id FROM bins WHERE id = ?");
    $check->bind_param("i", $id);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(["error" => "Nincs ilyen rekesz!"]);
        exit;
    }
    $check->close();

    $fields = [];
    $params = [];
    $types = "";

    if (isset($input['part_id'])) {
        $fields[] = "part_id = ?";
        $params[] = $input['part_id'];
        $types .= "i";
    }
    if (isset($input['quantity'])) {
        $fields[] = "quantity = ?";
        $params[] = $input['quantity'];
        $types .= "i";
    }
    if (isset($input['max_capacity'])) {
        $fields[] = "max_capacity = ?";
        $params[] = $input['max_capacity'];
        $types .= "i";
    }
    if (isset($input['identifier'])) {
        $fields[] = "identifier = ?";
        $params[] = $input['identifier'];
        $types .= "s";
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(["error" => "Nincs módosítandó mező!"]);
        exit;
    }

    $sql = "UPDATE bins SET " . implode(", ", $fields) . " WHERE id = ?";
    $params[] = $id;
    $types .= "i";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Rekesz sikeresen módosítva!",
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
        echo json_encode(["error" => "Hiányzó rekesz ID!"]);
        exit;
    }

    $id = intval($_GET['id']);

    $check = $conn->prepare("SELECT id FROM bins WHERE id = ?");
    $check->bind_param("i", $id);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(["error" => "Nincs ilyen rekesz!"]);
        exit;
    }
    $check->close();

    $stmt = $conn->prepare("DELETE FROM bins WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Rekesz sikeresen törölve!",
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
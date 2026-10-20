<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth.php';
kotelezo_bejelentkezes();   // bármelyik bejelentkezett felhasználó


require_once __DIR__ . '/../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sql = "SELECT pp.project_id, pp.part_id, pp.quantity, pp.reserved, pp.reserved_at, p.name AS part_name, p.price AS part_price FROM project_parts pp JOIN parts p ON pp.part_id = p.id ORDER BY pp.project_id ASC";
    $result = $conn->query($sql);
    $project_parts = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $project_parts[] = $row;
        }
    }
    echo json_encode($project_parts, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['project_id']) || !isset($input['part_id']) || !isset($input['quantity'])) {
        http_response_code(400);
        echo json_encode(["error" => "Hiányzó kötelező mező: project_id, part_id vagy quantity"]);
        exit;
    }
    $project_id = $input['project_id'];
    $part_id = $input['part_id'];
    $quantity = $input['quantity'];

    $stmt = $conn->prepare("INSERT INTO project_parts (project_id, part_id, quantity) VALUES (?, ?, ?)");
    $stmt->bind_param("iii", $project_id, $part_id, $quantity);

    if ($stmt->execute()) {
        http_response_code(201);
        echo json_encode([
            "success" => true,
            "message" => "Alkatrész hozzárendelve a projekthez!",
            "project_id" => $project_id,
            "part_id" => $part_id
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

    if (!isset($_GET['project_id']) || !isset($_GET['part_id'])) {
        http_response_code(400);
        echo json_encode(["error" => "Hiányzó project_id vagy part_id!"]);
        exit;
    }

    $project_id = intval($_GET['project_id']);
    $part_id = intval($_GET['part_id']);

    $fields = [];
    $params = [];
    $types = "";

    if (isset($input['quantity'])) {
        $fields[] = "quantity = ?";
        $params[] = $input['quantity'];
        $types .= "i";
    }
    if (isset($input['reserved'])) {
        $fields[] = "reserved = ?";
        $params[] = $input['reserved'];
        $types .= "i";
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(["error" => "Nincs módosítandó mező!"]);
        exit;
    }

    $sql = "UPDATE project_parts SET " . implode(", ", $fields) . " WHERE project_id = ? AND part_id = ?";
    $params[] = $project_id;
    $params[] = $part_id;
    $types .= "ii";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Projekt-alkatrész kapcsolat módosítva!",
            "project_id" => $project_id,
            "part_id" => $part_id
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Adatbázis hiba: " . $stmt->error]);
    }
    $stmt->close();
    exit;
}

if ($method === 'DELETE') {
    if (!isset($_GET['project_id']) || !isset($_GET['part_id'])) {
        http_response_code(400);
        echo json_encode(["error" => "Hiányzó project_id vagy part_id!"]);
        exit;
    }

    $project_id = intval($_GET['project_id']);
    $part_id = intval($_GET['part_id']);

    $stmt = $conn->prepare("DELETE FROM project_parts WHERE project_id = ? AND part_id = ?");
    $stmt->bind_param("ii", $project_id, $part_id);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Projekt-alkatrész kapcsolat törölve!",
            "project_id" => $project_id,
            "part_id" => $part_id
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
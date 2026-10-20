<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth.php';
kotelezo_bejelentkezes();   // bármelyik bejelentkezett felhasználó


require_once __DIR__ . '/../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sql = "SELECT * FROM project_history ORDER BY changed_at DESC";
    $result = $conn->query($sql);
    $history = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $history[] = $row;
        }
    }
    echo json_encode($history, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['project_id']) || !isset($input['status'])) {
        http_response_code(400);
        echo json_encode(["error" => "Hiányzó kötelező mező: project_id vagy status"]);
        exit;
    }
    $project_id = $input['project_id'];
    $status = $input['status'];

    $stmt = $conn->prepare("INSERT INTO project_history (project_id, status) VALUES (?, ?)");
    $stmt->bind_param("is", $project_id, $status);

    if ($stmt->execute()) {
        http_response_code(201);
        echo json_encode([
            "success" => true,
            "message" => "Státusz naplózva!",
            "id" => $conn->insert_id
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
        echo json_encode(["error" => "Hiányzó napló ID!"]);
        exit;
    }

    $id = intval($_GET['id']);

    $stmt = $conn->prepare("DELETE FROM project_history WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Naplóbejegyzés törölve!",
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
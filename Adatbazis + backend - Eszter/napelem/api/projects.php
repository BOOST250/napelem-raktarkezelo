<?php
require_once __DIR__ . '/cors.php';


require_once __DIR__ . '/../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sql = "SELECT * FROM projects ORDER BY created_at DESC";
    $result = $conn->query($sql);
    $projects = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $projects[] = $row;
        }
    }
    echo json_encode($projects, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['location']) || !isset($input['customer_name'])) {
        http_response_code(400);
        echo json_encode(["error" => "Hiányzó kötelező mező: location vagy customer_name"]);
        exit;
    }
    $location = $input['location'];
    $description = $input['description'] ?? '';
    $customer_name = $input['customer_name'];
    $customer_email = $input['customer_email'] ?? null;
    $customer_phone = $input['customer_phone'] ?? null;

    $stmt = $conn->prepare("INSERT INTO projects (location, description, customer_name, customer_email, customer_phone, status) VALUES (?, ?, ?, ?, ?, 'New')");
    $stmt->bind_param("sssss", $location, $description, $customer_name, $customer_email, $customer_phone);

    if ($stmt->execute()) {
        $new_id = $conn->insert_id;
        http_response_code(201);
        echo json_encode([
            "success" => true,
            "message" => "Projekt sikeresen létrehozva!",
            "id" => $new_id
        ]);

        $historyStmt = $conn->prepare("INSERT INTO project_history (project_id, status) VALUES (?, 'New')");
        $historyStmt->bind_param("i", $new_id);
        $historyStmt->execute();
        $historyStmt->close();
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
        echo json_encode(["error" => "Hiányzó projekt ID!"]);
        exit;
    }

    $id = intval($_GET['id']);

    $check = $conn->prepare("SELECT id FROM projects WHERE id = ?");
    $check->bind_param("i", $id);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(["error" => "Nincs ilyen projekt!"]);
        exit;
    }
    $check->close();

    $fields = [];
    $params = [];
    $types = "";

    if (isset($input['location'])) {
        $fields[] = "location = ?";
        $params[] = $input['location'];
        $types .= "s";
    }
    if (isset($input['description'])) {
        $fields[] = "description = ?";
        $params[] = $input['description'];
        $types .= "s";
    }
    if (isset($input['customer_name'])) {
        $fields[] = "customer_name = ?";
        $params[] = $input['customer_name'];
        $types .= "s";
    }
    if (isset($input['status'])) {
        $fields[] = "status = ?";
        $params[] = $input['status'];
        $types .= "s";
    }
    if (isset($input['work_hours'])) {
        $fields[] = "work_hours = ?";
        $params[] = $input['work_hours'];
        $types .= "d";
    }
    if (isset($input['labor_cost'])) {
        $fields[] = "labor_cost = ?";
        $params[] = $input['labor_cost'];
        $types .= "d";
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(["error" => "Nincs módosítandó mező!"]);
        exit;
    }

    $sql = "UPDATE projects SET " . implode(", ", $fields) . " WHERE id = ?";
    $params[] = $id;
    $types .= "i";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Projekt sikeresen módosítva!",
            "id" => $id
        ]);

        if (isset($input['status'])) {
            $historyStmt = $conn->prepare("INSERT INTO project_history (project_id, status) VALUES (?, ?)");
            $historyStmt->bind_param("is", $id, $input['status']);
            $historyStmt->execute();
            $historyStmt->close();
        }
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
        echo json_encode(["error" => "Hiányzó projekt ID!"]);
        exit;
    }

    $id = intval($_GET['id']);

    $check = $conn->prepare("SELECT id FROM projects WHERE id = ?");
    $check->bind_param("i", $id);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(["error" => "Nincs ilyen projekt!"]);
        exit;
    }
    $check->close();

    $stmt = $conn->prepare("DELETE FROM projects WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Projekt sikeresen törölve!",
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
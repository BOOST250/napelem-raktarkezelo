<?php
/* PUT /api/project_contact.php?id=1
   { "customer_email": "pelda@email.hu", "customer_phone": "+36 30 123 4567" }

   Az ügyfél e-mailje és telefonszáma. A projects.php PUT-ja ezeket
   a mezőket nem írja (location, description, customer_name, status,
   work_hours, labor_cost van benne). Üres sztring NULL-t jelent.
   A projects.php változatlan. */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/SpecialistProjectService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(["error" => "Nem támogatott metódus!"], JSON_UNESCAPED_UNICODE);
    exit;
}

kotelezo_bejelentkezes(['specialist', 'admin']);

if (!isset($_GET['id'])) {
    http_response_code(400);
    echo json_encode(["error" => "Hiányzó projekt ID!"], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $input = keres_torzs();
    if (!array_key_exists('customer_email', $input) || !array_key_exists('customer_phone', $input)) {
        http_response_code(400);
        echo json_encode(
            ["error" => "A customer_email és a customer_phone mező is kell (üresen is hagyható)."],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }
    $szolgaltatas = new SpecialistProjectService($conn);
    $valasz = $szolgaltatas->updateContact(
        (int)$_GET['id'],
        $input['customer_email'],
        $input['customer_phone']
    );
    echo json_encode($valasz, JSON_UNESCAPED_UNICODE);
} catch (SpecialistException $e) {
    http_response_code($e->httpStatus());
    echo json_encode(["error" => $e->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["error" => "Adatbázis hiba: " . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

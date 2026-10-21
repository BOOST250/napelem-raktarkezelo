<?php
/* POST /api/project_assign.php
   { "project_id": 1, "part_id": 2, "quantity": 4 }

   Alkatrész rendelése a projekthez (A.4). Ha van elég szabad készlet,
   lefoglalja; ha nincs, előfoglalásként menti. Az első tétel az Új
   projektet Tervezetre lépteti. A project_history táblát állapotváltáskor
   tölti. A projects.php és a project_parts.php változatlan. */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/SpecialistProjectService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Nem támogatott metódus!"], JSON_UNESCAPED_UNICODE);
    exit;
}

kotelezo_bejelentkezes(['specialist', 'admin']);

try {
    $input = keres_torzs();
    $szolgaltatas = new SpecialistProjectService($conn);
    $valasz = $szolgaltatas->assignPart(
        (int)($input['project_id'] ?? 0),
        (int)($input['part_id'] ?? 0),
        $input['quantity'] ?? null
    );
    echo json_encode($valasz, JSON_UNESCAPED_UNICODE);
} catch (SpecialistException $e) {
    http_response_code($e->httpStatus());
    echo json_encode(["error" => $e->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["error" => "Adatbázis hiba: " . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

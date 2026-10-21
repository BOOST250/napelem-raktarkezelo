<?php
/* POST /api/project_quote.php
   { "project_id": 1 }

   Árkalkuláció (A.6). A foglalható előfoglalásokat lefoglalja.
   Hiányzó készlet → Wait. Minden tétel foglalt és a munkadíj megvan
   → Scheduled. Az állapotváltás a project_history táblába kerül.
   A projects.php változatlan. */

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
    $valasz = $szolgaltatas->calculateQuote((int)($input['project_id'] ?? 0));
    echo json_encode($valasz, JSON_UNESCAPED_UNICODE);
} catch (SpecialistException $e) {
    http_response_code($e->httpStatus());
    echo json_encode(["error" => $e->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["error" => "Adatbázis hiba: " . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

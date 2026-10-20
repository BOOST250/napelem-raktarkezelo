<?php
/* =====================================================================
   POST /api/receiving.php  – bevételezés (új készlet a raktárba)

   Kérés:
     { "part_id": 1,
       "items": [ {"bin_id": 3, "quantity": 4}, {"bin_id": 4, "quantity": 10} ] }

   Válasz:
     { "success": true,
       "received": 14,
       "reserved": 20,
       "scheduled_projects": [ {"id": 2, "name": "Nagy és Társa Kft. – Budaörs"} ] }

   Miért kell ehhez külön PHP végpont (a többi művelet megoldható a
   meglévő táblavégpontokkal)?  Mert a bevételezés három dolgot ír:
   rekeszeket, foglalásokat és projektstátuszt. Ha ez több HTTP-kérésre
   bomlik, egy félbeszakadás inkonzisztens adatbázist hagy maga után.
   Ezért itt minden EGY tranzakcióban fut.
   ===================================================================== */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Nem támogatott metódus!"], JSON_UNESCAPED_UNICODE);
    exit;
}

// Bevételezni a raktárvezető (és az admin) jogosult.
kotelezo_bejelentkezes(['warehouse_manager', 'admin']);

$input   = keres_torzs();
$part_id = isset($input['part_id']) ? (int)$input['part_id'] : 0;
$items   = $input['items'] ?? null;

if ($part_id <= 0 || !is_array($items) || $items === []) {
    http_response_code(400);
    echo json_encode(["error" => "Hiányzó vagy érvénytelen adat: part_id és items kötelező."],
        JSON_UNESCAPED_UNICODE);
    exit;
}

// Ugyanaz a rekesz többször is szerepelhet a kérésben – összevonjuk,
// különben a kapacitás-ellenőrzés külön-külön átengedné őket.
$tetelek = [];
foreach ($items as $item) {
    $bin_id = isset($item['bin_id']) ? (int)$item['bin_id'] : 0;
    $darab  = isset($item['quantity']) ? (int)$item['quantity'] : 0;
    if ($bin_id <= 0 || $darab <= 0) {
        http_response_code(400);
        echo json_encode(["error" => "Minden tételnél kell érvényes bin_id és pozitív quantity."],
            JSON_UNESCAPED_UNICODE);
        exit;
    }
    $tetelek[$bin_id] = ($tetelek[$bin_id] ?? 0) + $darab;
}

/** Hiba a tranzakció közben: visszaállítás és válasz. */
function elszall(mysqli $conn, int $kod, string $uzenet): void
{
    $conn->rollback();
    http_response_code($kod);
    echo json_encode(["error" => $uzenet], JSON_UNESCAPED_UNICODE);
    exit;
}

$AKTIV = "'New','Draft','Wait','Scheduled','InProgress'"; // = nem Completed és nem Failed

$conn->begin_transaction();

try {
    // -----------------------------------------------------------------
    // 1. Az alkatrész
    // -----------------------------------------------------------------
    $stmt = $conn->prepare("SELECT id, name, max_per_bin FROM parts WHERE id = ? FOR UPDATE");
    $stmt->bind_param("i", $part_id);
    $stmt->execute();
    $part = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$part) {
        elszall($conn, 404, "Nincs ilyen alkatrész (id: $part_id).");
    }
    $max_per_bin = (int)$part['max_per_bin'];

    // -----------------------------------------------------------------
    // 2. ELŐBB minden tételt ellenőrzünk, csak utána írunk.
    //    Így részben végrehajtott bevételezés nem fordulhat elő.
    // -----------------------------------------------------------------
    $ellenorzott = [];
    foreach ($tetelek as $bin_id => $darab) {
        $stmt = $conn->prepare(
            "SELECT id, row_num, col_num, level_num, identifier, part_id, quantity, max_capacity
             FROM bins WHERE id = ? FOR UPDATE");
        $stmt->bind_param("i", $bin_id);
        $stmt->execute();
        $bin = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$bin) {
            elszall($conn, 404, "Nincs ilyen rekesz (id: $bin_id).");
        }

        // Az azonosító (pl. "A2-3") a beszédes név, a koordináták csak kiegészítésként.
        $hely = "{$bin['identifier']} ({$bin['row_num']}. sor, {$bin['col_num']}. oszlop, {$bin['level_num']}. polc)";

        // Egy rekeszben csak egyfajta alkatrész lehet.
        if ($bin['part_id'] !== null && (int)$bin['part_id'] !== $part_id) {
            elszall($conn, 409, "A(z) „{$hely}” rekeszben már más alkatrész van, ide nem lehet bevételezni.");
        }

        // A két kapacitáskorlát közül a kisebb a határ.
        $hatar = min($max_per_bin, (int)$bin['max_capacity']);
        $uj    = (int)$bin['quantity'] + $darab;
        if ($uj > $hatar) {
            $szabad = $hatar - (int)$bin['quantity'];
            elszall($conn, 409,
                "A(z) „{$hely}” rekeszbe csak $szabad db férne még ebből az alkatrészből " .
                "(korlát: $hatar db), de $darab db-ot adtál meg.");
        }

        $ellenorzott[] = ['bin_id' => (int)$bin_id, 'uj_darab' => $uj, 'hozzaadva' => $darab];
    }

    // -----------------------------------------------------------------
    // 3. Rekeszek frissítése
    // -----------------------------------------------------------------
    $stmt = $conn->prepare("UPDATE bins SET part_id = ?, quantity = ? WHERE id = ?");
    $bevetelezve = 0;
    foreach ($ellenorzott as $e) {
        $stmt->bind_param("iii", $part_id, $e['uj_darab'], $e['bin_id']);
        $stmt->execute();
        $bevetelezve += $e['hozzaadva'];
    }
    $stmt->close();

    // -----------------------------------------------------------------
    // 4. Automatikus foglalás a szabad készletből
    //    szabad = összes készlet − aktív projektek foglalásai
    // -----------------------------------------------------------------
    $stmt = $conn->prepare("SELECT COALESCE(SUM(quantity), 0) AS db FROM bins WHERE part_id = ?");
    $stmt->bind_param("i", $part_id);
    $stmt->execute();
    $keszlet = (int)$stmt->get_result()->fetch_assoc()['db'];
    $stmt->close();

    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(pp.quantity), 0) AS db
         FROM project_parts pp
         JOIN projects p ON p.id = pp.project_id
         WHERE pp.part_id = ? AND pp.reserved = 1 AND p.status IN ($AKTIV)");
    $stmt->bind_param("i", $part_id);
    $stmt->execute();
    $lefoglalt = (int)$stmt->get_result()->fetch_assoc()['db'];
    $stmt->close();

    $szabad = $keszlet - $lefoglalt;

    // Sorrend: előbb a Wait státuszú projektek (ezek már csak alkatrészre
    // várnak), aztán a Draft-ok; azon belül a régebbi igény elsőbbséget kap.
    $stmt = $conn->prepare(
        "SELECT pp.project_id, pp.quantity, p.status, p.customer_name, p.location
         FROM project_parts pp
         JOIN projects p ON p.id = pp.project_id
         WHERE pp.part_id = ? AND pp.reserved = 0 AND p.status IN ('Wait','Draft')
         ORDER BY FIELD(p.status, 'Wait', 'Draft'), p.created_at ASC, p.id ASC
         FOR UPDATE");
    $stmt->bind_param("i", $part_id);
    $stmt->execute();
    $jeloltek = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $foglal = $conn->prepare(
        "UPDATE project_parts SET reserved = 1, reserved_at = NOW()
         WHERE project_id = ? AND part_id = ?");

    $osszes_foglalt = 0;
    $erintett = [];   // project_id => [status, nev]

    foreach ($jeloltek as $j) {
        $kell = (int)$j['quantity'];
        // A reserved logikai mező, ezért a foglalás mindent-vagy-semmi:
        // ha nem futja a teljes tételre, ezt a projektet kihagyjuk, de a
        // sorban utána következő kisebb igény még kielégíthető.
        if ($kell > $szabad) {
            continue;
        }
        $pid = (int)$j['project_id'];
        $foglal->bind_param("ii", $pid, $part_id);
        $foglal->execute();

        $szabad        -= $kell;
        $osszes_foglalt += $kell;
        $erintett[$pid] = [
            'status' => $j['status'],
            'nev'    => trim($j['customer_name'] . ' – ' . $j['location']),
        ];
    }
    $foglal->close();

    // -----------------------------------------------------------------
    // 5. Státuszváltás: ha egy Wait projekt minden tétele lefoglalt lett,
    //    ütemezhető. A naplózás ugyanúgy megy, mint a projects.php PUT-jában.
    // -----------------------------------------------------------------
    $utemezett = [];

    if ($erintett !== []) {
        $maradek = $conn->prepare(
            "SELECT COUNT(*) AS db FROM project_parts WHERE project_id = ? AND reserved = 0");
        $statusz = $conn->prepare("UPDATE projects SET status = 'Scheduled' WHERE id = ?");
        $naplo   = $conn->prepare(
            "INSERT INTO project_history (project_id, status) VALUES (?, 'Scheduled')");

        foreach ($erintett as $pid => $adat) {
            if ($adat['status'] !== 'Wait') {
                continue;   // Draft-ból nem ütemezünk, az még nincs véglegesítve
            }
            $maradek->bind_param("i", $pid);
            $maradek->execute();
            if ((int)$maradek->get_result()->fetch_assoc()['db'] > 0) {
                continue;   // még hiányzik valami
            }
            $statusz->bind_param("i", $pid);
            $statusz->execute();
            $naplo->bind_param("i", $pid);
            $naplo->execute();

            $utemezett[] = ['id' => $pid, 'name' => $adat['nev']];
        }

        $maradek->close();
        $statusz->close();
        $naplo->close();
    }

    $conn->commit();

    echo json_encode([
        "success"            => true,
        "message"            => "Bevételezés rögzítve: $bevetelezve db " . $part['name'] . ".",
        "received"           => $bevetelezve,
        "reserved"           => $osszes_foglalt,
        "scheduled_projects" => $utemezett,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => "Adatbázis hiba: " . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

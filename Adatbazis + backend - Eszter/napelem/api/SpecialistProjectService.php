<?php
/**
 * Szakemberi projektműveletek (A.4, A.6, A.7 és az ügyfél elérhetősége).
 *
 * A meglévő projects.php / project_parts.php végpontokhoz nem nyúlunk.
 * Ezek a lépések egy tranzakcióban több táblát írnak (igény, foglalás,
 * státusz, project_history), ugyanabból az okból, amiért a bevételezés
 * külön végpont: félbeszakadt kérés nem hagyhat félkész foglalást.
 *
 * Állapotgép a feladatkiírás szerint:
 *   New        – létrejött a projekt, felmérés még nincs
 *   Draft      – felmérés, alkatrészek rendelése a projekthez
 *   Wait       – az árkalkuláció nem fejezhető be, mert nincs minden készleten
 *   Scheduled  – minden tétel lefoglalva, az árkalkuláció kész
 *   InProgress – a raktáros állítja kivételezéskor (C.1), itt nem
 *   Completed / Failed – a szakember zárja le, csak Folyamatban állapotból
 *
 * A `project_parts.reserved` logikai mező (mindent-vagy-semmit), ahogy a
 * receiving.php is használja. Elég szabad készlet → reserved = 1.
 * Különben a sor előfoglalás (reserved = 0), és a bevételezés foglalja le
 * később, Wait projekteknél automatikus Ütemezett átmenettel.
 *
 * Új PHP, objektumorientáltan. A beadandó PHP-t csak keretrendszerrel
 * fogad el; a csapat stackjét nem cseréljük le, a kockázat a PR-ban van.
 */

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(["error" => "Ez nem végpont."], JSON_UNESCAPED_UNICODE);
    exit;
}

class SpecialistException extends RuntimeException
{
    public function __construct(string $message, private int $httpStatus = 400)
    {
        parent::__construct($message);
    }

    public function httpStatus(): int
    {
        return $this->httpStatus;
    }
}

class SpecialistProjectService
{
    private const AKTIV = "('New','Draft','Wait','Scheduled','InProgress')";
    private const ALKATRESZ_ALLAPOT = ['New', 'Draft', 'Wait'];
    private const KALKULACIO_ALLAPOT = ['New', 'Draft', 'Wait'];

    public function __construct(private mysqli $conn)
    {
    }

    /**
     * Alkatrész rendelése a projekthez.
     * Szabad készletből lefoglal, hiány esetén előfoglal.
     * Az első tétel az Új projektet Tervezetre lépteti, és naplózza.
     *
     * @return array{success:bool,message:string,project_id:int,part_id:int,quantity:int,reserved:bool,status:string}
     */
    public function assignPart(int $projectId, int $partId, mixed $quantity): array
    {
        return $this->tranzakcio(function () use ($projectId, $partId, $quantity) {
            if ($projectId <= 0 || $partId <= 0) {
                throw new SpecialistException('Hiányzó vagy érvénytelen projekt- vagy alkatrészazonosító.');
            }
            $darab = $this->darab($quantity);

            $projekt = $this->projektZarolva($projectId);
            if (!in_array($projekt['status'], self::ALKATRESZ_ALLAPOT, true)) {
                throw new SpecialistException(
                    'Ebben az állapotban már nem módosítható az alkatrészlista.',
                    409
                );
            }

            $alkatresz = $this->elsoSor(
                $this->elokeszit('SELECT id, name, price FROM parts WHERE id = ? FOR UPDATE', 'i', $partId)
            );
            if ($alkatresz === null) {
                throw new SpecialistException('Nincs ilyen alkatrész.', 404);
            }

            $meglevo = $this->elsoSor($this->elokeszit(
                'SELECT part_id FROM project_parts WHERE project_id = ? AND part_id = ? FOR UPDATE',
                'ii',
                $projectId,
                $partId
            ));
            if ($meglevo !== null) {
                throw new SpecialistException(
                    'Ez az alkatrész már szerepel a projekt listáján – a mennyiséget a táblázatban módosítsd.',
                    409
                );
            }

            $beszur = $this->elokeszit(
                'INSERT INTO project_parts (project_id, part_id, quantity, reserved) VALUES (?, ?, ?, 0)',
                'iii',
                $projectId,
                $partId,
                $darab
            );
            $beszur->execute();
            if ($beszur->errno === 1062) {
                $beszur->close();
                throw new SpecialistException(
                    'Ez az alkatrész már szerepel a projekt listáján – a mennyiséget a táblázatban módosítsd.',
                    409
                );
            }
            if ($beszur->errno !== 0) {
                $hiba = $beszur->error;
                $beszur->close();
                throw new SpecialistException('Adatbázis hiba: ' . $hiba, 500);
            }
            $beszur->close();

            $szabad = $this->szabadKeszlet($partId);
            $foglalt = false;
            if ($szabad >= $darab) {
                $this->lefoglal($projectId, $partId);
                $foglalt = true;
            }

            $statusz = $projekt['status'];
            if ($statusz === 'New') {
                $this->statusz($projectId, 'Draft', 'New');
                $statusz = 'Draft';
            }

            if ($foglalt) {
                $uzenet = 'Az alkatrész lefoglalva a szabad készletből (' . $darab . ' db).';
            } else {
                $uzenet = 'Nincs elég szabad készlet (' . max($szabad, 0) . ' db). '
                    . 'Az igény előfoglalásként került rögzítésre; a bevételezés később automatikusan lefoglalja.';
            }
            if ($projekt['status'] === 'New') {
                $uzenet .= ' A projekt Tervezet állapotba lépett.';
            }

            return [
                'success' => true,
                'message' => $uzenet,
                'project_id' => $projectId,
                'part_id' => $partId,
                'quantity' => $darab,
                'reserved' => $foglalt,
                'status' => $statusz,
            ];
        });
    }

    /**
     * Árkalkuláció (A.6).
     * Ami még előfoglalás és már van rá készlet, azt lefoglalja.
     * Ha marad hiány → Wait. Ha minden foglalt és a munkadíj megvan → Scheduled.
     * Mindkét állapotváltás bekerül a project_history táblába.
     *
     * @return array<string, mixed>
     */
    public function calculateQuote(int $projectId): array
    {
        return $this->tranzakcio(function () use ($projectId) {
            if ($projectId <= 0) {
                throw new SpecialistException('Hiányzó vagy érvénytelen projektazonosító.');
            }
            $projekt = $this->projektZarolva($projectId);
            if (!in_array($projekt['status'], self::KALKULACIO_ALLAPOT, true)) {
                throw new SpecialistException(
                    'Árkalkuláció Új, Tervezet vagy Várakozik állapotban készíthető.',
                    409
                );
            }

            $sorok = $this->sorok($this->elokeszit(
                'SELECT pp.part_id, pp.quantity, pp.reserved, parts.name, parts.price
                 FROM project_parts pp
                 JOIN parts ON parts.id = pp.part_id
                 WHERE pp.project_id = ?
                 ORDER BY pp.part_id ASC
                 FOR UPDATE',
                'i',
                $projectId
            ));
            if ($sorok === []) {
                throw new SpecialistException('Előbb vegyél fel legalább egy alkatrészt.');
            }

            // A felmérés ezzel elkezdődött: Új → Tervezet, külön naplóbejegyzéssel,
            // utána jöhet a Várakozik vagy az Ütemezett lépés.
            if ($projekt['status'] === 'New') {
                $this->statusz($projectId, 'Draft', 'New');
                $projekt['status'] = 'Draft';
            }

            foreach ($sorok as $sor) {
                if ((int)$sor['reserved'] === 1) {
                    continue;
                }
                $partId = (int)$sor['part_id'];
                $this->elsoSor($this->elokeszit('SELECT id FROM parts WHERE id = ? FOR UPDATE', 'i', $partId));
                if ($this->szabadKeszlet($partId) >= (int)$sor['quantity']) {
                    $this->lefoglal($projectId, $partId);
                }
            }

            $friss = $this->sorok($this->elokeszit(
                'SELECT pp.part_id, pp.quantity, pp.reserved, parts.name, parts.price
                 FROM project_parts pp
                 JOIN parts ON parts.id = pp.part_id
                 WHERE pp.project_id = ?
                 ORDER BY pp.part_id ASC',
                'i',
                $projectId
            ));

            $hiany = [];
            $anyag = 0.0;
            foreach ($friss as $sor) {
                $ertek = round((float)$sor['price'] * (int)$sor['quantity'], 2);
                $anyag += $ertek;
                if ((int)$sor['reserved'] === 1) {
                    continue;
                }
                $szabad = $this->szabadKeszlet((int)$sor['part_id']);
                $hiany[] = [
                    'part_id' => (int)$sor['part_id'],
                    'name' => $sor['name'],
                    'quantity' => (int)$sor['quantity'],
                    'free' => max($szabad, 0),
                ];
            }
            $anyag = round($anyag, 2);
            $munkadij = ($projekt['labor_cost'] === null || $projekt['labor_cost'] === '')
                ? null
                : round((float)$projekt['labor_cost'], 2);

            if ($hiany !== []) {
                $this->statusz($projectId, 'Wait', $projekt['status']);
                $lista = array_map(
                    fn(array $m) => $m['name'] . ' (' . $m['quantity'] . ' db kell, szabad ' . $m['free'] . ')',
                    $hiany
                );
                return [
                    'success' => true,
                    'outcome' => 'wait',
                    'status' => 'Wait',
                    'message' => 'Az árkalkuláció nem fejezhető be, mert nincs minden alkatrész raktáron: '
                        . implode('; ', $lista)
                        . '. A projekt Várakozik állapotban van, a hiányzó tételek előfoglalva maradnak.',
                    'missing' => $hiany,
                    'material_cost' => null,
                    'labor_cost' => $munkadij,
                    'total' => null,
                ];
            }

            if (!$this->munkaMegvan($projekt)) {
                return [
                    'success' => true,
                    'outcome' => 'needs_labor',
                    'status' => $projekt['status'],
                    'message' => 'Minden alkatrész lefoglalva, az áruk ismert. '
                        . 'Az árkalkulációhoz rögzítsd a becsült munkaórát és a munkadíjat is.',
                    'missing' => [],
                    'material_cost' => $anyag,
                    'labor_cost' => $munkadij,
                    'total' => null,
                ];
            }

            $this->statusz($projectId, 'Scheduled', $projekt['status']);
            $osszesen = round($anyag + (float)$munkadij, 2);
            return [
                'success' => true,
                'outcome' => 'scheduled',
                'status' => 'Scheduled',
                'message' => 'Az árkalkuláció elkészült. Anyagköltség: ' . $this->ft($anyag)
                    . ', munkadíj: ' . $this->ft((float)$munkadij)
                    . ', összesen: ' . $this->ft($osszesen)
                    . '. A projekt Ütemezett állapotba került.',
                'missing' => [],
                'material_cost' => $anyag,
                'labor_cost' => $munkadij,
                'total' => $osszesen,
            ];
        });
    }

    /**
     * Lezárás (A.7). Csak Folyamatban → Befejezett vagy Sikertelen.
     * A Folyamatban állapotot a raktáros állítja (C.1). A váltás naplózva van.
     *
     * @return array{success:bool,message:string,project_id:int,status:string}
     */
    public function closeProject(int $projectId, string $status): array
    {
        return $this->tranzakcio(function () use ($projectId, $status) {
            if ($projectId <= 0) {
                throw new SpecialistException('Hiányzó vagy érvénytelen projektazonosító.');
            }
            if ($status !== 'Completed' && $status !== 'Failed') {
                throw new SpecialistException('A lezárás csak Befejezett vagy Sikertelen állapot lehet.');
            }
            $projekt = $this->projektZarolva($projectId);
            if ($projekt['status'] !== 'InProgress') {
                throw new SpecialistException(
                    'A projektet csak Folyamatban állapotból lehet lezárni. '
                    . 'Folyamatban állapotra a raktáros állítja, amikor a kivételezés elkezdődik.',
                    409
                );
            }
            $this->statusz($projectId, $status, 'InProgress');
            $nev = $status === 'Completed' ? 'Befejezett' : 'Sikertelen';
            return [
                'success' => true,
                'message' => 'A projekt lezárva: ' . $nev . '.',
                'project_id' => $projectId,
                'status' => $status,
            ];
        });
    }

    /**
     * Ügyfél e-mail és telefon. A projects.php PUT-ja ezeket a mezőket nem menti.
     *
     * @return array{success:bool,message:string,project_id:int,customer_email:?string,customer_phone:?string}
     */
    public function updateContact(int $projectId, mixed $email, mixed $phone): array
    {
        return $this->tranzakcio(function () use ($projectId, $email, $phone) {
            if ($projectId <= 0) {
                throw new SpecialistException('Hiányzó vagy érvénytelen projektazonosító.');
            }
            $projekt = $this->projektZarolva($projectId);
            if ($projekt['status'] === 'Completed' || $projekt['status'] === 'Failed') {
                throw new SpecialistException('A lezárt projekt adatai már nem módosíthatók.', 409);
            }

            $emailErtek = $this->elerhetoseg($email, 100, 'Az e-mail cím');
            $telefon = $this->elerhetoseg($phone, 20, 'A telefonszám');
            if ($emailErtek !== null && filter_var($emailErtek, FILTER_VALIDATE_EMAIL) === false) {
                throw new SpecialistException('Az e-mail cím formátuma érvénytelen.');
            }
            if ($telefon !== null && preg_match('/^[+0-9][0-9 +\-\/()]{4,19}$/u', $telefon) !== 1) {
                throw new SpecialistException(
                    'A telefonszám csak számot, szóközt és a + - / ( ) jeleket tartalmazhatja, legfeljebb 20 karakteren.'
                );
            }

            $emailMentes = $emailErtek ?? '';
            $telefonMentes = $telefon ?? '';
            $stmt = $this->elokeszit(
                "UPDATE projects SET customer_email = NULLIF(?, ''), customer_phone = NULLIF(?, '') WHERE id = ?",
                'ssi',
                $emailMentes,
                $telefonMentes,
                $projectId
            );
            $stmt->execute();
            if ($stmt->errno !== 0) {
                $hiba = $stmt->error;
                $stmt->close();
                throw new SpecialistException('Adatbázis hiba: ' . $hiba, 500);
            }
            $stmt->close();

            return [
                'success' => true,
                'message' => 'Az ügyfél elérhetősége mentve.',
                'project_id' => $projectId,
                'customer_email' => $emailErtek,
                'customer_phone' => $telefon,
            ];
        });
    }

    /** @param callable(): array<string, mixed> $muvelet */
    private function tranzakcio(callable $muvelet): array
    {
        if (!$this->conn->begin_transaction()) {
            throw new SpecialistException('Adatbázis hiba: a tranzakció nem indult el.', 500);
        }
        try {
            $eredmeny = $muvelet();
            $this->conn->commit();
            return $eredmeny;
        } catch (Throwable $e) {
            $this->conn->rollback();
            throw $e;
        }
    }

    /** @return array<string, mixed> */
    private function projektZarolva(int $projectId): array
    {
        $projekt = $this->elsoSor($this->elokeszit(
            'SELECT id, status, work_hours, labor_cost FROM projects WHERE id = ? FOR UPDATE',
            'i',
            $projectId
        ));
        if ($projekt === null) {
            throw new SpecialistException('Nincs ilyen projekt.', 404);
        }
        return $projekt;
    }

    private function szabadKeszlet(int $partId): int
    {
        $this->sorok($this->elokeszit('SELECT id FROM bins WHERE part_id = ? FOR UPDATE', 'i', $partId));
        $this->sorok($this->elokeszit(
            'SELECT project_id FROM project_parts WHERE part_id = ? FOR UPDATE',
            'i',
            $partId
        ));

        $keszlet = $this->elsoSor($this->elokeszit(
            'SELECT COALESCE(SUM(quantity), 0) AS db FROM bins WHERE part_id = ?',
            'i',
            $partId
        ));
        $foglalt = $this->elsoSor($this->elokeszit(
            'SELECT COALESCE(SUM(pp.quantity), 0) AS db
             FROM project_parts pp
             JOIN projects p ON p.id = pp.project_id
             WHERE pp.part_id = ? AND pp.reserved = 1 AND p.status IN ' . self::AKTIV,
            'i',
            $partId
        ));
        return (int)$keszlet['db'] - (int)$foglalt['db'];
    }

    private function lefoglal(int $projectId, int $partId): void
    {
        $stmt = $this->elokeszit(
            'UPDATE project_parts
             SET reserved = 1, reserved_at = NOW()
             WHERE project_id = ? AND part_id = ? AND reserved = 0',
            'ii',
            $projectId,
            $partId
        );
        $stmt->execute();
        if ($stmt->errno !== 0) {
            $hiba = $stmt->error;
            $stmt->close();
            throw new SpecialistException('Adatbázis hiba: ' . $hiba, 500);
        }
        $stmt->close();
    }

    /** Csak valódi váltáskor ír a naplóba, hogy ne legyen dupla sor. */
    private function statusz(int $projectId, string $uj, string $regi): void
    {
        if ($uj === $regi) {
            return;
        }
        $stmt = $this->elokeszit('UPDATE projects SET status = ? WHERE id = ?', 'si', $uj, $projectId);
        $stmt->execute();
        if ($stmt->errno !== 0) {
            $hiba = $stmt->error;
            $stmt->close();
            throw new SpecialistException('Adatbázis hiba: ' . $hiba, 500);
        }
        $stmt->close();

        $naplo = $this->elokeszit(
            'INSERT INTO project_history (project_id, status) VALUES (?, ?)',
            'is',
            $projectId,
            $uj
        );
        $naplo->execute();
        if ($naplo->errno !== 0) {
            $hiba = $naplo->error;
            $naplo->close();
            throw new SpecialistException('Adatbázis hiba: ' . $hiba, 500);
        }
        $naplo->close();
    }

    private function munkaMegvan(array $projekt): bool
    {
        if ($projekt['work_hours'] === null || $projekt['work_hours'] === '') {
            return false;
        }
        if ($projekt['labor_cost'] === null || $projekt['labor_cost'] === '') {
            return false;
        }
        return (float)$projekt['work_hours'] > 0 && (float)$projekt['labor_cost'] >= 0;
    }

    private function darab(mixed $quantity): int
    {
        if (!is_int($quantity) && !(is_string($quantity) && preg_match('/^\d+$/', $quantity) === 1) && !is_float($quantity)) {
            throw new SpecialistException('A mennyiség pozitív egész szám legyen.');
        }
        if (is_float($quantity) && floor($quantity) !== $quantity) {
            throw new SpecialistException('A mennyiség pozitív egész szám legyen.');
        }
        $darab = (int)$quantity;
        if ($darab < 1 || $darab > 100000) {
            throw new SpecialistException('A mennyiség 1 és 100000 db között lehet.');
        }
        return $darab;
    }

    private function elerhetoseg(mixed $ertek, int $max, string $nev): ?string
    {
        if ($ertek === null) {
            return null;
        }
        if (!is_string($ertek) && !is_numeric($ertek)) {
            throw new SpecialistException($nev . ' szöveget vár.');
        }
        $szoveg = trim((string)$ertek);
        if ($szoveg === '') {
            return null;
        }
        if (mb_strlen($szoveg) > $max) {
            throw new SpecialistException($nev . ' legfeljebb ' . $max . ' karakter lehet.');
        }
        return $szoveg;
    }

    private function ft(float $osszeg): string
    {
        $egesz = abs($osszeg - round($osszeg)) < 0.001;
        return number_format($osszeg, $egesz ? 0 : 2, ',', ' ') . ' Ft';
    }

    private function elokeszit(string $sql, string $tipus, mixed ...$ertekek): mysqli_stmt
    {
        $stmt = $this->conn->prepare($sql);
        if ($stmt === false) {
            throw new SpecialistException('Adatbázis hiba: ' . $this->conn->error, 500);
        }
        if ($tipus !== '') {
            $stmt->bind_param($tipus, ...$ertekek);
        }
        return $stmt;
    }

    /** @return array<string, mixed>|null */
    private function elsoSor(mysqli_stmt $stmt): ?array
    {
        $stmt->execute();
        if ($stmt->errno !== 0) {
            $hiba = $stmt->error;
            $stmt->close();
            throw new SpecialistException('Adatbázis hiba: ' . $hiba, 500);
        }
        $eredmeny = $stmt->get_result();
        $sor = $eredmeny->fetch_assoc() ?: null;
        $eredmeny->free();
        $stmt->close();
        return $sor;
    }

    /** @return list<array<string, mixed>> */
    private function sorok(mysqli_stmt $stmt): array
    {
        $stmt->execute();
        if ($stmt->errno !== 0) {
            $hiba = $stmt->error;
            $stmt->close();
            throw new SpecialistException('Adatbázis hiba: ' . $hiba, 500);
        }
        $eredmeny = $stmt->get_result();
        $sorok = $eredmeny->fetch_all(MYSQLI_ASSOC);
        $eredmeny->free();
        $stmt->close();
        return $sorok;
    }
}

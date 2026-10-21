<?php

declare(strict_types=1);

namespace Napelem\Service;

use Napelem\Database\ConnectionFactory;
use Napelem\Domain\ProjectStatus;
use Napelem\Http\ApiException;
use Napelem\Repository\BinRepository;
use Napelem\Repository\HistoryRepository;
use Napelem\Repository\MovementRepository;
use Napelem\Repository\ProjectPartRepository;
use Napelem\Repository\ProjectRepository;
use Napelem\Support\Validator;

/**
 * Raktárosi felület szerződése: teljes projektlista, kivételezés indítása
 * (csak Scheduled → InProgress), és a lefoglalt tételek rekeszhelyei.
 * Az útvonalat a böngésző számolja, a készletet ez a végpont nem csökkenti.
 */
final class PickingService
{
    public function __construct(
        private readonly ConnectionFactory $db,
        private readonly ProjectRepository $projects,
        private readonly ProjectPartRepository $lines,
        private readonly BinRepository $bins,
        private readonly HistoryRepository $history,
        private readonly MovementRepository $movements,
        private readonly RoutePlanner $routes,
    ) {
    }

    /** @return list<array<string, mixed>> */
    public function catalog(): array
    {
        $rows = [];
        foreach ($this->projects->workerCards() as $row) {
            $rows[] = $this->card($row);
        }

        return $rows;
    }

    /**
     * Scheduled projekt InProgress lesz, és egy history sor készül.
     * Már folyamatban lévő projektnél a státusz és a napló változatlan.
     *
     * @param array{id:int,username:string,role:string} $user
     * @return array<string, mixed>
     */
    public function begin(int $projectId, array $user): array
    {
        return $this->db->transaction(function () use ($projectId, $user) {
            $project = $this->projects->findForUpdate($projectId);
            if ($project === null) {
                throw new ApiException(404, 'Nincs ilyen projekt.');
            }

            $status = (string) $project['status'];
            if ($status === ProjectStatus::IN_PROGRESS) {
                return $this->startedCard($projectId, 'A kivételezés már folyamatban van.');
            }
            if ($status !== ProjectStatus::SCHEDULED) {
                throw new ApiException(409, 'Csak ütemezett (Scheduled) projekt kivételezése indítható.');
            }

            $this->projects->updateFields($projectId, ['status' => ProjectStatus::IN_PROGRESS]);
            $this->history->add($projectId, ProjectStatus::IN_PROGRESS, (int) $user['id']);

            return $this->startedCard($projectId, 'A projekt kivételezése elindult.');
        });
    }

    /** @return array<string, mixed> */
    public function places(int $projectId): array
    {
        $rows = $this->projects->workerCards($projectId);
        if ($rows === []) {
            throw new ApiException(404, 'Nincs ilyen projekt.');
        }
        $project = $rows[0];

        $parts = [];
        $partIds = [];
        foreach ($this->lines->all($projectId) as $line) {
            $partId = (int) $line['part_id'];
            $partIds[] = $partId;
            $parts[$partId] = [
                'part_id' => $partId,
                'name' => (string) $line['part_name'],
                'quantity' => (int) $line['quantity'],
                'reserved' => (int) $line['reserved'] === 1 ? 1 : 0,
                'bins' => [],
            ];
        }

        foreach ($this->bins->inStock($partIds) as $bin) {
            $partId = (int) $bin['part_id'];
            if (!isset($parts[$partId])) {
                continue;
            }
            $parts[$partId]['bins'][] = [
                'id' => (int) $bin['id'],
                'identifier' => (string) $bin['identifier'],
                'row_num' => (int) $bin['row_num'],
                'col_num' => (int) $bin['col_num'],
                'level_num' => (int) $bin['level_num'],
                'quantity' => (int) $bin['quantity'],
                'max_capacity' => (int) $bin['max_capacity'],
            ];
        }

        return [
            'project_id' => (int) $project['id'],
            'customer_name' => (string) $project['customer_name'],
            'location' => (string) $project['location'],
            'description' => $project['description'] === null ? null : (string) $project['description'],
            'status' => (string) $project['status'],
            'warehouse' => $this->bins->span(),
            'parts' => array_values($parts),
        ];
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function card(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'customer_name' => (string) $row['customer_name'],
            'location' => (string) $row['location'],
            'description' => $row['description'] === null ? null : (string) $row['description'],
            'status' => (string) $row['status'],
            'created_at' => $this->stamp($row['created_at']),
            'part_lines' => (int) $row['part_lines'],
            'reserved_lines' => (int) $row['reserved_lines'],
        ];
    }

    /** @return array<string, mixed> */
    private function startedCard(int $projectId, string $message): array
    {
        $rows = $this->projects->workerCards($projectId);
        if ($rows === []) {
            throw new ApiException(404, 'Nincs ilyen projekt.');
        }

        return ['success' => true, 'message' => $message] + $this->card($rows[0]);
    }

    private function stamp(mixed $value): string
    {
        $text = (string) $value;
        if (preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/', $text, $match) === 1) {
            return str_replace('T', ' ', substr($match[0], 0, 19));
        }

        return $text;
    }

    /** @return list<array<string, mixed>> */
    public function projects(?string $status = null): array
    {
        if ($status !== null && !in_array($status, [ProjectStatus::SCHEDULED, ProjectStatus::IN_PROGRESS], true)) {
            throw new ApiException(400, 'A raktárosi lista csak Scheduled vagy InProgress állapotot szűr.');
        }
        $out = [];
        foreach ($this->projects->pickable($status) as $row) {
            $tetel = (int) $row['tetel_db'];
            $igeny = (int) $row['igeny_db'];
            $kiadva = (int) $row['kiadva_db'];
            $name = trim((string) $row['customer_name'] . ' – ' . (string) $row['location']);
            $out[] = [
                'id' => (int) $row['id'],
                'customer_name' => (string) $row['customer_name'],
                'location' => (string) $row['location'],
                'nev' => $name,
                'status' => (string) $row['status'],
                'statusz' => (string) $row['status'],
                'tetel_db' => $tetel,
                'igeny_db' => $igeny,
                'kiadva_db' => $kiadva,
                'minden_lefoglalva' => $tetel > 0 && (int) $row['nem_foglalt_db'] === 0,
                'minden_kiadva' => $tetel > 0 && $kiadva >= $igeny,
            ];
        }

        return $out;
    }

    /** @return array<string, mixed> */
    public function plan(int $projectId): array
    {
        $project = $this->projects->find($projectId);
        if ($project === null) {
            throw new ApiException(404, 'Nincs ilyen projekt.');
        }

        $needs = [];
        $names = [];
        $lineCount = 0;
        $demand = 0;
        $issued = 0;
        foreach ($this->lines->all($projectId) as $line) {
            $lineCount++;
            $qty = (int) $line['quantity'];
            $done = (int) $line['issued_quantity'];
            $demand += $qty;
            $issued += $done;
            if ((int) $line['reserved'] !== 1) {
                continue;
            }
            $remain = $qty - $done;
            if ($remain > 0) {
                $partId = (int) $line['part_id'];
                $needs[$partId] = ($needs[$partId] ?? 0) + $remain;
                $names[$partId] = (string) $line['part_name'];
            }
        }

        $candidates = [];
        foreach ($needs as $partId => $qty) {
            unset($qty);
            foreach ($this->bins->withPart($partId) as $bin) {
                $candidates[] = [
                    'bin_id' => (int) $bin['id'],
                    'part_id' => $partId,
                    'nev' => $names[$partId],
                    'sor' => (int) $bin['row_num'],
                    'oszlop' => (int) $bin['col_num'],
                    'polc' => (int) $bin['level_num'],
                    'szint' => (int) $bin['level_num'],
                    'rekesz' => (string) $bin['identifier'],
                    'keszlet' => (int) $bin['quantity'],
                ];
            }
        }

        $remainingNeed = $needs;
        $remainingBin = [];
        foreach ($candidates as $candidate) {
            $remainingBin[$candidate['bin_id']] = $candidate['keszlet'];
        }

        $chosen = [];
        $position = RoutePlanner::START;
        $guard = 0;
        while (array_sum($remainingNeed) > 0 && $guard++ < 500) {
            $best = null;
            $bestDistance = PHP_INT_MAX;
            foreach ($candidates as $candidate) {
                $partId = $candidate['part_id'];
                if (($remainingNeed[$partId] ?? 0) <= 0 || ($remainingBin[$candidate['bin_id']] ?? 0) <= 0) {
                    continue;
                }
                $distance = $this->routes->distance($position, $candidate);
                if ($best === null || $distance < $bestDistance
                    || ($distance === $bestDistance && $candidate['bin_id'] < $best['bin_id'])) {
                    $best = $candidate;
                    $bestDistance = $distance;
                }
            }
            if ($best === null) {
                break;
            }
            $take = min($remainingNeed[$best['part_id']], $remainingBin[$best['bin_id']]);
            $remainingNeed[$best['part_id']] -= $take;
            $remainingBin[$best['bin_id']] -= $take;
            $best['darab'] = $take;
            $chosen[] = $best;
            $position = $best;
        }

        $ordered = $this->routes->optimize($chosen);
        $previous = RoutePlanner::START;
        $total = 0;
        $stops = [];
        $order = 1;
        foreach ($ordered as $stop) {
            $leg = $this->routes->distance($previous, $stop);
            $total += $leg;
            $place = sprintf('S%d · O%d · P%d · %s', $stop['sor'], $stop['oszlop'], $stop['polc'], $stop['rekesz']);
            $stops[] = [
                'sorrend' => $order++,
                'bin_id' => $stop['bin_id'],
                'part_id' => $stop['part_id'],
                'projektId' => $projectId,
                'project_id' => $projectId,
                'nev' => $stop['nev'],
                'darab' => $stop['darab'],
                'sor' => $stop['sor'],
                'oszlop' => $stop['oszlop'],
                'polc' => $stop['polc'],
                'szint' => $stop['szint'],
                'rekesz' => $stop['rekesz'],
                'azonosito' => $stop['rekesz'],
                'hely' => $place,
                'tavolsag_elozo' => $leg,
            ];
            $previous = $stop;
        }

        $missing = [];
        foreach ($remainingNeed as $partId => $left) {
            if ($left > 0) {
                $missing[] = [
                    'part_id' => $partId,
                    'nev' => $names[$partId] ?? '',
                    'hianyzo_darab' => $left,
                ];
            }
        }

        $name = ProjectService::displayName($project);

        return [
            'project_id' => $projectId,
            'projekt_id' => $projectId,
            'nev' => $name,
            'status' => (string) $project['status'],
            'statusz' => (string) $project['status'],
            'minden_kiadva' => $lineCount > 0 && $issued >= $demand,
            'tetelek' => $stops,
            'hianyzo' => $missing,
            'utvonal' => [
                'indulas' => RoutePlanner::START,
                'tavolsag' => $total,
                'suly' => [
                    'sor' => RoutePlanner::WEIGHT_ROW,
                    'oszlop' => RoutePlanner::WEIGHT_COL,
                    'polc' => RoutePlanner::WEIGHT_LEVEL,
                ],
                'megallok' => $stops,
                'hianyzo' => $missing,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @param array{id:int,username:string,role:string} $user
     * @return array<string, mixed>
     */
    public function handle(array $body, array $user): array
    {
        $projectId = Validator::int($body['project_id'] ?? $body['projekt_id'] ?? null, 'project_id', 1);
        $items = $this->items($body);
        if ($items === []) {
            return $this->start($projectId, $user);
        }

        return $this->issue($projectId, $items, $user);
    }

    /**
     * @param array{id:int,username:string,role:string} $user
     * @return array<string, mixed>
     */
    public function start(int $projectId, array $user): array
    {
        $status = $this->db->transaction(function () use ($projectId, $user) {
            return $this->markInProgress($projectId, (int) $user['id']);
        });

        return $this->result($projectId, $status, 0);
    }

    /**
     * @param list<array{part_id:int,bin_id:int,quantity:int}> $items
     * @param array{id:int,username:string,role:string} $user
     * @return array<string, mixed>
     */
    public function issue(int $projectId, array $items, array $user): array
    {
        $issued = 0;
        $status = $this->db->transaction(function () use ($projectId, $items, $user, &$issued) {
            $this->bins->lockAll();
            $status = $this->markInProgress($projectId, (int) $user['id']);
            foreach ($items as $item) {
                $line = $this->lines->findForUpdate($projectId, $item['part_id']);
                if ($line === null) {
                    throw new ApiException(404, 'Ez az alkatrész nincs a projekten.');
                }
                if ((int) $line['reserved'] !== 1) {
                    throw new ApiException(409, 'Ez az alkatrész még nincs lefoglalva a projektre, ezért nem adható ki.');
                }
                $bin = $this->bins->findForUpdate($item['bin_id']);
                if ($bin === null) {
                    throw new ApiException(404, 'Nincs ilyen rekesz.');
                }
                if ($bin['part_id'] === null || (int) $bin['part_id'] !== $item['part_id']) {
                    throw new ApiException(409, 'A kiválasztott rekeszben nem ez az alkatrész van.');
                }
                if ((int) $bin['quantity'] < $item['quantity']) {
                    throw new ApiException(409, 'A rekeszben nincs ennyi darab.');
                }
                $left = (int) $line['quantity'] - (int) $line['issued_quantity'];
                if ($item['quantity'] > $left) {
                    throw new ApiException(409, 'A projekt igényénél több nem adható ki ebből az alkatrészből.');
                }
                if ($this->bins->decrease($item['bin_id'], $item['quantity']) < 1) {
                    throw new ApiException(409, 'A rekesz készlete időközben megváltozott.');
                }
                $this->bins->emptyIfZero($item['bin_id']);
                if ($this->lines->addIssued($projectId, $item['part_id'], $item['quantity']) < 1) {
                    throw new ApiException(409, 'A kiadható mennyiség időközben megváltozott.');
                }
                $this->movements->add(
                    $item['part_id'],
                    $item['bin_id'],
                    $projectId,
                    (int) $user['id'],
                    'issue',
                    $item['quantity'],
                    'Kivételezés'
                );
                $issued += $item['quantity'];
            }

            return $status;
        });

        return $this->result($projectId, $status, $issued);
    }

    /** @return array<string, mixed> */
    private function result(int $projectId, string $status, int $issued): array
    {
        $plan = $this->plan($projectId);

        return [
            'success' => true,
            'ok' => true,
            'project_id' => $projectId,
            'status' => $status,
            'statusz' => $status,
            'kiadva' => $issued,
            'minden_kiadva' => $plan['minden_kiadva'],
        ];
    }

    private function markInProgress(int $projectId, int $userId): string
    {
        $project = $this->projects->findForUpdate($projectId);
        if ($project === null) {
            throw new ApiException(404, 'Nincs ilyen projekt.');
        }
        $status = (string) $project['status'];
        if (!in_array($status, [ProjectStatus::SCHEDULED, ProjectStatus::IN_PROGRESS], true)) {
            throw new ApiException(409, 'Kivételezni csak ütemezett (Scheduled) vagy már folyamatban lévő projektre lehet.');
        }
        if ($status === ProjectStatus::SCHEDULED) {
            $this->projects->updateFields($projectId, ['status' => ProjectStatus::IN_PROGRESS]);
            $this->history->add($projectId, ProjectStatus::IN_PROGRESS, $userId);

            return ProjectStatus::IN_PROGRESS;
        }

        return $status;
    }

    /**
     * @param array<string, mixed> $body
     * @return list<array{part_id:int,bin_id:int,quantity:int}>
     */
    private function items(array $body): array
    {
        $raw = $body['items'] ?? $body['tetelek'] ?? null;
        if ($raw === null) {
            return [];
        }
        if (!is_array($raw)) {
            throw new ApiException(400, 'A tetelek tömb kell legyen.');
        }
        $merged = [];
        foreach ($raw as $item) {
            if (!is_array($item)) {
                throw new ApiException(400, 'Minden tételnél kell alkatrész, rekesz és pozitív darab.');
            }
            $partId = Validator::int($item['part_id'] ?? $item['alkatresz_id'] ?? null, 'part_id', 1);
            $binId = Validator::int($item['bin_id'] ?? $item['rekesz_id'] ?? null, 'bin_id', 1);
            $quantity = Validator::int($item['quantity'] ?? $item['darab'] ?? null, 'quantity', 1, 1000000);
            $key = $partId . ':' . $binId;
            if (!isset($merged[$key])) {
                $merged[$key] = ['part_id' => $partId, 'bin_id' => $binId, 'quantity' => 0];
            }
            $merged[$key]['quantity'] += $quantity;
        }

        return array_values($merged);
    }
}

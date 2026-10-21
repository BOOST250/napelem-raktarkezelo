<?php

declare(strict_types=1);

namespace Napelem\Service;

use Napelem\Database\ConnectionFactory;
use Napelem\Domain\ProjectStatus;
use Napelem\Http\ApiException;
use Napelem\Repository\PartRepository;
use Napelem\Repository\ProjectPartRepository;
use Napelem\Repository\ProjectRepository;
use Napelem\Support\Validator;
use PDOException;

final class ProjectPartService
{
    private const EDITABLE = [ProjectStatus::NEW, ProjectStatus::DRAFT, ProjectStatus::WAIT];

    public function __construct(
        private readonly ConnectionFactory $db,
        private readonly ProjectPartRepository $lines,
        private readonly ProjectRepository $projects,
        private readonly PartRepository $parts,
    ) {
    }

    /** @return list<array<string, mixed>> */
    public function list(?int $projectId = null): array
    {
        $out = [];
        foreach ($this->lines->all($projectId) as $row) {
            $out[] = $this->present($row);
        }

        return $out;
    }

    /** @param array<string, mixed> $body */
    public function create(array $body): void
    {
        if (array_key_exists('reserved', $body)) {
            throw new ApiException(400, 'A foglalást a bevételezés kezeli, kézzel nem állítható.');
        }
        $projectId = Validator::int($body['project_id'] ?? null, 'project_id', 1);
        $partId = Validator::int($body['part_id'] ?? null, 'part_id', 1);
        $quantity = Validator::int($body['quantity'] ?? null, 'quantity', 1, 1000000);

        $project = $this->projects->find($projectId);
        if ($project === null) {
            throw new ApiException(404, 'Nincs ilyen projekt.');
        }
        if (!in_array((string) $project['status'], self::EDITABLE, true)) {
            throw new ApiException(409, 'Ebben az állapotban már nem vehető fel alkatrészigény.');
        }
        if ($this->parts->find($partId) === null) {
            throw new ApiException(404, 'Nincs ilyen alkatrész.');
        }
        if ($this->lines->find($projectId, $partId) !== null) {
            throw new ApiException(409, 'Ez az alkatrész már szerepel a projekt listáján.');
        }

        try {
            $this->lines->insert($projectId, $partId, $quantity);
        } catch (PDOException $e) {
            if (($e->errorInfo[0] ?? '') === '23000') {
                throw new ApiException(409, 'Ez az alkatrész már szerepel a projekt listáján.');
            }
            throw $e;
        }
    }

    /** @param array<string, mixed> $body */
    public function update(int $projectId, int $partId, array $body): void
    {
        if (array_key_exists('reserved', $body)) {
            throw new ApiException(400, 'A foglalást a bevételezés kezeli, kézzel nem állítható.');
        }
        if (!array_key_exists('quantity', $body)) {
            throw new ApiException(400, 'Nincs módosítandó mező.');
        }
        $quantity = Validator::int($body['quantity'], 'quantity', 1, 1000000);

        $this->db->transaction(function () use ($projectId, $partId, $quantity) {
            $line = $this->lines->findForUpdate($projectId, $partId);
            if ($line === null) {
                throw new ApiException(404, 'Nincs ilyen projekt-alkatrész kapcsolat.');
            }
            $this->assertEditable($projectId, $line);
            $this->lines->updateQuantity($projectId, $partId, $quantity);
        });
    }

    public function delete(int $projectId, int $partId): void
    {
        $this->db->transaction(function () use ($projectId, $partId) {
            $line = $this->lines->findForUpdate($projectId, $partId);
            if ($line === null) {
                throw new ApiException(404, 'Nincs ilyen projekt-alkatrész kapcsolat.');
            }
            $this->assertEditable($projectId, $line);
            $this->lines->delete($projectId, $partId);
        });
    }

    public function count(int $projectId): int
    {
        return $this->lines->countForProject($projectId);
    }

    public function unreservedCount(int $projectId): int
    {
        return $this->lines->unreservedCount($projectId);
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    public function present(array $row): array
    {
        return [
            'project_id' => (int) $row['project_id'],
            'part_id' => (int) $row['part_id'],
            'quantity' => (int) $row['quantity'],
            'reserved' => (int) $row['reserved'] === 1 ? 1 : 0,
            'reserved_at' => $row['reserved_at'],
            'issued_quantity' => (int) $row['issued_quantity'],
            'part_name' => (string) $row['part_name'],
            'part_price' => (float) $row['part_price'],
        ];
    }

    /** @param array<string, mixed> $line */
    private function assertEditable(int $projectId, array $line): void
    {
        $project = $this->projects->find($projectId);
        if ($project === null) {
            throw new ApiException(404, 'Nincs ilyen projekt.');
        }
        if (!in_array((string) $project['status'], self::EDITABLE, true)) {
            throw new ApiException(409, 'Ebben az állapotban az alkatrészigény már nem módosítható.');
        }
        if ((int) $line['reserved'] === 1 || (int) $line['issued_quantity'] > 0) {
            throw new ApiException(409, 'A lefoglalt tétel már nem módosítható, a raktár elkötelezte a készletet.');
        }
    }
}

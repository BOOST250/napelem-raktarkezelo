<?php

declare(strict_types=1);

namespace Napelem\Repository;

use Napelem\Database\ConnectionFactory;
use Napelem\Domain\ProjectStatus;

final class ProjectPartRepository
{
    public function __construct(private readonly ConnectionFactory $db)
    {
    }

    /** @return list<array<string, mixed>> */
    public function all(?int $projectId = null): array
    {
        $sql = 'SELECT pp.project_id, pp.part_id, pp.quantity, pp.reserved, pp.reserved_at, pp.issued_quantity,
                       p.name AS part_name, p.price AS part_price
                FROM project_parts pp
                JOIN parts p ON p.id = pp.part_id';
        $params = [];
        if ($projectId !== null) {
            $sql .= ' WHERE pp.project_id = ?';
            $params[] = $projectId;
        }
        $sql .= ' ORDER BY pp.project_id ASC, pp.part_id ASC';
        $stmt = $this->db->pdo()->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    public function find(int $projectId, int $partId): ?array
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT pp.project_id, pp.part_id, pp.quantity, pp.reserved, pp.reserved_at, pp.issued_quantity,
                    p.name AS part_name, p.price AS part_price
             FROM project_parts pp
             JOIN parts p ON p.id = pp.part_id
             WHERE pp.project_id = ? AND pp.part_id = ?'
        );
        $stmt->execute([$projectId, $partId]);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    public function findForUpdate(int $projectId, int $partId): ?array
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT project_id, part_id, quantity, reserved, issued_quantity
             FROM project_parts WHERE project_id = ? AND part_id = ? FOR UPDATE'
        );
        $stmt->execute([$projectId, $partId]);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    public function insert(int $projectId, int $partId, int $quantity): void
    {
        $stmt = $this->db->pdo()->prepare(
            'INSERT INTO project_parts (project_id, part_id, quantity, reserved, issued_quantity)
             VALUES (?, ?, ?, 0, 0)'
        );
        $stmt->execute([$projectId, $partId, $quantity]);
    }

    public function updateQuantity(int $projectId, int $partId, int $quantity): void
    {
        $stmt = $this->db->pdo()->prepare(
            'UPDATE project_parts SET quantity = ? WHERE project_id = ? AND part_id = ?'
        );
        $stmt->execute([$quantity, $projectId, $partId]);
    }

    public function delete(int $projectId, int $partId): int
    {
        $stmt = $this->db->pdo()->prepare(
            'DELETE FROM project_parts WHERE project_id = ? AND part_id = ?'
        );
        $stmt->execute([$projectId, $partId]);

        return $stmt->rowCount();
    }

    public function countForProject(int $projectId): int
    {
        $stmt = $this->db->pdo()->prepare('SELECT COUNT(*) FROM project_parts WHERE project_id = ?');
        $stmt->execute([$projectId]);

        return (int) $stmt->fetchColumn();
    }

    public function lockProject(int $projectId): void
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT part_id FROM project_parts WHERE project_id = ? FOR UPDATE'
        );
        $stmt->execute([$projectId]);
        $stmt->fetchAll();
    }

    public function unreservedCount(int $projectId): int
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT COUNT(*) FROM project_parts WHERE project_id = ? AND reserved = 0'
        );
        $stmt->execute([$projectId]);

        return (int) $stmt->fetchColumn();
    }

    /** @return list<array<string, mixed>> */
    public function unreservedForProjectForUpdate(int $projectId): array
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT project_id, part_id, quantity FROM project_parts
             WHERE project_id = ? AND reserved = 0
             ORDER BY part_id FOR UPDATE'
        );
        $stmt->execute([$projectId]);

        return $stmt->fetchAll();
    }

    /**
     * Bevételezéskor előbb a Wait, aztán a Draft igények (létrehozás szerint).
     *
     * @return list<array<string, mixed>>
     */
    public function unreservedCandidatesForUpdate(int $partId): array
    {
        $stmt = $this->db->pdo()->prepare(
            "SELECT pp.project_id, pp.part_id, pp.quantity, p.status, p.customer_name, p.location
             FROM project_parts pp
             JOIN projects p ON p.id = pp.project_id
             WHERE pp.part_id = ? AND pp.reserved = 0 AND p.status IN ('Wait', 'Draft')
             ORDER BY FIELD(p.status, 'Wait', 'Draft'), p.created_at ASC, p.id ASC
             FOR UPDATE"
        );
        $stmt->execute([$partId]);

        return $stmt->fetchAll();
    }

    public function markReserved(int $projectId, int $partId): void
    {
        $stmt = $this->db->pdo()->prepare(
            'UPDATE project_parts
             SET reserved = 1, reserved_at = NOW()
             WHERE project_id = ? AND part_id = ? AND reserved = 0'
        );
        $stmt->execute([$projectId, $partId]);
    }

    public function addIssued(int $projectId, int $partId, int $quantity): int
    {
        $stmt = $this->db->pdo()->prepare(
            'UPDATE project_parts
             SET issued_quantity = issued_quantity + ?
             WHERE project_id = ? AND part_id = ? AND reserved = 1
               AND issued_quantity + ? <= quantity'
        );
        $stmt->execute([$quantity, $projectId, $partId, $quantity]);

        return $stmt->rowCount();
    }

    public function reservedOutstanding(int $partId): int
    {
        $active = ProjectStatus::activeSqlList();
        $stmt = $this->db->pdo()->prepare(
            "SELECT COALESCE(SUM(GREATEST(pp.quantity - pp.issued_quantity, 0)), 0)
             FROM project_parts pp
             JOIN projects p ON p.id = pp.project_id
             WHERE pp.part_id = ? AND pp.reserved = 1 AND p.status IN ($active)"
        );
        $stmt->execute([$partId]);

        return (int) $stmt->fetchColumn();
    }

    /** @return list<array<string, mixed>> */
    public function missingLines(): array
    {
        $active = ProjectStatus::activeSqlList();
        $sql = "SELECT pp.part_id, pa.name AS part_name, pp.quantity, pp.project_id, p.status,
                       p.customer_name, p.location
                FROM project_parts pp
                JOIN parts pa ON pa.id = pp.part_id
                JOIN projects p ON p.id = pp.project_id
                WHERE pp.reserved = 0 AND pp.quantity > 0 AND p.status IN ($active)
                ORDER BY pa.name, p.created_at, p.id";

        return $this->db->pdo()->query($sql)->fetchAll();
    }

    /** @return list<array<string, mixed>> */
    public function reservedLines(): array
    {
        $active = ProjectStatus::activeSqlList();
        $sql = "SELECT pp.part_id, pa.name AS part_name, pp.quantity, pp.issued_quantity, pp.project_id,
                       p.status, p.customer_name, p.location
                FROM project_parts pp
                JOIN parts pa ON pa.id = pp.part_id
                JOIN projects p ON p.id = pp.project_id
                WHERE pp.reserved = 1 AND p.status IN ($active)
                  AND GREATEST(pp.quantity - pp.issued_quantity, 0) > 0
                ORDER BY p.id, pa.name";

        return $this->db->pdo()->query($sql)->fetchAll();
    }
}

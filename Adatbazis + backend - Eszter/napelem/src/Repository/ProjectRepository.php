<?php

declare(strict_types=1);

namespace Napelem\Repository;

use Napelem\Database\ConnectionFactory;

final class ProjectRepository
{
    public function __construct(private readonly ConnectionFactory $db)
    {
    }

    /** @return list<array<string, mixed>> */
    public function all(?int $id = null, ?string $status = null): array
    {
        $sql = 'SELECT id, location, description, customer_name, customer_email, customer_phone,
                       status, work_hours, labor_cost, created_at, updated_at
                FROM projects WHERE 1 = 1';
        $params = [];
        if ($id !== null) {
            $sql .= ' AND id = ?';
            $params[] = $id;
        }
        if ($status !== null) {
            $sql .= ' AND status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY created_at DESC, id DESC';
        $stmt = $this->db->pdo()->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    public function find(int $id): ?array
    {
        $rows = $this->all($id);

        return $rows[0] ?? null;
    }

    public function findForUpdate(int $id): ?array
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT id, location, description, customer_name, customer_email, customer_phone,
                    status, work_hours, labor_cost, created_at, updated_at
             FROM projects WHERE id = ? FOR UPDATE'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    public function insert(
        string $location,
        ?string $description,
        string $customerName,
        ?string $email,
        ?string $phone,
    ): int {
        $stmt = $this->db->pdo()->prepare(
            "INSERT INTO projects (location, description, customer_name, customer_email, customer_phone, status)
             VALUES (?, ?, ?, ?, ?, 'New')"
        );
        $stmt->execute([$location, $description, $customerName, $email, $phone]);

        return (int) $this->db->pdo()->lastInsertId();
    }

    /** @param array<string, mixed> $fields */
    public function updateFields(int $id, array $fields): void
    {
        $allowed = [
            'location' => true,
            'description' => true,
            'customer_name' => true,
            'customer_email' => true,
            'customer_phone' => true,
            'status' => true,
            'work_hours' => true,
            'labor_cost' => true,
        ];
        $sets = [];
        $params = [];
        foreach ($fields as $column => $value) {
            if (!isset($allowed[$column])) {
                continue;
            }
            $sets[] = $column . ' = ?';
            $params[] = $value;
        }
        if ($sets === []) {
            return;
        }
        $params[] = $id;
        $this->db->pdo()->prepare(
            'UPDATE projects SET ' . implode(', ', $sets) . ' WHERE id = ?'
        )->execute($params);
    }

    public function delete(int $id): void
    {
        $this->db->pdo()->prepare('DELETE FROM projects WHERE id = ?')->execute([$id]);
    }

    /**
     * A raktárosi projektlista: minden állapot, tételszám és lefoglalt sorok.
     *
     * @return list<array<string, mixed>>
     */
    public function workerCards(?int $id = null): array
    {
        $sql = 'SELECT p.id, p.customer_name, p.location, p.description, p.status, p.created_at,
                       (SELECT COUNT(*) FROM project_parts pp WHERE pp.project_id = p.id) AS part_lines,
                       (SELECT COUNT(*) FROM project_parts pp WHERE pp.project_id = p.id AND pp.reserved = 1) AS reserved_lines
                FROM projects p';
        $params = [];
        if ($id !== null) {
            $sql .= ' WHERE p.id = ?';
            $params[] = $id;
        }
        $sql .= ' ORDER BY p.created_at DESC, p.id DESC';
        $stmt = $this->db->pdo()->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    /**
     * Kivételezhető projektek összegzéssel.
     *
     * @return list<array<string, mixed>>
     */
    public function pickable(?string $status = null): array
    {
        $sql = "SELECT p.id, p.location, p.customer_name, p.status, p.created_at,
                       (SELECT COUNT(*) FROM project_parts pp WHERE pp.project_id = p.id) AS tetel_db,
                       (SELECT COALESCE(SUM(pp.quantity), 0) FROM project_parts pp WHERE pp.project_id = p.id) AS igeny_db,
                       (SELECT COALESCE(SUM(pp.issued_quantity), 0) FROM project_parts pp WHERE pp.project_id = p.id) AS kiadva_db,
                       (SELECT COUNT(*) FROM project_parts pp WHERE pp.project_id = p.id AND pp.reserved = 0) AS nem_foglalt_db
                FROM projects p
                WHERE p.status IN ('Scheduled', 'InProgress')";
        $params = [];
        if ($status !== null) {
            $sql .= ' AND p.status = ?';
            $params[] = $status;
        }
        $sql .= " ORDER BY FIELD(p.status, 'Scheduled', 'InProgress'), p.created_at ASC, p.id ASC";
        $stmt = $this->db->pdo()->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }
}

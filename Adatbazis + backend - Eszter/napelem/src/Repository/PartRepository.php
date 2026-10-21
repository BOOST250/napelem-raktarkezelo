<?php

declare(strict_types=1);

namespace Napelem\Repository;

use Napelem\Database\ConnectionFactory;

final class PartRepository
{
    public function __construct(private readonly ConnectionFactory $db)
    {
    }

    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        return $this->db->pdo()->query(
            'SELECT id, name, price, max_per_bin, created_at, updated_at FROM parts ORDER BY id ASC'
        )->fetchAll();
    }

    public function find(int $id): ?array
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT id, name, price, max_per_bin, created_at, updated_at FROM parts WHERE id = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    public function findForUpdate(int $id): ?array
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT id, name, price, max_per_bin FROM parts WHERE id = ? FOR UPDATE'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    public function findByName(string $name): ?array
    {
        $stmt = $this->db->pdo()->prepare('SELECT id, name FROM parts WHERE name = ?');
        $stmt->execute([$name]);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    public function insert(string $name, float $price, int $maxPerBin): int
    {
        $stmt = $this->db->pdo()->prepare(
            'INSERT INTO parts (name, price, max_per_bin) VALUES (?, ?, ?)'
        );
        $stmt->execute([$name, number_format($price, 2, '.', ''), $maxPerBin]);

        return (int) $this->db->pdo()->lastInsertId();
    }

    /** @param array<string, mixed> $fields */
    public function update(int $id, array $fields): void
    {
        $allowed = ['name' => true, 'price' => true, 'max_per_bin' => true];
        $sets = [];
        $params = [];
        foreach ($fields as $column => $value) {
            if (!isset($allowed[$column])) {
                continue;
            }
            if ($column === 'price') {
                $value = number_format((float) $value, 2, '.', '');
            }
            $sets[] = $column . ' = ?';
            $params[] = $value;
        }
        if ($sets === []) {
            return;
        }
        $params[] = $id;
        $this->db->pdo()->prepare(
            'UPDATE parts SET ' . implode(', ', $sets) . ' WHERE id = ?'
        )->execute($params);
    }

    public function delete(int $id): void
    {
        $this->db->pdo()->prepare('DELETE FROM parts WHERE id = ?')->execute([$id]);
    }

    public function projectPartCount(int $id): int
    {
        $stmt = $this->db->pdo()->prepare('SELECT COUNT(*) FROM project_parts WHERE part_id = ?');
        $stmt->execute([$id]);

        return (int) $stmt->fetchColumn();
    }

    public function movementCount(int $id): int
    {
        $stmt = $this->db->pdo()->prepare('SELECT COUNT(*) FROM stock_movements WHERE part_id = ?');
        $stmt->execute([$id]);

        return (int) $stmt->fetchColumn();
    }
}

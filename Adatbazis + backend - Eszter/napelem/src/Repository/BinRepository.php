<?php

declare(strict_types=1);

namespace Napelem\Repository;

use Napelem\Database\ConnectionFactory;

final class BinRepository
{
    public function __construct(private readonly ConnectionFactory $db)
    {
    }

    /** @return list<array<string, mixed>> */
    public function all(?int $partId = null): array
    {
        if ($partId === null) {
            return $this->db->pdo()->query(
                'SELECT id, row_num, col_num, level_num, identifier, part_id, quantity, max_capacity
                 FROM bins ORDER BY row_num, col_num, level_num, id'
            )->fetchAll();
        }

        $stmt = $this->db->pdo()->prepare(
            'SELECT id, row_num, col_num, level_num, identifier, part_id, quantity, max_capacity
             FROM bins WHERE part_id = ? ORDER BY row_num, col_num, level_num, id'
        );
        $stmt->execute([$partId]);

        return $stmt->fetchAll();
    }

    /**
     * A polcrendszer kiterjedése. Üres táblánál is legalább 1, hogy a folyosó számolható legyen.
     *
     * @return array{rows:int,columns:int,levels:int}
     */
    public function span(): array
    {
        $row = $this->db->pdo()->query(
            'SELECT COALESCE(MAX(row_num), 0) AS row_num,
                    COALESCE(MAX(col_num), 0) AS col_num,
                    COALESCE(MAX(level_num), 0) AS level_num
             FROM bins'
        )->fetch();

        return [
            'rows' => max(1, (int) ($row['row_num'] ?? 0)),
            'columns' => max(1, (int) ($row['col_num'] ?? 0)),
            'levels' => max(1, (int) ($row['level_num'] ?? 0)),
        ];
    }

    /**
     * Készleten lévő rekeszek a megadott alkatrészekhez (quantity > 0).
     *
     * @param list<int> $partIds
     * @return list<array<string, mixed>>
     */
    public function inStock(array $partIds): array
    {
        if ($partIds === []) {
            return [];
        }
        $marks = implode(',', array_fill(0, count($partIds), '?'));
        $stmt = $this->db->pdo()->prepare(
            "SELECT id, part_id, identifier, row_num, col_num, level_num, quantity, max_capacity
             FROM bins
             WHERE quantity > 0 AND part_id IN ($marks)
             ORDER BY part_id, row_num, col_num, level_num, id"
        );
        $stmt->execute($partIds);

        return $stmt->fetchAll();
    }

    public function find(int $id): ?array
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT id, row_num, col_num, level_num, identifier, part_id, quantity, max_capacity
             FROM bins WHERE id = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    public function findForUpdate(int $id): ?array
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT id, row_num, col_num, level_num, identifier, part_id, quantity, max_capacity
             FROM bins WHERE id = ? FOR UPDATE'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    public function lockAll(): void
    {
        $this->db->pdo()->query('SELECT id FROM bins ORDER BY id FOR UPDATE')->fetchAll();
    }

    public function existsIdentifier(string $identifier, ?int $exceptId = null): bool
    {
        $sql = 'SELECT id FROM bins WHERE identifier = ?';
        $params = [$identifier];
        if ($exceptId !== null) {
            $sql .= ' AND id <> ?';
            $params[] = $exceptId;
        }
        $stmt = $this->db->pdo()->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetch() !== false;
    }

    public function insert(
        int $row,
        int $col,
        int $level,
        string $identifier,
        ?int $partId,
        int $quantity,
        int $maxCapacity,
    ): int {
        $stmt = $this->db->pdo()->prepare(
            'INSERT INTO bins (row_num, col_num, level_num, identifier, part_id, quantity, max_capacity)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->bindValue(1, $row, \PDO::PARAM_INT);
        $stmt->bindValue(2, $col, \PDO::PARAM_INT);
        $stmt->bindValue(3, $level, \PDO::PARAM_INT);
        $stmt->bindValue(4, $identifier);
        if ($partId === null) {
            $stmt->bindValue(5, null, \PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(5, $partId, \PDO::PARAM_INT);
        }
        $stmt->bindValue(6, $quantity, \PDO::PARAM_INT);
        $stmt->bindValue(7, $maxCapacity, \PDO::PARAM_INT);
        $stmt->execute();

        return (int) $this->db->pdo()->lastInsertId();
    }

    /** @param array<string, mixed> $fields */
    public function update(int $id, array $fields): void
    {
        $allowed = [
            'row_num' => true,
            'col_num' => true,
            'level_num' => true,
            'identifier' => true,
            'part_id' => true,
            'quantity' => true,
            'max_capacity' => true,
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
            'UPDATE bins SET ' . implode(', ', $sets) . ' WHERE id = ?'
        )->execute($params);
    }

    public function place(int $id, int $partId, int $quantity): void
    {
        $stmt = $this->db->pdo()->prepare('UPDATE bins SET part_id = ?, quantity = ? WHERE id = ?');
        $stmt->execute([$partId, $quantity, $id]);
    }

    public function decrease(int $id, int $quantity): int
    {
        $stmt = $this->db->pdo()->prepare(
            'UPDATE bins SET quantity = quantity - ? WHERE id = ? AND quantity >= ?'
        );
        $stmt->execute([$quantity, $id, $quantity]);

        return $stmt->rowCount();
    }

    public function emptyIfZero(int $id): void
    {
        $stmt = $this->db->pdo()->prepare(
            'UPDATE bins SET part_id = NULL, quantity = 0 WHERE id = ? AND quantity = 0'
        );
        $stmt->execute([$id]);
    }

    public function delete(int $id): void
    {
        $this->db->pdo()->prepare('DELETE FROM bins WHERE id = ?')->execute([$id]);
    }

    public function stock(int $partId): int
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT COALESCE(SUM(quantity), 0) FROM bins WHERE part_id = ?'
        );
        $stmt->execute([$partId]);

        return (int) $stmt->fetchColumn();
    }

    public function maxQuantityForPart(int $partId): int
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT COALESCE(MAX(quantity), 0) FROM bins WHERE part_id = ?'
        );
        $stmt->execute([$partId]);

        return (int) $stmt->fetchColumn();
    }

    public function stockQuantity(int $partId): int
    {
        return $this->stock($partId);
    }

    /** @return list<array<string, mixed>> */
    public function withPart(int $partId): array
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT b.id, b.row_num, b.col_num, b.level_num, b.identifier, b.part_id, b.quantity, b.max_capacity,
                    p.name AS part_name
             FROM bins b
             JOIN parts p ON p.id = b.part_id
             WHERE b.part_id = ? AND b.quantity > 0
             ORDER BY b.row_num, b.col_num, b.level_num, b.id'
        );
        $stmt->execute([$partId]);

        return $stmt->fetchAll();
    }
}

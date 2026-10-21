<?php

declare(strict_types=1);

namespace Napelem\Repository;

use Napelem\Database\ConnectionFactory;

final class MovementRepository
{
    public function __construct(private readonly ConnectionFactory $db)
    {
    }

    public function add(
        int $partId,
        ?int $binId,
        ?int $projectId,
        ?int $userId,
        string $type,
        int $quantity,
        ?string $note,
    ): void {
        $stmt = $this->db->pdo()->prepare(
            'INSERT INTO stock_movements
                (part_id, bin_id, project_id, user_id, movement_type, quantity, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$partId, $binId, $projectId, $userId, $type, $quantity, $note]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function list(?int $projectId, ?int $partId, ?int $binId): array
    {
        $sql = 'SELECT m.id, m.part_id, p.name AS part_name, m.bin_id, b.identifier AS bin_identifier,
                       b.row_num, b.col_num, b.level_num, m.project_id, m.user_id, u.username,
                       m.movement_type, m.quantity, m.note, m.created_at
                FROM stock_movements m
                JOIN parts p ON p.id = m.part_id
                LEFT JOIN bins b ON b.id = m.bin_id
                LEFT JOIN users u ON u.id = m.user_id
                WHERE 1 = 1';
        $params = [];
        if ($projectId !== null) {
            $sql .= ' AND m.project_id = ?';
            $params[] = $projectId;
        }
        if ($partId !== null) {
            $sql .= ' AND m.part_id = ?';
            $params[] = $partId;
        }
        if ($binId !== null) {
            $sql .= ' AND m.bin_id = ?';
            $params[] = $binId;
        }
        $sql .= ' ORDER BY m.created_at DESC, m.id DESC';
        $stmt = $this->db->pdo()->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }
}

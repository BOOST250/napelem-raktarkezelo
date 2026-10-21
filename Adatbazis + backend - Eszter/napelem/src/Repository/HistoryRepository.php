<?php

declare(strict_types=1);

namespace Napelem\Repository;

use Napelem\Database\ConnectionFactory;

final class HistoryRepository
{
    public function __construct(private readonly ConnectionFactory $db)
    {
    }

    public function add(int $projectId, string $status, ?int $userId): int
    {
        $stmt = $this->db->pdo()->prepare(
            'INSERT INTO project_history (project_id, status, user_id) VALUES (?, ?, ?)'
        );
        $stmt->execute([$projectId, $status, $userId]);

        return (int) $this->db->pdo()->lastInsertId();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function list(?int $projectId, bool $ascending): array
    {
        $sql = 'SELECT h.id, h.project_id, h.status, h.changed_at, h.user_id, u.username
                FROM project_history h
                LEFT JOIN users u ON u.id = h.user_id';
        $params = [];
        if ($projectId !== null) {
            $sql .= ' WHERE h.project_id = ?';
            $params[] = $projectId;
        }
        $sql .= $ascending
            ? ' ORDER BY h.changed_at ASC, h.id ASC'
            : ' ORDER BY h.changed_at DESC, h.id DESC';
        $stmt = $this->db->pdo()->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    public function delete(int $id): int
    {
        $stmt = $this->db->pdo()->prepare('DELETE FROM project_history WHERE id = ?');
        $stmt->execute([$id]);

        return $stmt->rowCount();
    }
}

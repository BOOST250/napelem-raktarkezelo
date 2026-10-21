<?php

declare(strict_types=1);

namespace Napelem\Repository;

use Napelem\Database\ConnectionFactory;
use PDO;

final class UserRepository
{
    public function __construct(private readonly ConnectionFactory $db)
    {
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT id, username, password, role, created_at FROM users WHERE id = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    public function findByUsername(string $username): ?array
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT id, username, password, role, created_at FROM users WHERE username = ?'
        );
        $stmt->execute([$username]);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    /** @return list<array<string, mixed>> */
    public function allPublic(): array
    {
        return $this->db->pdo()->query(
            'SELECT id, username, role, created_at FROM users ORDER BY id ASC'
        )->fetchAll();
    }

    public function insert(string $username, string $passwordHash, string $role): int
    {
        $stmt = $this->db->pdo()->prepare(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)'
        );
        $stmt->execute([$username, $passwordHash, $role]);

        return (int) $this->db->pdo()->lastInsertId();
    }

    public function updatePassword(int $id, string $passwordHash): void
    {
        $stmt = $this->db->pdo()->prepare('UPDATE users SET password = ? WHERE id = ?');
        $stmt->execute([$passwordHash, $id]);
    }

    /** @param array<string, string> $fields */
    public function update(int $id, array $fields): void
    {
        $allowed = ['username' => true, 'password' => true, 'role' => true];
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
        $sql = 'UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?';
        $this->db->pdo()->prepare($sql)->execute($params);
    }

    public function delete(int $id): void
    {
        $stmt = $this->db->pdo()->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$id]);
    }

    public function countByRole(string $role): int
    {
        $stmt = $this->db->pdo()->prepare('SELECT COUNT(*) FROM users WHERE role = ?');
        $stmt->execute([$role]);

        return (int) $stmt->fetchColumn();
    }

    public function pdo(): PDO
    {
        return $this->db->pdo();
    }
}

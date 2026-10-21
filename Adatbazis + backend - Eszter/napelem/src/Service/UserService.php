<?php

declare(strict_types=1);

namespace Napelem\Service;

use Napelem\Domain\Role;
use Napelem\Http\ApiException;
use Napelem\Repository\UserRepository;
use Napelem\Support\Validator;
use PDOException;

final class UserService
{
    public function __construct(private readonly UserRepository $users)
    {
    }

    /** @return list<array<string, mixed>> */
    public function list(): array
    {
        $out = [];
        foreach ($this->users->allPublic() as $row) {
            $out[] = $this->present($row);
        }

        return $out;
    }

    /** @param array<string, mixed> $body */
    public function create(array $body): int
    {
        $username = $this->username($body['username'] ?? null);
        $password = $this->password($body['password'] ?? null, true);
        $role = $this->role($body['role'] ?? null);
        if ($this->users->findByUsername($username) !== null) {
            throw new ApiException(409, 'Ez a felhasználónév már létezik.');
        }
        try {
            return $this->users->insert($username, password_hash($password, PASSWORD_DEFAULT), $role);
        } catch (PDOException $e) {
            if (($e->errorInfo[0] ?? '') === '23000') {
                throw new ApiException(409, 'Ez a felhasználónév már létezik.');
            }
            throw $e;
        }
    }

    /**
     * @param array<string, mixed> $body
     * @param array{id:int,username:string,role:string} $actor
     */
    public function update(int $id, array $body, array $actor): void
    {
        $current = $this->users->findById($id);
        if ($current === null) {
            throw new ApiException(404, 'Nincs ilyen felhasználó.');
        }
        $fields = [];
        if (array_key_exists('username', $body)) {
            $username = $this->username($body['username']);
            $other = $this->users->findByUsername($username);
            if ($other !== null && (int) $other['id'] !== $id) {
                throw new ApiException(409, 'Ez a felhasználónév már létezik.');
            }
            $fields['username'] = $username;
        }
        if (array_key_exists('password', $body)) {
            $fields['password'] = password_hash($this->password($body['password'], true), PASSWORD_DEFAULT);
        }
        if (array_key_exists('role', $body)) {
            $role = $this->role($body['role']);
            if ((string) $current['role'] === Role::ADMIN && $role !== Role::ADMIN) {
                $this->assertNotLastAdmin($id);
            }
            $fields['role'] = $role;
        }
        if ($fields === []) {
            throw new ApiException(400, 'Nincs módosítandó mező.');
        }
        try {
            $this->users->update($id, $fields);
        } catch (PDOException $e) {
            if (($e->errorInfo[0] ?? '') === '23000') {
                throw new ApiException(409, 'Ez a felhasználónév már létezik.');
            }
            throw $e;
        }
        unset($actor);
    }

    /** @param array{id:int,username:string,role:string} $actor */
    public function delete(int $id, array $actor): void
    {
        if ($this->users->findById($id) === null) {
            throw new ApiException(404, 'Nincs ilyen felhasználó.');
        }
        if ((int) $actor['id'] === $id) {
            throw new ApiException(409, 'A saját fiókodat nem törölheted.');
        }
        $this->assertNotLastAdmin($id);
        $this->users->delete($id);
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function present(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'username' => (string) $row['username'],
            'role' => (string) $row['role'],
            'created_at' => $row['created_at'],
        ];
    }

    private function username(mixed $value): string
    {
        $username = trim((string) $value);
        if (preg_match('/^[A-Za-z0-9._-]{3,50}$/', $username) !== 1) {
            throw new ApiException(400, 'A felhasználónév 3–50 karakter, betű, szám, pont, kötőjel vagy aláhúzás.');
        }

        return $username;
    }

    private function password(mixed $value, bool $required): string
    {
        $password = (string) $value;
        if ($password === '') {
            if ($required) {
                throw new ApiException(400, 'A jelszó kötelező, legalább 6 karakter.');
            }

            return '';
        }
        if (strlen($password) < 6 || strlen($password) > 200) {
            throw new ApiException(400, 'A jelszó legalább 6, legfeljebb 200 karakter.');
        }

        return $password;
    }

    private function role(mixed $value): string
    {
        $role = (string) $value;
        if (!Role::isValid($role)) {
            throw new ApiException(400, 'Érvénytelen szerepkör. Lehetséges: specialist, warehouse_manager, warehouse_worker, admin.');
        }

        return $role;
    }

    private function assertNotLastAdmin(int $id): void
    {
        $user = $this->users->findById($id);
        if ($user !== null && (string) $user['role'] === Role::ADMIN && $this->users->countByRole(Role::ADMIN) <= 1) {
            throw new ApiException(409, 'Az utolsó adminisztrátort nem lehet törölni vagy más szerepkörre tenni.');
        }
    }
}

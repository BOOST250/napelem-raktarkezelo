<?php

declare(strict_types=1);

namespace Napelem\Service;

use Napelem\Domain\Role;
use Napelem\Http\ApiException;
use Napelem\Middleware\SessionMiddleware;
use Napelem\Repository\UserRepository;

/**
 * Bejelentkezés jelszóhash-sel. A munkamenetben csak id, username és role van,
 * jelszó soha. A szerepkört minden védett kérésnél újraolvassuk az adatbázisból.
 */
final class AuthService
{
    private const DUMMY_HASH = '$2y$10$uA0V1/UfZDD1BtskoH2GCu2oCErckQdS.TZbwknAPVEii/.Wac/Ue';

    public function __construct(private readonly UserRepository $users)
    {
    }

    /** @return array{id:int,username:string,role:string} */
    public function login(string $username, string $password): array
    {
        SessionMiddleware::start();
        $username = trim($username);
        if ($username === '' || $password === '') {
            throw new ApiException(400, 'Add meg a felhasználónevet és a jelszót.');
        }

        $row = $this->users->findByUsername($username);
        if ($row === null) {
            password_verify($password, self::DUMMY_HASH);
            throw new ApiException(401, 'Hibás felhasználónév vagy jelszó.');
        }
        if (!$this->passwordMatches($row, $password)) {
            throw new ApiException(401, 'Hibás felhasználónév vagy jelszó.');
        }

        $user = $this->publicUser($row);
        session_regenerate_id(true);
        $_SESSION['user'] = $user;

        return $user;
    }

    public function logout(): void
    {
        SessionMiddleware::start();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'] !== '' ? $params['path'] : '/',
                'domain' => $params['domain'],
                'secure' => (bool) $params['secure'],
                'httponly' => (bool) $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]);
        }
        session_destroy();
    }

    /** @return array{id:int,username:string,role:string}|null */
    public function currentUser(): ?array
    {
        SessionMiddleware::start();
        $session = $_SESSION['user'] ?? null;
        if (!is_array($session) || !isset($session['id'])) {
            return null;
        }

        $row = $this->users->findById((int) $session['id']);
        if ($row === null) {
            unset($_SESSION['user']);

            return null;
        }

        $user = $this->publicUser($row);
        $_SESSION['user'] = $user;

        return $user;
    }

    /**
     * @param list<string> $roles üres lista: bármelyik ismert szerepkör
     * @return array{id:int,username:string,role:string}
     */
    public function requireLogin(array $roles = []): array
    {
        $user = $this->currentUser();
        if ($user === null) {
            throw new ApiException(401, 'Nincs bejelentkezve.');
        }

        $allowed = $roles === [] ? Role::ANY : $roles;
        if (!in_array($user['role'], $allowed, true)) {
            throw new ApiException(403, 'Ehhez a művelethez nincs jogosultságod.');
        }

        return $user;
    }

    /** @param array<string, mixed> $row */
    private function passwordMatches(array $row, string $password): bool
    {
        $stored = (string) $row['password'];
        $info = password_get_info($stored);

        if (!empty($info['algo'])) {
            if (!password_verify($password, $stored)) {
                return false;
            }
            if (password_needs_rehash($stored, PASSWORD_DEFAULT)) {
                $this->users->updatePassword((int) $row['id'], password_hash($password, PASSWORD_DEFAULT));
            }

            return true;
        }

        if (!hash_equals($stored, $password)) {
            password_verify($password, self::DUMMY_HASH);

            return false;
        }

        $this->users->updatePassword((int) $row['id'], password_hash($password, PASSWORD_DEFAULT));

        return true;
    }

    /** @param array<string, mixed> $row @return array{id:int,username:string,role:string} */
    private function publicUser(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'username' => (string) $row['username'],
            'role' => (string) $row['role'],
        ];
    }
}

<?php
/**
 * Bejelentkezés kezelése PHP sessionnel.
 *
 * Használat (api/login.php, api/me.php, api/logout.php):
 *   Auth::cors();
 *   require_once __DIR__ . '/../config/database.php';
 *   $auth = new Auth($conn);
 *
 * Más végpont védelme (később): $auth->requireLogin(['warehouse_manager']);
 */
class Auth
{
    private mysqli $conn;

    public function __construct(mysqli $conn)
    {
        $this->conn = $conn;
        $this->startSession();
    }

    /**
     * CORS fejlécek a cookie-s (credentials) kérésekhez.
     * Csak http(s) origint tükrözünk (localhost vagy IP-cím). Más sémát nem engedünk.
     */
    public static function cors(string $methods = 'GET, POST, OPTIONS'): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (preg_match('~^https?://([A-Za-z0-9.-]+|\[[0-9A-Fa-f:]+\])(:\d+)?$~', $origin) === 1) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
            header('Vary: Origin');
        } else {
            header('Access-Control-Allow-Origin: *');
        }
        header('Access-Control-Allow-Methods: ' . $methods);
        header('Access-Control-Allow-Headers: Content-Type');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }

    public static function json(int $status, array $data): void
    {
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    private function startSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        // Nincs külön sessionnév és nincs Domain: a süti a megnyitott
        // hoszthoz kötődik (localhost vagy a gép IP-címe), neve PHPSESSID.
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        ]);
        session_start();
    }

    /**
     * Ellenőrzi a felhasználónevet és a jelszót, siker esetén elindítja a munkamenetet.
     * Visszaadja a felhasználót (jelszó nélkül), vagy null-t hibás adatoknál.
     */
    public function login(string $username, string $password): ?array
    {
        $stmt = $this->conn->prepare('SELECT id, username, password, role FROM users WHERE username = ?');
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row || !$this->checkPassword($row, $password)) {
            return null;
        }

        $user = [
            'id' => (int) $row['id'],
            'username' => $row['username'],
            'role' => $row['role'],
        ];
        session_regenerate_id(true);   // session fixation ellen
        $_SESSION['user'] = $user;
        return $user;
    }

    /**
     * password_verify a hash-elt jelszavakra.
     * Átmenet: a régebben sima szövegként mentett jelszót is elfogadja, és azonnal hash-re cseréli.
     */
    private function checkPassword(array $row, string $password): bool
    {
        $stored = (string) $row['password'];

        // ismeretlen formátumnál az algo null (PHP 7.4+) vagy 0 → sima szöveg
        if (!empty(password_get_info($stored)['algo'])) {
            if (!password_verify($password, $stored)) {
                return false;
            }
            if (password_needs_rehash($stored, PASSWORD_DEFAULT)) {
                $this->saveHash((int) $row['id'], $password);
            }
            return true;
        }

        if (!hash_equals($stored, $password)) {
            return false;
        }
        $this->saveHash((int) $row['id'], $password);
        return true;
    }

    private function saveHash(int $id, string $password): void
    {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $this->conn->prepare('UPDATE users SET password = ? WHERE id = ?');
        $stmt->bind_param('si', $hash, $id);
        $stmt->execute();
        $stmt->close();
    }

    public function currentUser(): ?array
    {
        return $_SESSION['user'] ?? null;
    }

    public function logout(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $p['path'],
                'httponly' => $p['httponly'],
                'samesite' => $p['samesite'],
            ]);
        }
        session_destroy();
    }

    /**
     * Védett végpontokhoz: 401, ha nincs bejelentkezve; 403, ha a szerepkör nem megfelelő.
     */
    public function requireLogin(array $roles = []): array
    {
        $user = $this->currentUser();
        if (!$user) {
            self::json(401, ['error' => 'Nincs bejelentkezve.']);
        }
        if ($roles && !in_array($user['role'], $roles, true)) {
            self::json(403, ['error' => 'Nincs jogosultságod ehhez a művelethez.']);
        }
        return $user;
    }
}

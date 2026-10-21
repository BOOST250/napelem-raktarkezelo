<?php

declare(strict_types=1);

namespace Napelem\Database;

use Napelem\Http\ApiException;
use PDO;
use PDOException;
use Throwable;

/** Egy kérés alatt egy PDO-kapcsolat, tranzakcióval. */
final class ConnectionFactory
{
    private ?PDO $pdo = null;

    /** @var array{host:string,username:string,password:string,database:string}|null */
    private ?array $config = null;

    public function pdo(): PDO
    {
        if ($this->pdo instanceof PDO) {
            return $this->pdo;
        }

        $config = $this->config();
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['host'], $config['database']);

        try {
            $pdo = new PDO($dsn, $config['username'], $config['password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            $pdo->exec(
                "SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'"
            );
        } catch (PDOException $e) {
            error_log('Adatbázis kapcsolat hiba: ' . $e->getMessage());
            throw new ApiException(500, 'Adatbázis kapcsolat hiba.');
        }

        return $this->pdo = $pdo;
    }

    /** @template T @param callable(): T $callback @return T */
    public function transaction(callable $callback): mixed
    {
        $pdo = $this->pdo();
        if ($pdo->inTransaction()) {
            return $callback();
        }

        $pdo->beginTransaction();
        try {
            $result = $callback();
            $pdo->commit();

            return $result;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /** @return array{host:string,username:string,password:string,database:string} */
    private function config(): array
    {
        if ($this->config !== null) {
            return $this->config;
        }

        if (!defined('NAPELEM_DB_CONFIG_ONLY')) {
            define('NAPELEM_DB_CONFIG_ONLY', true);
        }

        $configFile = dirname(__DIR__, 2) . '/config/database.php';
        if (!is_file($configFile)) {
            throw new ApiException(500, 'Hiányzik a config/database.php.');
        }

        require $configFile;

        /** @var string $host */
        /** @var string $username */
        /** @var string $password */
        /** @var string $database */
        $this->config = [
            'host' => $host,
            'username' => $username,
            'password' => $password,
            'database' => $database,
        ];

        return $this->config;
    }
}

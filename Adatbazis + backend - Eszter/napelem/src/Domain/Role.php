<?php

declare(strict_types=1);

namespace Napelem\Domain;

/** A users.role mező engedélyezett értékei (az illesztő SQL után). */
final class Role
{
    public const SPECIALIST = 'specialist';
    public const MANAGER = 'warehouse_manager';
    public const WORKER = 'warehouse_worker';
    public const ADMIN = 'admin';

    public const ANY = [
        self::SPECIALIST,
        self::MANAGER,
        self::WORKER,
        self::ADMIN,
    ];

    /** Raktárvezetői írási műveletek. Az admin a demó és a felhasználókezelés miatt járulékosan bent van. */
    public const MANAGER_AREA = [self::MANAGER, self::ADMIN];

    public const SPECIALIST_AREA = [self::SPECIALIST, self::ADMIN];

    public const WORKER_AREA = [self::WORKER, self::MANAGER, self::ADMIN];

    /** Ivett felülete: raktáros, az admin is beléphet. A raktárvezető nem. */
    public const PICKING = [self::WORKER, self::ADMIN];

    public static function isValid(string $role): bool
    {
        return in_array($role, self::ANY, true);
    }
}

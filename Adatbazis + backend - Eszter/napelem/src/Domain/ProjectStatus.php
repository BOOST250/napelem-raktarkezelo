<?php

declare(strict_types=1);

namespace Napelem\Domain;

/**
 * Projektállapotok és a szakember által kezdeményezhető lépések.
 * A Wait → Scheduled váltást a foglalás, a Scheduled → InProgress váltást
 * a raktárosi kivételezés is elvégezheti (nem csak a szakember).
 */
final class ProjectStatus
{
    public const NEW = 'New';
    public const DRAFT = 'Draft';
    public const WAIT = 'Wait';
    public const SCHEDULED = 'Scheduled';
    public const IN_PROGRESS = 'InProgress';
    public const COMPLETED = 'Completed';
    public const FAILED = 'Failed';

    public const ALL = [
        self::NEW,
        self::DRAFT,
        self::WAIT,
        self::SCHEDULED,
        self::IN_PROGRESS,
        self::COMPLETED,
        self::FAILED,
    ];

    public const ACTIVE = [
        self::NEW,
        self::DRAFT,
        self::WAIT,
        self::SCHEDULED,
        self::IN_PROGRESS,
    ];

    /** @var array<string, list<string>> */
    public const SPECIALIST_TRANSITIONS = [
        self::NEW => [self::DRAFT],
        self::DRAFT => [self::WAIT],
        self::WAIT => [],
        self::SCHEDULED => [self::IN_PROGRESS],
        self::IN_PROGRESS => [self::COMPLETED, self::FAILED],
        self::COMPLETED => [],
        self::FAILED => [],
    ];

    public static function isValid(string $status): bool
    {
        return in_array($status, self::ALL, true);
    }

    public static function isActive(string $status): bool
    {
        return in_array($status, self::ACTIVE, true);
    }

    public static function specialistCan(string $from, string $to): bool
    {
        return in_array($to, self::SPECIALIST_TRANSITIONS[$from] ?? [], true);
    }

    /** SQL-be illeszthető, fix lista. Nem felhasználói bemenet. */
    public static function activeSqlList(): string
    {
        return "'" . implode("','", self::ACTIVE) . "'";
    }
}

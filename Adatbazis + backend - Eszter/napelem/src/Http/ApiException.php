<?php

declare(strict_types=1);

namespace Napelem\Http;

use RuntimeException;

/** Üzleti vagy validációs hiba, amit a kliens magyar JSON-üzenetként kap. */
final class ApiException extends RuntimeException
{
    public function __construct(
        private readonly int $status,
        string $message,
    ) {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }
}

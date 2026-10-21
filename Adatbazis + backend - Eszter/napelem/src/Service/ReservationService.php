<?php

declare(strict_types=1);

namespace Napelem\Service;

use Napelem\Domain\ProjectStatus;
use Napelem\Repository\BinRepository;
use Napelem\Repository\HistoryRepository;
use Napelem\Repository\ProjectPartRepository;
use Napelem\Repository\ProjectRepository;

/**
 * Előfoglalás (reserved = 0) és tényleges foglalás (reserved = 1).
 * A foglalás tételenként mindent-vagy-semmi, mert a reserved mező logikai.
 */
final class ReservationService
{
    public function __construct(
        private readonly BinRepository $bins,
        private readonly ProjectPartRepository $lines,
        private readonly ProjectRepository $projects,
        private readonly HistoryRepository $history,
    ) {
    }

    public function freeStock(int $partId): int
    {
        return $this->bins->stock($partId) - $this->lines->reservedOutstanding($partId);
    }

    public function demandCount(int $projectId): int
    {
        return $this->lines->countForProject($projectId);
    }

    public function isFullyReserved(int $projectId): bool
    {
        return $this->lines->countForProject($projectId) > 0
            && $this->lines->unreservedCount($projectId) === 0;
    }

    /**
     * Egy projekt minden még nem foglalt során végigmegy.
     * Igaz, ha volt legalább egy sor, és mindegyiket le lehetett foglalni.
     */
    public function reserveWholeProject(int $projectId): bool
    {
        $this->bins->lockAll();
        $lines = $this->lines->unreservedForProjectForUpdate($projectId);
        if ($lines === []) {
            return false;
        }

        $all = true;
        foreach ($lines as $line) {
            $partId = (int) $line['part_id'];
            $quantity = (int) $line['quantity'];
            if ($quantity <= $this->freeStock($partId)) {
                $this->lines->markReserved($projectId, $partId);
            } else {
                $all = false;
            }
        }

        return $all;
    }

    /**
     * Bevételezés után: előbb Wait, aztán Draft. A teljesen fedezett Wait projekt Scheduled lesz.
     *
     * @return array{reserved:int,scheduled:list<array{id:int,name:string}>}
     */
    public function autoReservePart(int $partId, int $userId): array
    {
        $this->bins->lockAll();
        $free = $this->freeStock($partId);
        $reservedQty = 0;
        /** @var array<int, array<string, mixed>> $touched */
        $touched = [];

        foreach ($this->lines->unreservedCandidatesForUpdate($partId) as $line) {
            $quantity = (int) $line['quantity'];
            if ($quantity > $free) {
                continue;
            }
            $projectId = (int) $line['project_id'];
            $this->lines->markReserved($projectId, $partId);
            $free -= $quantity;
            $reservedQty += $quantity;
            $touched[$projectId] = $line;
        }

        $scheduled = [];
        foreach ($touched as $projectId => $line) {
            if ((string) $line['status'] !== ProjectStatus::WAIT) {
                continue;
            }
            $this->lines->lockProject($projectId);
            if ($this->lines->unreservedCount($projectId) > 0) {
                continue;
            }
            $this->projects->updateFields($projectId, ['status' => ProjectStatus::SCHEDULED]);
            $this->history->add($projectId, ProjectStatus::SCHEDULED, $userId);
            $scheduled[] = [
                'id' => $projectId,
                'name' => trim((string) $line['customer_name'] . ' – ' . (string) $line['location']),
            ];
        }

        return ['reserved' => $reservedQty, 'scheduled' => $scheduled];
    }
}

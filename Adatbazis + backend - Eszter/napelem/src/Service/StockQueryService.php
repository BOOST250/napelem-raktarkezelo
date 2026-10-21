<?php

declare(strict_types=1);

namespace Napelem\Service;

use Napelem\Repository\MovementRepository;
use Napelem\Repository\ProjectPartRepository;

/** Hiányzó és lefoglalt listák, valamint a készletmozgás napló. */
final class StockQueryService
{
    public function __construct(
        private readonly ProjectPartRepository $lines,
        private readonly MovementRepository $movements,
    ) {
    }

    /** @return list<array<string, mixed>> */
    public function missing(): array
    {
        $groups = [];
        foreach ($this->lines->missingLines() as $row) {
            $partId = (int) $row['part_id'];
            if (!isset($groups[$partId])) {
                $groups[$partId] = [
                    'alkatresz_id' => $partId,
                    'nev' => (string) $row['part_name'],
                    'hianyzo_darab' => 0,
                    'projektek' => [],
                ];
            }
            $quantity = (int) $row['quantity'];
            $groups[$partId]['hianyzo_darab'] += $quantity;
            $groups[$partId]['projektek'][] = [
                'id' => (int) $row['project_id'],
                'nev' => trim((string) $row['customer_name'] . ' – ' . (string) $row['location']),
                'statusz' => (string) $row['status'],
                'darab' => $quantity,
            ];
        }

        return array_values($groups);
    }

    /** @return list<array<string, mixed>> */
    public function reserved(): array
    {
        $out = [];
        foreach ($this->lines->reservedLines() as $row) {
            $still = (int) $row['quantity'] - (int) $row['issued_quantity'];
            $out[] = [
                'projekt_id' => (int) $row['project_id'],
                'projekt_nev' => trim((string) $row['customer_name'] . ' – ' . (string) $row['location']),
                'statusz' => (string) $row['status'],
                'alkatresz_id' => (int) $row['part_id'],
                'nev' => (string) $row['part_name'],
                'darab' => $still,
                'igenyelt' => (int) $row['quantity'],
            ];
        }

        return $out;
    }

    /** @return list<array<string, mixed>> */
    public function movements(?int $projectId, ?int $partId, ?int $binId): array
    {
        $labels = ['receive' => 'bevetel', 'issue' => 'kiadas', 'adjust' => 'modositas'];
        $out = [];
        foreach ($this->movements->list($projectId, $partId, $binId) as $row) {
            $type = (string) $row['movement_type'];
            $out[] = [
                'id' => (int) $row['id'],
                'part_id' => (int) $row['part_id'],
                'part_name' => (string) $row['part_name'],
                'nev' => (string) $row['part_name'],
                'bin_id' => $row['bin_id'] === null ? null : (int) $row['bin_id'],
                'bin_identifier' => $row['bin_identifier'],
                'sor' => $row['row_num'] === null ? null : (int) $row['row_num'],
                'oszlop' => $row['col_num'] === null ? null : (int) $row['col_num'],
                'polc' => $row['level_num'] === null ? null : (int) $row['level_num'],
                'project_id' => $row['project_id'] === null ? null : (int) $row['project_id'],
                'user_id' => $row['user_id'] === null ? null : (int) $row['user_id'],
                'username' => $row['username'],
                'movement_type' => $type,
                'mozgas' => $labels[$type] ?? $type,
                'quantity' => (int) $row['quantity'],
                'darab' => (int) $row['quantity'],
                'note' => $row['note'],
                'created_at' => $row['created_at'],
            ];
        }

        return $out;
    }
}

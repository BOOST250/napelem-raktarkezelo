<?php

declare(strict_types=1);

namespace Napelem\Service;

use Napelem\Http\ApiException;
use Napelem\Repository\BinRepository;
use Napelem\Repository\PartRepository;
use Napelem\Support\Validator;
use PDOException;

final class BinService
{
    public function __construct(
        private readonly BinRepository $bins,
        private readonly PartRepository $parts,
    ) {
    }

    /** @return list<array<string, mixed>> */
    public function listRaw(?int $id = null, ?int $partId = null): array
    {
        $rows = $this->bins->all($partId);
        $out = [];
        foreach ($rows as $row) {
            if ($id !== null && (int) $row['id'] !== $id) {
                continue;
            }
            $out[] = $this->raw($row);
        }

        return $out;
    }

    /** @return list<array<string, mixed>> */
    public function listManager(): array
    {
        $out = [];
        foreach ($this->bins->all() as $row) {
            $out[] = $this->manager($row);
        }

        return $out;
    }

    /**
     * @return array<string, mixed> a létrehozott nyers sor
     */
    public function create(
        int $row,
        int $col,
        int $level,
        string $identifier,
        ?int $partId,
        int $quantity,
        int $maxCapacity,
    ): array {
        if ($this->bins->existsIdentifier($identifier)) {
            throw new ApiException(409, 'Ez a rekeszazonosító már foglalt.');
        }
        $this->assertContents($partId, $quantity, $maxCapacity);
        try {
            $id = $this->bins->insert($row, $col, $level, $identifier, $partId, $quantity, $maxCapacity);
        } catch (PDOException $e) {
            if (($e->errorInfo[0] ?? '') === '23000') {
                throw new ApiException(409, 'Ez a rekeszhely vagy azonosító már létezik.');
            }
            throw $e;
        }
        $created = $this->bins->find($id);
        if ($created === null) {
            throw new ApiException(500, 'A rekesz mentése nem sikerült.');
        }

        return $created;
    }

    /** @param array<string, mixed> $body @return array<string, mixed> */
    public function createFromLegacy(array $body): array
    {
        foreach (['row_num', 'col_num', 'level_num', 'identifier', 'max_capacity'] as $key) {
            if (!array_key_exists($key, $body)) {
                throw new ApiException(400, 'Hiányzó kötelező mező: row_num, col_num, level_num, identifier vagy max_capacity.');
            }
        }
        $partId = null;
        if (array_key_exists('part_id', $body) && $body['part_id'] !== null && $body['part_id'] !== '') {
            $partId = Validator::int($body['part_id'], 'part_id', 1);
        }
        $quantity = array_key_exists('quantity', $body) && $body['quantity'] !== null && $body['quantity'] !== ''
            ? Validator::int($body['quantity'], 'quantity', 0, 1000000)
            : 0;

        return $this->create(
            Validator::int($body['row_num'], 'row_num', 1, 9999),
            Validator::int($body['col_num'], 'col_num', 1, 9999),
            Validator::int($body['level_num'], 'level_num', 1, 9999),
            Validator::requiredString($body, 'identifier', 20, 'identifier'),
            $partId,
            $quantity,
            Validator::int($body['max_capacity'], 'max_capacity', 1, 1000000),
        );
    }

    /** @param array<string, mixed> $body @return array<string, mixed> */
    public function createFromHungarian(array $body): array
    {
        $row = Validator::int($body['sor'] ?? null, 'sor', 1, 999);
        $col = Validator::int($body['oszlop'] ?? null, 'oszlop', 1, 999);
        $level = Validator::int($body['polc'] ?? null, 'polc', 1, 999);
        $slot = Validator::int($body['rekesz'] ?? null, 'rekesz', 1, 9999);
        $identifier = sprintf('S%d-O%d-P%d-R%d', $row, $col, $level, $slot);
        if (strlen($identifier) > 20) {
            throw new ApiException(400, 'A generált rekeszazonosító túl hosszú. Használj kisebb sorszámokat.');
        }
        $max = 20;
        if (array_key_exists('max_kapacitas', $body)) {
            $max = Validator::int($body['max_kapacitas'], 'max_kapacitas', 1, 1000000);
        } elseif (array_key_exists('max_capacity', $body)) {
            $max = Validator::int($body['max_capacity'], 'max_capacity', 1, 1000000);
        }

        return $this->create($row, $col, $level, $identifier, null, 0, $max);
    }

    /** @param array<string, mixed> $body */
    public function update(int $id, array $body): void
    {
        $current = $this->bins->find($id);
        if ($current === null) {
            throw new ApiException(404, 'Nincs ilyen rekesz.');
        }

        $fields = [];
        if (array_key_exists('identifier', $body)) {
            $identifier = Validator::requiredString($body, 'identifier', 20, 'identifier');
            if ($this->bins->existsIdentifier($identifier, $id)) {
                throw new ApiException(409, 'Ez a rekeszazonosító már foglalt.');
            }
            $fields['identifier'] = $identifier;
        }
        if (array_key_exists('max_capacity', $body)) {
            $fields['max_capacity'] = Validator::int($body['max_capacity'], 'max_capacity', 1, 1000000);
        }
        if (array_key_exists('quantity', $body)) {
            $fields['quantity'] = Validator::int($body['quantity'], 'quantity', 0, 1000000);
        }
        if (array_key_exists('part_id', $body)) {
            if ($body['part_id'] === null || $body['part_id'] === '') {
                $fields['part_id'] = null;
            } else {
                $fields['part_id'] = Validator::int($body['part_id'], 'part_id', 1);
            }
        }
        if (array_key_exists('row_num', $body)) {
            $fields['row_num'] = Validator::int($body['row_num'], 'row_num', 1, 9999);
        }
        if (array_key_exists('col_num', $body)) {
            $fields['col_num'] = Validator::int($body['col_num'], 'col_num', 1, 9999);
        }
        if (array_key_exists('level_num', $body)) {
            $fields['level_num'] = Validator::int($body['level_num'], 'level_num', 1, 9999);
        }
        if ($fields === []) {
            throw new ApiException(400, 'Nincs módosítandó mező.');
        }

        $partId = array_key_exists('part_id', $fields) ? $fields['part_id'] : $this->nullableInt($current['part_id']);
        $quantity = array_key_exists('quantity', $fields) ? (int) $fields['quantity'] : (int) $current['quantity'];
        $maxCapacity = array_key_exists('max_capacity', $fields)
            ? (int) $fields['max_capacity']
            : (int) $current['max_capacity'];
        $this->assertContents($partId, $quantity, $maxCapacity);

        try {
            $this->bins->update($id, $fields);
        } catch (PDOException $e) {
            if (($e->errorInfo[0] ?? '') === '23000') {
                throw new ApiException(409, 'Ez a rekeszhely vagy azonosító már létezik, vagy az alkatrész nem létezik.');
            }
            throw $e;
        }
    }

    public function delete(int $id): void
    {
        $current = $this->bins->find($id);
        if ($current === null) {
            throw new ApiException(404, 'Nincs ilyen rekesz.');
        }
        if ((int) $current['quantity'] > 0) {
            throw new ApiException(409, 'A rekesz nem üres, ezért nem törölhető.');
        }
        $this->bins->delete($id);
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    public function raw(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'row_num' => (int) $row['row_num'],
            'col_num' => (int) $row['col_num'],
            'level_num' => (int) $row['level_num'],
            'identifier' => (string) $row['identifier'],
            'part_id' => $row['part_id'] === null ? null : (int) $row['part_id'],
            'quantity' => (int) $row['quantity'],
            'max_capacity' => (int) $row['max_capacity'],
        ];
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    public function manager(array $row): array
    {
        $identifier = (string) $row['identifier'];
        $col = (int) $row['col_num'];

        return [
            'id' => (int) $row['id'],
            'sor' => (int) $row['row_num'],
            'oszlop' => $col,
            'polc' => (int) $row['level_num'],
            'rekesz' => self::slotNumber($identifier, $col),
            'azonosito' => $identifier,
            'alkatresz_id' => $row['part_id'] === null ? null : (int) $row['part_id'],
            'darab' => (int) $row['quantity'],
            'max_kapacitas' => (int) $row['max_capacity'],
        ];
    }

    public static function slotNumber(string $identifier, int $col): int
    {
        if (preg_match('/-R(\d+)$/', $identifier, $match) === 1) {
            return (int) $match[1];
        }
        if (preg_match('/^\d+$/', $identifier) === 1) {
            return (int) $identifier;
        }

        return $col;
    }

    public static function placeLabel(array $bin): string
    {
        return sprintf(
            '%s (%d. sor, %d. oszlop, %d. polc)',
            $bin['identifier'],
            $bin['row_num'],
            $bin['col_num'],
            $bin['level_num']
        );
    }

    private function assertContents(?int $partId, int $quantity, int $maxCapacity): void
    {
        if ($quantity > $maxCapacity) {
            throw new ApiException(409, 'A darabszám nem lehet nagyobb a rekesz kapacitásánál.');
        }
        if ($partId === null) {
            if ($quantity !== 0) {
                throw new ApiException(400, 'Üres rekeszbe nem lehet darabszámot írni alkatrész nélkül.');
            }

            return;
        }
        $part = $this->parts->find($partId);
        if ($part === null) {
            throw new ApiException(404, 'Nincs ilyen alkatrész.');
        }
        $limit = min($maxCapacity, (int) $part['max_per_bin']);
        if ($quantity > $limit) {
            throw new ApiException(409, "Ebbe a rekeszbe ebből az alkatrészből legfeljebb $limit db fér.");
        }
    }

    private function nullableInt(mixed $value): ?int
    {
        return $value === null ? null : (int) $value;
    }
}

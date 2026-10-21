<?php

declare(strict_types=1);

namespace Napelem\Service;

use Napelem\Database\ConnectionFactory;
use Napelem\Http\ApiException;
use Napelem\Repository\BinRepository;
use Napelem\Repository\PartRepository;
use Napelem\Repository\ProjectPartRepository;
use Napelem\Support\Validator;
use PDOException;

final class PartService
{
    public function __construct(
        private readonly ConnectionFactory $db,
        private readonly PartRepository $parts,
        private readonly BinRepository $bins,
        private readonly ProjectPartRepository $projectParts,
    ) {
    }

    /** @return list<array<string, mixed>> */
    public function listRaw(?int $id = null): array
    {
        $rows = $this->parts->all();
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
        foreach ($this->parts->all() as $row) {
            $out[] = $this->manager($row);
        }

        return $out;
    }

    /** @return array<string, mixed> */
    public function create(string $name, float $price, int $maxPerBin): array
    {
        $this->assertNameFree($name);
        try {
            $id = $this->parts->insert($name, $price, $maxPerBin);
        } catch (PDOException $e) {
            if (($e->errorInfo[0] ?? '') === '23000') {
                throw new ApiException(409, 'Már létezik ilyen nevű alkatrész.');
            }
            throw $e;
        }

        $created = $this->parts->find($id);
        if ($created === null) {
            throw new ApiException(500, 'Az alkatrész mentése nem sikerült.');
        }

        return $created;
    }

    /** @param array<string, mixed> $fields @return array<string, mixed> */
    public function update(int $id, array $fields): array
    {
        return $this->db->transaction(function () use ($id, $fields) {
            $current = $this->parts->findForUpdate($id);
            if ($current === null) {
                throw new ApiException(404, 'Nincs ilyen alkatrész.');
            }
            if (isset($fields['name'])) {
                $other = $this->parts->findByName((string) $fields['name']);
                if ($other !== null && (int) $other['id'] !== $id) {
                    throw new ApiException(409, 'Már létezik ilyen nevű alkatrész.');
                }
            }
            if (isset($fields['max_per_bin'])) {
                $most = $this->bins->maxQuantityForPart($id);
                if ((int) $fields['max_per_bin'] < $most) {
                    throw new ApiException(
                        409,
                        "Van olyan rekesz, amelyben $most db van ebből – a maximum ennél nem lehet kisebb."
                    );
                }
            }
            try {
                $this->parts->update($id, $fields);
            } catch (PDOException $e) {
                if (($e->errorInfo[0] ?? '') === '23000') {
                    throw new ApiException(409, 'Már létezik ilyen nevű alkatrész.');
                }
                throw $e;
            }

            $updated = $this->parts->find($id);
            if ($updated === null) {
                throw new ApiException(404, 'Nincs ilyen alkatrész.');
            }

            return $updated;
        });
    }

    public function delete(int $id): void
    {
        if ($this->parts->find($id) === null) {
            throw new ApiException(404, 'Nincs ilyen alkatrész.');
        }
        if ($this->bins->stock($id) > 0) {
            throw new ApiException(409, 'Az alkatrész még készleten van, ezért nem törölhető.');
        }
        if ($this->parts->projectPartCount($id) > 0) {
            throw new ApiException(409, 'Az alkatrész projekthez van rendelve, ezért nem törölhető.');
        }
        if ($this->parts->movementCount($id) > 0) {
            throw new ApiException(409, 'Az alkatrészhez készletmozgás tartozik, ezért nem törölhető.');
        }
        $this->parts->delete($id);
    }

    /** @param array<string, mixed> $body @return array{name:string,price:float,max:int} */
    public function readCreateBody(array $body, bool $hungarian): array
    {
        if ($hungarian) {
            $name = Validator::requiredString($body, 'nev', 100, 'nev');
            $price = Validator::money($body['ar'] ?? null, 'ar');
            $max = Validator::int($body['max_darab'] ?? null, 'max_darab', 1, 100000);
        } else {
            $name = Validator::requiredString($body, 'name', 100, 'name');
            $price = Validator::money($body['price'] ?? null, 'price');
            $max = Validator::int($body['max_per_bin'] ?? null, 'max_per_bin', 1, 100000);
        }

        return ['name' => $name, 'price' => $price, 'max' => $max];
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function readUpdateBody(array $body, bool $hungarian): array
    {
        $fields = [];
        if ($hungarian) {
            if (array_key_exists('nev', $body)) {
                $fields['name'] = Validator::requiredString($body, 'nev', 100, 'nev');
            }
            if (array_key_exists('ar', $body)) {
                $fields['price'] = Validator::money($body['ar'], 'ar');
            }
            if (array_key_exists('max_darab', $body)) {
                $fields['max_per_bin'] = Validator::int($body['max_darab'], 'max_darab', 1, 100000);
            }
        } else {
            if (array_key_exists('name', $body)) {
                $fields['name'] = Validator::requiredString($body, 'name', 100, 'name');
            }
            if (array_key_exists('price', $body)) {
                $fields['price'] = Validator::money($body['price'], 'price');
            }
            if (array_key_exists('max_per_bin', $body)) {
                $fields['max_per_bin'] = Validator::int($body['max_per_bin'], 'max_per_bin', 1, 100000);
            }
        }
        if ($fields === []) {
            throw new ApiException(400, 'Nincs módosítandó mező.');
        }

        return $fields;
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    public function raw(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'price' => (float) $row['price'],
            'max_per_bin' => (int) $row['max_per_bin'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    public function manager(array $row): array
    {
        $id = (int) $row['id'];

        return [
            'id' => $id,
            'nev' => (string) $row['name'],
            'ar' => (float) $row['price'],
            'max_darab' => (int) $row['max_per_bin'],
            'keszlet' => $this->bins->stock($id),
            'lefoglalt' => $this->projectParts->reservedOutstanding($id),
        ];
    }

    /** @return array<string, mixed> */
    public function managerById(int $id): array
    {
        $row = $this->parts->find($id);
        if ($row === null) {
            throw new ApiException(404, 'Nincs ilyen alkatrész.');
        }

        return $this->manager($row);
    }

    private function assertNameFree(string $name): void
    {
        if ($this->parts->findByName($name) !== null) {
            throw new ApiException(409, 'Már létezik ilyen nevű alkatrész.');
        }
    }
}

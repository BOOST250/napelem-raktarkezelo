<?php

declare(strict_types=1);

namespace Napelem\Service;

use Napelem\Database\ConnectionFactory;
use Napelem\Http\ApiException;
use Napelem\Repository\BinRepository;
use Napelem\Repository\MovementRepository;
use Napelem\Repository\PartRepository;

/** Bevételezés egy tranzakcióban: rekesz, készletnapló, automatikus foglalás, állapotnapló. */
final class ReceivingService
{
    public function __construct(
        private readonly ConnectionFactory $db,
        private readonly PartRepository $parts,
        private readonly BinRepository $bins,
        private readonly MovementRepository $movements,
        private readonly ReservationService $reservations,
    ) {
    }

    /**
     * @param array<int, int> $items rekesz-azonosító => darab
     * @param array{id:int,username:string,role:string} $user
     * @return array{part_name:string,received:int,reserved:int,scheduled:list<array{id:int,name:string}>}
     */
    public function receive(int $partId, array $items, array $user): array
    {
        if ($partId <= 0 || $items === []) {
            throw new ApiException(400, 'Hiányzó vagy érvénytelen adat: part_id és items kötelező.');
        }

        return $this->db->transaction(function () use ($partId, $items, $user) {
            $this->bins->lockAll();
            $part = $this->parts->findForUpdate($partId);
            if ($part === null) {
                throw new ApiException(404, "Nincs ilyen alkatrész (id: $partId).");
            }
            $maxPerBin = (int) $part['max_per_bin'];

            ksort($items);
            $checked = [];
            foreach ($items as $binId => $quantity) {
                $bin = $this->bins->findForUpdate((int) $binId);
                if ($bin === null) {
                    throw new ApiException(404, 'Nincs ilyen rekesz (id: ' . (int) $binId . ').');
                }
                $place = BinService::placeLabel($bin);
                $samePart = $bin['part_id'] !== null && (int) $bin['part_id'] === $partId;
                $empty = (int) $bin['quantity'] === 0;
                if (!$samePart && !$empty) {
                    throw new ApiException(409, "A(z) „{$place}” rekeszben már más alkatrész van, ide nem lehet bevételezni.");
                }
                $current = $samePart ? (int) $bin['quantity'] : 0;
                $limit = min($maxPerBin, (int) $bin['max_capacity']);
                $next = $current + (int) $quantity;
                if ($next > $limit) {
                    $room = $limit - $current;
                    throw new ApiException(
                        409,
                        "A(z) „{$place}” rekeszbe csak $room db férne még ebből az alkatrészből (korlát: $limit db), de $quantity db-ot adtál meg."
                    );
                }
                $checked[] = ['bin_id' => (int) $binId, 'next' => $next, 'added' => (int) $quantity];
            }

            $received = 0;
            foreach ($checked as $row) {
                $this->bins->place($row['bin_id'], $partId, $row['next']);
                $this->movements->add(
                    $partId,
                    $row['bin_id'],
                    null,
                    (int) $user['id'],
                    'receive',
                    $row['added'],
                    'Bevételezés'
                );
                $received += $row['added'];
            }

            $reservation = $this->reservations->autoReservePart($partId, (int) $user['id']);

            return [
                'part_name' => (string) $part['name'],
                'received' => $received,
                'reserved' => $reservation['reserved'],
                'scheduled' => $reservation['scheduled'],
            ];
        });
    }
}

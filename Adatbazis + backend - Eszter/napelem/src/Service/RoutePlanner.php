<?php

declare(strict_types=1);

namespace Napelem\Service;

/**
 * Gyűjtési útvonal a rekeszek (sor, oszlop, polc) koordinátáin.
 * A bejárat a (0, 0, 1) pont. Az út nyílt: a bejárattól az utolsó rekeszig tart,
 * nem kell visszamenni. Legfeljebb 8 megállónál minden sorrendet megvizsgálunk,
 * efölött legközelebbi szomszéd, majd 2-opt javítás.
 *
 * Távolság: 10 × |sor| + 4 × |oszlop| + 1 × |polc|. A sorváltás a legdrágább,
 * mert az egy másik folyosó.
 */
final class RoutePlanner
{
    public const WEIGHT_ROW = 10;
    public const WEIGHT_COL = 4;
    public const WEIGHT_LEVEL = 1;

    /** @var array{sor:int,oszlop:int,polc:int,nev:string} */
    public const START = ['sor' => 0, 'oszlop' => 0, 'polc' => 1, 'nev' => 'Bejárat'];

    /**
     * @param list<array<string, mixed>> $stops
     * @return list<array<string, mixed>>
     */
    public function optimize(array $stops): array
    {
        $count = count($stops);
        if ($count <= 1) {
            return $stops;
        }
        if ($count <= 8) {
            return $this->exact($stops);
        }

        return $this->twoOpt($this->nearest($stops));
    }

    /** @param array{sor:int,oszlop:int,polc:int} $from @param array{sor:int,oszlop:int,polc:int} $to */
    public function distance(array $from, array $to): int
    {
        return self::WEIGHT_ROW * abs((int) $from['sor'] - (int) $to['sor'])
            + self::WEIGHT_COL * abs((int) $from['oszlop'] - (int) $to['oszlop'])
            + self::WEIGHT_LEVEL * abs((int) $from['polc'] - (int) $to['polc']);
    }

    /** @param list<array<string, mixed>> $stops */
    public function pathLength(array $stops): int
    {
        $length = 0;
        $previous = self::START;
        foreach ($stops as $stop) {
            $length += $this->distance($previous, $stop);
            $previous = $stop;
        }

        return $length;
    }

    /**
     * @param list<array<string, mixed>> $stops
     * @return list<array<string, mixed>>
     */
    private function nearest(array $stops): array
    {
        $remaining = $stops;
        $ordered = [];
        $position = self::START;
        while ($remaining !== []) {
            $bestIndex = 0;
            $bestDistance = PHP_INT_MAX;
            foreach ($remaining as $index => $stop) {
                $distance = $this->distance($position, $stop);
                $better = $distance < $bestDistance
                    || ($distance === $bestDistance && (int) $stop['bin_id'] < (int) $remaining[$bestIndex]['bin_id']);
                if ($better) {
                    $bestIndex = $index;
                    $bestDistance = $distance;
                }
            }
            $chosen = $remaining[$bestIndex];
            $ordered[] = $chosen;
            $position = $chosen;
            unset($remaining[$bestIndex]);
            $remaining = array_values($remaining);
        }

        return $ordered;
    }

    /**
     * @param list<array<string, mixed>> $stops
     * @return list<array<string, mixed>>
     */
    private function exact(array $stops): array
    {
        $best = $stops;
        $bestLength = PHP_INT_MAX;
        $this->permutations($stops, 0, function (array $candidate) use (&$best, &$bestLength): void {
            $length = $this->pathLength($candidate);
            if ($length < $bestLength) {
                $bestLength = $length;
                $best = $candidate;
            }
        });

        return $best;
    }

    /**
     * @param list<array<string, mixed>> $items
     * @param callable(list<array<string, mixed>>): void $onEach
     */
    private function permutations(array &$items, int $start, callable $onEach): void
    {
        if ($start >= count($items)) {
            $onEach($items);

            return;
        }
        for ($i = $start, $n = count($items); $i < $n; $i++) {
            [$items[$start], $items[$i]] = [$items[$i], $items[$start]];
            $this->permutations($items, $start + 1, $onEach);
            [$items[$start], $items[$i]] = [$items[$i], $items[$start]];
        }
    }

    /**
     * @param list<array<string, mixed>> $stops
     * @return list<array<string, mixed>>
     */
    private function twoOpt(array $stops): array
    {
        $count = count($stops);
        $improved = true;
        while ($improved) {
            $improved = false;
            for ($i = 0; $i < $count - 1; $i++) {
                for ($j = $i + 1; $j < $count; $j++) {
                    $candidate = $stops;
                    $slice = array_reverse(array_slice($candidate, $i, $j - $i + 1));
                    array_splice($candidate, $i, $j - $i + 1, $slice);
                    if ($this->pathLength($candidate) < $this->pathLength($stops)) {
                        $stops = $candidate;
                        $improved = true;
                    }
                }
            }
        }

        return $stops;
    }
}

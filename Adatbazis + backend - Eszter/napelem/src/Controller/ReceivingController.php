<?php

declare(strict_types=1);

namespace Napelem\Controller;

use Napelem\Http\ApiException;
use Napelem\Http\Input;
use Napelem\Http\Json;
use Napelem\Service\ReceivingService;
use Napelem\Support\Validator;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class ReceivingController
{
    public function __construct(private readonly ReceivingService $receiving)
    {
    }

    public function legacy(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = Input::body($request);
        $result = $this->receiving->receive(
            Validator::int($body['part_id'] ?? null, 'part_id', 1),
            $this->items($body['items'] ?? null, 'bin_id', 'quantity'),
            self::user($request)
        );

        return Json::send($response, $this->payload($result, true));
    }

    public function hungarian(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = Input::body($request);
        $result = $this->receiving->receive(
            Validator::int($body['alkatresz_id'] ?? null, 'alkatresz_id', 1),
            $this->items($body['tetelek'] ?? null, 'rekesz_id', 'darab'),
            self::user($request)
        );

        return Json::send($response, $this->payload($result, false));
    }

    /**
     * @param array{part_name:string,received:int,reserved:int,scheduled:list<array{id:int,name:string}>} $result
     * @return array<string, mixed>
     */
    private function payload(array $result, bool $legacyMessage): array
    {
        $hungarian = [];
        $english = [];
        foreach ($result['scheduled'] as $project) {
            $hungarian[] = ['id' => $project['id'], 'nev' => $project['name']];
            $english[] = ['id' => $project['id'], 'name' => $project['name']];
        }

        return [
            'ok' => true,
            'success' => true,
            'message' => $legacyMessage
                ? 'Bevételezés rögzítve: ' . $result['received'] . ' db ' . $result['part_name'] . '.'
                : 'Bevételezés rögzítve: ' . $result['received'] . ' db ' . $result['part_name'] . '.',
            'received' => $result['received'],
            'reserved' => $result['reserved'],
            'lefoglalva' => $result['reserved'],
            'scheduled_projects' => $english,
            'utemezett_projektek' => $hungarian,
        ];
    }

    /**
     * @return array<int, int>
     */
    private function items(mixed $items, string $binKey, string $qtyKey): array
    {
        if (!is_array($items) || $items === []) {
            throw new ApiException(400, 'Hiányzó vagy érvénytelen adat: a tételek listája kötelező.');
        }
        $merged = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                throw new ApiException(400, 'Minden tételnél kell érvényes rekesz és pozitív darabszám.');
            }
            $binId = Validator::int($item[$binKey] ?? null, $binKey, 1);
            $quantity = Validator::int($item[$qtyKey] ?? null, $qtyKey, 1, 1000000);
            $merged[$binId] = ($merged[$binId] ?? 0) + $quantity;
        }

        return $merged;
    }

    /** @return array{id:int,username:string,role:string} */
    private static function user(ServerRequestInterface $request): array
    {
        /** @var array{id:int,username:string,role:string} $user */
        $user = $request->getAttribute('user');

        return $user;
    }
}

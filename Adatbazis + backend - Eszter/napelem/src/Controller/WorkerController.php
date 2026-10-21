<?php

declare(strict_types=1);

namespace Napelem\Controller;

use Napelem\Http\ApiException;
use Napelem\Http\Input;
use Napelem\Http\Json;
use Napelem\Service\PickingService;
use Napelem\Service\StockQueryService;
use Napelem\Support\Validator;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/** Ivett raktárosi felületének három végpontja. */
final class WorkerController
{
    public function __construct(
        private readonly PickingService $picking,
        private readonly StockQueryService $stock,
    ) {
    }

    public function projects(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        unset($request);

        return Json::send($response, $this->picking->catalog());
    }

    public function begin(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = Input::body($request);
        if (!array_key_exists('project_id', $body) || $body['project_id'] === null || $body['project_id'] === '') {
            throw new ApiException(400, 'Hiányzó project_id.');
        }
        $projectId = Validator::int($body['project_id'], 'project_id', 1);

        /** @var array{id:int,username:string,role:string} $user */
        $user = $request->getAttribute('user');

        return Json::send($response, $this->picking->begin($projectId, $user));
    }

    public function places(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $projectId = Input::queryInt($request, 'project_id');
        if ($projectId === null || $projectId < 1) {
            throw new ApiException(400, 'Hiányzó project_id.');
        }

        return Json::send($response, $this->picking->places($projectId));
    }

    public function movements(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return Json::send($response, $this->stock->movements(
            Input::queryInt($request, 'project_id', 'projekt_id'),
            Input::queryInt($request, 'part_id', 'alkatresz_id'),
            Input::queryInt($request, 'bin_id', 'rekesz_id')
        ));
    }
}

<?php

declare(strict_types=1);

namespace Napelem\Controller;

use Napelem\Http\Input;
use Napelem\Http\Json;
use Napelem\Service\ProjectPartService;
use Napelem\Support\Validator;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class ProjectPartController
{
    public function __construct(private readonly ProjectPartService $lines)
    {
    }

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return Json::send($response, $this->lines->list(Input::queryInt($request, 'project_id')));
    }

    public function create(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = Input::body($request);
        $this->lines->create($body);

        return Json::send($response, [
            'success' => true,
            'message' => 'Alkatrész hozzárendelve a projekthez!',
            'project_id' => (int) $body['project_id'],
            'part_id' => (int) $body['part_id'],
        ], 201);
    }

    public function update(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $projectId = Validator::int(Input::queryInt($request, 'project_id'), 'project_id', 1);
        $partId = Validator::int(Input::queryInt($request, 'part_id'), 'part_id', 1);
        $this->lines->update($projectId, $partId, Input::body($request));

        return Json::send($response, [
            'success' => true,
            'message' => 'Projekt-alkatrész kapcsolat módosítva!',
            'project_id' => $projectId,
            'part_id' => $partId,
        ]);
    }

    public function delete(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $projectId = Validator::int(Input::queryInt($request, 'project_id'), 'project_id', 1);
        $partId = Validator::int(Input::queryInt($request, 'part_id'), 'part_id', 1);
        $this->lines->delete($projectId, $partId);

        return Json::send($response, [
            'success' => true,
            'message' => 'Projekt-alkatrész kapcsolat törölve!',
            'project_id' => $projectId,
            'part_id' => $partId,
        ]);
    }
}

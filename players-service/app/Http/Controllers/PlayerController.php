<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\PlayerService;
use App\Http\Resources\PlayerResource;
use Illuminate\Validation\Rule;

class PlayerController extends Controller
{
    protected $service;

    public function __construct(PlayerService $service)
    {
        $this->service = $service;
    }

    public function index(Request $request)
    {
        $players = $this->service->paginatePlayers($request->only(['search', 'team', 'per_page']));

        return PlayerResource::collection($players);
    }

    public function show($id)
    {
        $player = $this->service->getPlayerById((int) $id);

        return new PlayerResource($player);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'email' => 'required|email|unique:players,email',
            'age' => 'nullable|integer|min:0',
            'team' => 'nullable|string|max:255',
            'position' => 'nullable|string|max:255',
            'number' => 'nullable|integer|min:0|max:999',
            'nationality' => 'nullable|string|max:255',
        ]);

        $player = $this->service->createPlayer($data);

        return (new PlayerResource($player))
            ->response()
            ->setStatusCode(201);
    }

    public function update(Request $request, $id)
    {
        $data = $request->validate([
            'name' => 'sometimes|string',
            'email' => ['sometimes', 'email', Rule::unique('players', 'email')->ignore((int) $id)],
            'age' => 'nullable|integer|min:0',
            'team' => 'nullable|string|max:255',
            'position' => 'nullable|string|max:255',
            'number' => 'nullable|integer|min:0|max:999',
            'nationality' => 'nullable|string|max:255',
        ]);

        $player = $this->service->updatePlayer((int) $id, $data);

        return new PlayerResource($player);
    }

    public function destroy($id)
    {
        $this->service->deletePlayer((int) $id);

        return response()->json(['message' => 'Player deleted successfully']);
    }

    public function playersByTeam(string $team)
    {
        $players = $this->service->getPlayers(['team' => $team]);

        return PlayerResource::collection($players);
    }
}

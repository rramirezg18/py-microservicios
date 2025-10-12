<?php

namespace App\Services;

use App\Repositories\PlayerRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class PlayerService
{
    protected $repository;

    public function __construct(PlayerRepository $repository)
    {
        $this->repository = $repository;
    }

    public function paginatePlayers(array $filters = []): LengthAwarePaginator
    {
        $search = $filters['search'] ?? null;
        $team = $filters['team'] ?? null;
        $perPage = max(1, min(100, (int)($filters['per_page'] ?? 10)));

        return $this->repository->paginate($search, $team, $perPage);
    }

    public function getPlayers(array $filters = []): Collection
    {
        $search = $filters['search'] ?? null;
        $team = $filters['team'] ?? null;

        return $this->repository->getAll($search, $team);
    }

    public function getPlayerById(int $id)
    {
        return $this->repository->findById($id);
    }

    public function createPlayer(array $data)
    {
        return $this->repository->create($data);
    }

    public function updatePlayer(int $id, array $data)
    {
        return $this->repository->update($id, $data);
    }

    public function deletePlayer(int $id): void
    {
        $this->repository->delete($id);
    }
}

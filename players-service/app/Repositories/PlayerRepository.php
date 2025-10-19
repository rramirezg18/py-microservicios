<?php

namespace App\Repositories;

use App\Models\Player;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Builder;

class PlayerRepository
{
    public function paginate(?string $search, ?string $team, int $perPage = 10): LengthAwarePaginator
    {
        return $this->query($search, $team)
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function getAll(?string $search = null, ?string $team = null): Collection
    {
        return $this->query($search, $team)
            ->orderBy('name')
            ->get();
    }

    public function findById(int $id): Player
    {
        return Player::findOrFail($id);
    }

    public function create(array $data): Player
    {
        return Player::create($data);
    }

    public function update(int $id, array $data): Player
    {
        $player = $this->findById($id);
        $player->update($data);

        return $player;
    }

    public function delete(int $id): void
    {
        $player = $this->findById($id);
        $player->delete();
    }

    protected function query(?string $search, ?string $team): Builder
    {
        return Player::query()
            ->when($search, function (Builder $query) use ($search) {
                $query->where(function (Builder $inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('team', 'like', "%{$search}%")
                        ->orWhere('position', 'like', "%{$search}%");
                });
            })
            ->when($team, function (Builder $query) use ($team) {
                $query->where('team', 'like', "%{$team}%");
            });
    }
}

<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Player
 */
class PlayerResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'age' => $this->age,
            'team' => $this->team,
            'position' => $this->position,
            'number' => $this->number,
            'nationality' => $this->nationality,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

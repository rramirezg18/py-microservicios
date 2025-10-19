<?php

namespace Database\Factories;

use App\Models\Player;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Player>
 */
class PlayerFactory extends Factory
{
    protected $model = Player::class;

    public function definition(): array
    {
        $teams = ['Sharks', 'Falcons', 'Titans', 'Warriors'];
        $positions = ['Base', 'Escolta', 'Alero', 'Ala-Pívot', 'Pívot'];

        return [
            'name' => $this->faker->name(),
            'email' => $this->faker->unique()->safeEmail(),
            'age' => $this->faker->numberBetween(18, 38),
            'team' => $this->faker->randomElement($teams),
            'position' => $this->faker->randomElement($positions),
            'number' => $this->faker->numberBetween(0, 99),
            'nationality' => $this->faker->country(),
        ];
    }
}

<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PlayerController;

Route::get('/ping', function () {
    return response()->json(['message' => 'Players Service API is running 🚀']);
});

Route::get('players/by-team/{team}', [PlayerController::class, 'playersByTeam']);
Route::apiResource('players', PlayerController::class);

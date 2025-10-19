<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Player extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'name',
        'email',
        'age',
        'team',
        'position',
        'number',
        'nationality',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'age' => 'integer',
        'number' => 'integer',
    ];
}

<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Foundation\Http\MaintenanceModeManager;
use Illuminate\Contracts\Foundation\MaintenanceMode;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Fix para el error "MaintenanceMode is not instantiable"
        $this->app->singleton(MaintenanceMode::class, function ($app) {
            return $app->make(MaintenanceModeManager::class);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}

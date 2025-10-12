<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\MaintenanceMode\FileMaintenanceMode;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Middleware globales (si los necesitas)
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Manejo de excepciones globales
    })
    ->create(function ($app) {
        // ✅ Registrar directamente FileMaintenanceMode sin contrato
        $app->singleton(FileMaintenanceMode::class);
    });

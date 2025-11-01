// src/routes/playerRoutes.js
const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');
const { validateCreatePlayer, validateUpdatePlayer } = require('../middlewares/validationMiddleware');
const { requireAuth, requireRole, requireAnyRole } = require('../middlewares/auth');

// Lecturas: Admin o Control
router.get('/players',            requireAnyRole('Admin','Control'), playerController.getAllPlayers);
router.get('/players/:id',        requireAnyRole('Admin','Control'), playerController.getPlayerById);
router.get('/players/team/:teamId', requireAnyRole('Admin','Control'), playerController.getPlayersByTeam);

// Escrituras: solo Admin
router.post('/players',           requireAuth, requireRole('Admin'), validateCreatePlayer, playerController.createPlayer);
router.put('/players/:id',        requireAuth, requireRole('Admin'), validateUpdatePlayer, playerController.updatePlayer);
router.delete('/players/:id',     requireAuth, requireRole('Admin'), playerController.deletePlayer);

module.exports = router;

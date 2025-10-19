// src/app.js

const express = require('express');
require('dotenv').config();
const { pool, connectWithRetry } = require('./config/database');
const playerRoutes = require('./routes/playerRoutes');
const { notFound, errorHandler } = require('./utils/apiResponse');
const logger = require('./config/logger');

const app = express();
const port = process.env.PORT || 3000;

async function initializeDatabase() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        age INT NOT NULL,
        position VARCHAR(100),
        team_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    await pool.query(createTableQuery);
    logger.info('👍 Tabla "players" (con team_id) verificada/creada con éxito.');
  } catch (error) {
    logger.error('❌ Error al inicializar la tabla "players":', { error: error.message });
    throw error;
  }
}

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: '¡El servicio de jugadores está funcionando! 🚀' });
});

// Usamos las rutas bajo el prefijo /api
app.use('/api', playerRoutes);

app.use(notFound);
app.use(errorHandler);

async function startServer() {
  try {
    await connectWithRetry();
    await initializeDatabase();

    app.listen(port, () => {
      logger.info(`🚀 Servidor escuchando en http://localhost:${port}`);
    });
  } catch (error) {
    logger.error('Fatal error: Could not start server.', { error: error.message });
    process.exit(1);
  }
}

startServer();
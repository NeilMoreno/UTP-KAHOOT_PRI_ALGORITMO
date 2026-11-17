// ==============================================================
// codeInt - Servidor Principal API RESTful & WebSocket
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

// Cargar variables de entorno desde .env en la raíz
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { corsOptions, corsOptionsDelegate, securityHeaders, apiLimiter } = require('./config/security');
const { testConnection, pool } = require('./config/database');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

// Importar enrutadores
const authRoutes = require('./routes/authRoutes');
const cursoRoutes = require('./routes/cursoRoutes');
const mundoRoutes = require('./routes/mundoRoutes');
const ejercicioRoutes = require('./routes/ejercicioRoutes');
const aiRoutes = require('./routes/aiRoutes');
const salaRoutes = require('./routes/salaRoutes');
const gamificacionRoutes = require('./routes/gamificacionRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const { setupKahootSockets } = require('./sockets/kahootHandler');
const { cancelOrphanRooms } = require('./services/salaService');

const app = express();
const server = http.createServer(app);
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);

// Inicializar Socket.io con CORS permisivo para desarrollo y frontend
const io = new Server(server, {
    cors: corsOptions
});

// Adjuntar instancia de Socket.io en req para su uso en controladores si es necesario
app.set('io', io);

// Middlewares globales
app.use(securityHeaders);
app.use(cors(corsOptionsDelegate));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb', parameterLimit: 100, depth: 5 }));
app.use('/api', apiLimiter);

// Servir frontend estático si existe
app.use(express.static(path.resolve(__dirname, '../frontend')));
app.use('/public', express.static(path.resolve(__dirname, '../public')));

// Ruta de comprobación de salud (Health Check)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        sistema: 'codeInt',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Montar Rutas del API
app.use('/api/auth', authRoutes);
app.use('/api/cursos', cursoRoutes);
app.use('/api/mundos', mundoRoutes);
app.use('/api/ejercicios', ejercicioRoutes);
app.use('/api/ia', aiRoutes);
app.use('/api/salas', salaRoutes);
app.use('/api/gamificacion', gamificacionRoutes);
app.use('/api/analiticas', analyticsRoutes);

// Manejador de rutas no encontradas (404)
app.use(notFoundHandler);

// Manejador centralizado de errores
app.use(errorHandler);

// Motor Kahoot multijugador (autenticación JWT y eventos de sala)
setupKahootSockets(io);

const PORT = parseInt(process.env.PORT || '3000', 10);

// Iniciar servidor solo si es ejecutado directamente
if (require.main === module) {
    server.listen(PORT, async () => {
        console.log('==============================================================');
        console.log(`🚀 [codeInt Server] Servidor backend ejecutándose en: http://localhost:${PORT}`);
        console.log(`📌 API Base: http://localhost:${PORT}/api`);
        console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
        console.log('==============================================================');

        // Probar conexión a PostgreSQL
        await testConnection();

        // El estado de las salas vive en memoria: las que siguieron activas antes del reinicio se cancelan.
        try {
            const cancelled = await cancelOrphanRooms();
            if (cancelled > 0) console.log(`🧹 [Kahoot] ${cancelled} sala(s) huérfana(s) canceladas al iniciar.`);
        } catch (error) {
            console.error('❌ [Kahoot] No se pudieron cancelar las salas huérfanas:', error.message);
        }
    });
}

const shutdown = async (signal) => {
    console.log(`Recibida señal ${signal}. Cerrando conexiones.`);
    io.close();
    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
};

if (require.main === module) {
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
}

module.exports = {
    app,
    server,
    io
};

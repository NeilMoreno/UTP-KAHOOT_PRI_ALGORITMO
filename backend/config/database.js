// ==============================================================
// codeInt - Configuración y Conexión PostgreSQL (pg Pool)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno desde la raíz
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const useSsl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

const connectionConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: useSsl ? { rejectUnauthorized } : false
    }
    : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'codeint_db',
        ssl: useSsl ? { rejectUnauthorized } : false
    };

const pool = new Pool({
    ...connectionConfig,
    max: Math.min(50, Math.max(2, Number.parseInt(process.env.DB_POOL_MAX || '20', 10))),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: Math.max(1000, Number.parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '15000', 10)),
    query_timeout: Math.max(1000, Number.parseInt(process.env.DB_QUERY_TIMEOUT_MS || '20000', 10)),
    application_name: 'codeint-api'
});

// Eventos del pool
pool.on('error', (err) => {
    console.error('❌ [Database Pool Error] Error inesperado en cliente inactivo de PostgreSQL:', err.message);
});

/**
 * Ejecuta una consulta SQL parametrizada
 * @param {string} text - Consulta SQL
 * @param {Array} params - Parámetros de la consulta
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = async (text, params = []) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.DEBUG_SQL === 'true') {
            console.log(`⏱️ [SQL Query] (${duration}ms):`, text, { parameterCount: params.length });
        }
        return res;
    } catch (error) {
        console.error('❌ [Database Query Error]:', {
            code: error.code,
            message: error.message,
            parameterCount: params.length
        });
        throw error;
    }
};

/**
 * Obtiene un cliente dedicado del pool para transacciones (BEGIN, COMMIT, ROLLBACK)
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = async () => {
    const client = await pool.connect();
    return client;
};

/**
 * Prueba de conexión a la base de datos
 */
const testConnection = async () => {
    try {
        const res = await query(`
            SELECT current_database() AS db,
                   current_user AS usuario,
                   (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superusuario,
                   now() AS current_time;
        `);
        const { db, usuario, superusuario, current_time } = res.rows[0];
        console.log('✅ [PostgreSQL Conectado]:', { database: db, usuario, time: current_time });
        if (superusuario) {
            console.warn('⚠️ [PostgreSQL] La conexión de runtime usa un rol con privilegios administrativos.');
            console.warn('   Configura DATABASE_URL con el rol codeint_app (npm run db:provision-app-role).');
        }
        return true;
    } catch (err) {
        console.error('❌ [Error al conectar a PostgreSQL]:', err.message);
        return false;
    }
};

// Si se ejecuta directamente este archivo, prueba la conexión
if (require.main === module) {
    testConnection().then((success) => {
        if (success) {
            console.log('🚀 Prueba de base de datos exitosa.');
            process.exit(0);
        } else {
            console.error('💥 Falló la prueba de conexión a la base de datos.');
            process.exit(1);
        }
    });
}

module.exports = {
    pool,
    query,
    getClient,
    testConnection
};

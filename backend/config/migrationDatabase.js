'use strict';

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const useSsl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

const connectionConfig = process.env.MIGRATION_DATABASE_URL
    ? {
        connectionString: process.env.MIGRATION_DATABASE_URL,
        ssl: useSsl ? { rejectUnauthorized } : false
    }
    : {
        host: process.env.MIGRATION_DB_HOST || process.env.DB_HOST || '127.0.0.1',
        port: Number.parseInt(process.env.MIGRATION_DB_PORT || process.env.DB_PORT || '5432', 10),
        user: process.env.MIGRATION_DB_USER || process.env.DB_USER || 'postgres',
        password: process.env.MIGRATION_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '',
        database: process.env.MIGRATION_DB_NAME || process.env.DB_NAME || 'codeint_db',
        ssl: useSsl ? { rejectUnauthorized } : false
    };

const migrationPool = new Pool({
    ...connectionConfig,
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 60000,
    application_name: 'codeint-migrations'
});

module.exports = { migrationPool };

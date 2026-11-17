-- ==============================================================
-- codeInt - DDL Completo de la Base de Datos
-- PostgreSQL 18 | 21 Tablas | Normalización en 3FN
-- Universidad Tecnológica del Perú (UTP) - 2026
-- ==============================================================

-- Eliminar y crear la base de datos (se ejecuta desde psql sobre postgres)
DROP DATABASE IF EXISTS codeint_db;
CREATE DATABASE codeint_db
    WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    LOCALE_PROVIDER = 'libc'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1
    IS_TEMPLATE = False;

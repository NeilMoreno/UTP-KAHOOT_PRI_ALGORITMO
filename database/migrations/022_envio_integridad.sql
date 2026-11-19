BEGIN;

-- Senales de integridad academica de cada envio. NO bloquean al estudiante: sirven para que el docente
-- revise (semaforo verde/ambar/rojo con los motivos).
ALTER TABLE envio_ejercicio
    ADD COLUMN senales JSONB,
    ADD COLUMN riesgo VARCHAR(8) NOT NULL DEFAULT 'verde',
    ADD COLUMN motivos_riesgo JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN similitud NUMERIC(4,3),
    ADD COLUMN id_envio_similar UUID REFERENCES envio_ejercicio(id_envio_ejercicio) ON DELETE SET NULL,
    ADD COLUMN revisado_en TIMESTAMPTZ,
    ADD COLUMN revisado_por UUID REFERENCES usuario(id_usuario) ON DELETE SET NULL;

ALTER TABLE envio_ejercicio
    ADD CONSTRAINT ck_envio_riesgo CHECK (riesgo IN ('verde', 'ambar', 'rojo')),
    ADD CONSTRAINT ck_envio_motivos CHECK (jsonb_typeof(motivos_riesgo) = 'array' AND jsonb_array_length(motivos_riesgo) <= 20),
    ADD CONSTRAINT ck_envio_senales CHECK (senales IS NULL OR (jsonb_typeof(senales) = 'object' AND octet_length(senales::text) <= 2000)),
    ADD CONSTRAINT ck_envio_similitud CHECK (similitud IS NULL OR (similitud >= 0 AND similitud <= 1));

CREATE INDEX idx_envio_riesgo ON envio_ejercicio (id_curso, fecha_envio DESC) WHERE riesgo <> 'verde';

COMMIT;

BEGIN;

-- Intentos de manipular la calificacion por IA (texto dirigido al evaluador dentro del codigo).
-- El puntaje guardado queda limitado; puntaje_modelo conserva lo que habria dado el modelo para que el
-- docente pueda revisar el envio.
ALTER TABLE evaluacion_ia
    ADD COLUMN alerta_manipulacion BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN motivos_alerta JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN puntaje_modelo SMALLINT;

ALTER TABLE evaluacion_ia
    ADD CONSTRAINT ck_evaluacion_motivos CHECK (jsonb_typeof(motivos_alerta) = 'array' AND jsonb_array_length(motivos_alerta) <= 20),
    ADD CONSTRAINT ck_evaluacion_puntaje_modelo CHECK (puntaje_modelo IS NULL OR (puntaje_modelo >= 0 AND puntaje_modelo <= 100));

CREATE INDEX idx_evaluacion_alerta ON evaluacion_ia (id_curso, fecha_evaluacion DESC) WHERE alerta_manipulacion;

COMMIT;

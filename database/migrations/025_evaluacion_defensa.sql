BEGIN;

-- Defensa del codigo: tras aprobar un ejercicio de escribir codigo, el estudiante responde una pregunta de opcion
-- multiple sobre SU propio codigo (la IA la propone en la misma evaluacion, sin costo extra). Se corrige en el
-- servidor; `defensa` (con la respuesta correcta) nunca se envia al estudiante antes de responder.
ALTER TABLE evaluacion_ia
    ADD COLUMN defensa JSONB,
    ADD COLUMN defensa_respuesta SMALLINT,
    ADD COLUMN defensa_correcta BOOLEAN,
    ADD COLUMN defensa_en TIMESTAMPTZ;

ALTER TABLE evaluacion_ia
    ADD CONSTRAINT ck_evaluacion_defensa CHECK (defensa IS NULL OR (jsonb_typeof(defensa) = 'object' AND octet_length(defensa::text) <= 3000)),
    ADD CONSTRAINT ck_evaluacion_defensa_respuesta CHECK (defensa_respuesta IS NULL OR (defensa_respuesta >= 0 AND defensa_respuesta <= 3));

COMMIT;

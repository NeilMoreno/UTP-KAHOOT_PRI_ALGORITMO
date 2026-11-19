BEGIN;

-- Mini-leccion de teoria de cada mundo (tarjetas + una pregunta de comprobacion). Viene del borrador del silabo
-- (la IA la genera aparte y el docente la edita) y se muestra al estudiante antes de los ejercicios.
ALTER TABLE mundo
    ADD COLUMN leccion JSONB;

ALTER TABLE mundo
    ADD CONSTRAINT ck_mundo_leccion CHECK (leccion IS NULL OR (jsonb_typeof(leccion) = 'object' AND octet_length(leccion::text) <= 20000));

COMMIT;

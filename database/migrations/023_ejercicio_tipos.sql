BEGIN;

-- Tipos de ejercicio ademas de "escribir codigo": predecir la salida, completar huecos, ordenar lineas y
-- corregir codigo con errores. Los cuatro se corrigen en el servidor (sin IA, sin gastar tokens).
--   material: lo que ve el estudiante   |   solucion: SOLO servidor (nunca se envia a estudiantes)
ALTER TABLE ejercicio
    ADD COLUMN tipo VARCHAR(10) NOT NULL DEFAULT 'escribir',
    ADD COLUMN material JSONB,
    ADD COLUMN solucion JSONB;

ALTER TABLE ejercicio
    ADD CONSTRAINT ck_ejercicio_tipo CHECK (tipo IN ('escribir', 'predecir', 'completar', 'ordenar', 'corregir')),
    ADD CONSTRAINT ck_ejercicio_material CHECK (
        (tipo = 'escribir' AND material IS NULL AND solucion IS NULL)
        OR (tipo <> 'escribir' AND jsonb_typeof(material) = 'object' AND jsonb_typeof(solucion) = 'object'
            AND octet_length(material::text) <= 20000 AND octet_length(solucion::text) <= 20000)
    );

COMMIT;

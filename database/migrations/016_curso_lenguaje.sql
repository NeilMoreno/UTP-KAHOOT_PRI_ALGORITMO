BEGIN;

-- Cada curso tiene un lenguaje de programación. Los cursos existentes son de PSeInt.
-- Las columnas ejercicio.plantilla_pseint y envio_ejercicio.codigo_pseint conservan su nombre por compatibilidad
-- (ahora contienen la plantilla y el código en el lenguaje del curso).
ALTER TABLE curso
    ADD COLUMN lenguaje VARCHAR(12) NOT NULL DEFAULT 'pseint';

ALTER TABLE curso
    ADD CONSTRAINT ck_curso_lenguaje CHECK (lenguaje IN ('pseint', 'python', 'javascript', 'java', 'c_cpp'));

COMMIT;

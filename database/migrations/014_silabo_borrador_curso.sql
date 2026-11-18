BEGIN;

-- Datos del archivo y del error de procesamiento del sílabo.
ALTER TABLE silabo
    ADD COLUMN tamano_bytes INTEGER,
    ADD COLUMN sha256 CHAR(64),
    ADD COLUMN mensaje_error VARCHAR(300);

ALTER TABLE silabo
    ADD CONSTRAINT ck_silabo_tamano CHECK (tamano_bytes IS NULL OR (tamano_bytes > 0 AND tamano_bytes <= 10485760));

-- Borrador generado por IA a partir de un sílabo. Es editable por el docente y solo se
-- convierte en mundos/ejercicios reales al publicarlo (la IA nunca publica sola).
CREATE TABLE borrador_curso (
    id_borrador         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_silabo           UUID NOT NULL REFERENCES silabo(id_silabo) ON DELETE CASCADE,
    id_curso            UUID NOT NULL REFERENCES curso(id_curso) ON DELETE CASCADE,
    contenido           JSONB NOT NULL,
    estado              VARCHAR(15) NOT NULL DEFAULT 'generado',
    modelo_ia           VARCHAR(100),
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_borrador_estado CHECK (estado IN ('generado', 'editado', 'publicado', 'descartado')),
    CONSTRAINT ck_borrador_contenido CHECK (jsonb_typeof(contenido) = 'object' AND octet_length(contenido::text) <= 400000)
);

CREATE INDEX idx_borrador_curso ON borrador_curso (id_curso, estado);

-- Metadatos pedagógicos de los ejercicios generados. Son opcionales: los ejercicios base no los usan.
ALTER TABLE ejercicio
    ADD COLUMN nivel VARCHAR(12),
    ADD COLUMN rubrica JSONB,
    ADD COLUMN fuente_silabo VARCHAR(300);

ALTER TABLE ejercicio
    ADD CONSTRAINT ck_ejercicio_nivel CHECK (nivel IS NULL OR nivel IN ('basico', 'intermedio', 'reto')),
    ADD CONSTRAINT ck_ejercicio_rubrica CHECK (rubrica IS NULL OR jsonb_typeof(rubrica) = 'array');

COMMIT;

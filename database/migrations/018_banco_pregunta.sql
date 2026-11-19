BEGIN;

-- Banco de preguntas de un curso: nace de las preguntas de sala del sílabo publicado y el docente
-- puede desactivarlas. Las salas las copian al crearse (no dependen del banco después).
CREATE TABLE banco_pregunta (
    id_banco_pregunta UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_curso          UUID NOT NULL REFERENCES curso(id_curso) ON DELETE CASCADE,
    id_mundo          UUID REFERENCES mundo(id_mundo) ON DELETE SET NULL,
    enunciado         VARCHAR(300) NOT NULL,
    opciones          JSONB NOT NULL,
    origen            VARCHAR(10) NOT NULL DEFAULT 'ia',
    activa            BOOLEAN NOT NULL DEFAULT true,
    fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_banco_origen CHECK (origen IN ('ia', 'docente')),
    CONSTRAINT ck_banco_opciones CHECK (jsonb_typeof(opciones) = 'array' AND jsonb_array_length(opciones) = 4)
);

CREATE INDEX idx_banco_pregunta_curso ON banco_pregunta (id_curso, activa);

COMMIT;

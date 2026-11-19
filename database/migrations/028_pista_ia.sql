BEGIN;

-- Pistas graduales de IA: hasta 3 por ejercicio y estudiante (nivel 1 conceptual, 2 localizada, 3 ejemplo parecido).
-- Cada pista cuesta tokens de la cuota del docente y se ata al ultimo envio del estudiante.
CREATE TABLE pista_ia (
    id_pista            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_estudiante       UUID NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    id_ejercicio        UUID NOT NULL REFERENCES ejercicio(id_ejercicio) ON DELETE CASCADE,
    id_envio_ejercicio  UUID REFERENCES envio_ejercicio(id_envio_ejercicio) ON DELETE SET NULL,
    nivel               SMALLINT NOT NULL,
    contenido           VARCHAR(600) NOT NULL,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_pista_nivel CHECK (nivel BETWEEN 1 AND 3),
    CONSTRAINT uq_pista_nivel UNIQUE (id_estudiante, id_ejercicio, nivel)
);

CREATE INDEX idx_pista_estudiante_fecha ON pista_ia (id_estudiante, fecha_creacion DESC);

COMMIT;

BEGIN;

-- Catálogo de misiones semanales. Cada semana (lunes-domingo, hora de Lima) se muestran 3, rotando el catálogo.
-- La recompensa es una pieza de avatar (capa + id de backend/utils/avatarCatalog.js), no XP,
-- para no tocar xp_movimiento ni la regla "XP solo en el primer aprobado".
CREATE TABLE mision (
    codigo            VARCHAR(30) PRIMARY KEY,
    nombre            VARCHAR(80) NOT NULL,
    descripcion       VARCHAR(200) NOT NULL,
    tipo_condicion    VARCHAR(30) NOT NULL,
    meta              SMALLINT NOT NULL,
    recompensa_capa   VARCHAR(20),
    recompensa_pieza  VARCHAR(30),
    CONSTRAINT ck_mision_condicion CHECK (tipo_condicion IN ('ejercicios_enviados', 'ejercicios_aprobados', 'partidas_jugadas', 'dias_activos')),
    CONSTRAINT ck_mision_meta CHECK (meta > 0 AND meta <= 100),
    CONSTRAINT ck_mision_recompensa CHECK ((recompensa_capa IS NULL) = (recompensa_pieza IS NULL))
);

-- Misiones completadas por estudiante y semana (semana = lunes de esa semana en Lima).
CREATE TABLE estudiante_mision (
    id_estudiante     UUID NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    codigo            VARCHAR(30) NOT NULL REFERENCES mision(codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
    semana            DATE NOT NULL,
    fecha_completada  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_estudiante, codigo, semana)
);

CREATE INDEX idx_estudiante_mision_estudiante ON estudiante_mision (id_estudiante);

INSERT INTO mision (codigo, nombre, descripcion, tipo_condicion, meta, recompensa_capa, recompensa_pieza) VALUES
    ('calentamiento', 'Calentamiento',  'Envía 3 ejercicios distintos esta semana.',          'ejercicios_enviados',  3, 'accesorio', 'cafe'),
    ('doble_acierto', 'Doble acierto',  'Aprueba 2 ejercicios esta semana.',                  'ejercicios_aprobados', 2, 'gafas',     'visor'),
    ('a_la_arena',    'A la arena',     'Juega 1 sala en vivo esta semana.',                  'partidas_jugadas',     1, 'fondo',     'atardecer'),
    ('constancia',    'Constancia',     'Practica en 3 días distintos esta semana.',          'dias_activos',         3, 'pelo',      'neon'),
    ('maraton',       'Maratón',        'Envía 6 ejercicios distintos esta semana.',          'ejercicios_enviados',  6, 'peinado',   'mohawk'),
    ('sin_errores',   'Sin errores',    'Aprueba 4 ejercicios esta semana.',                  'ejercicios_aprobados', 4, 'ropaColor', 'rosa');

COMMIT;

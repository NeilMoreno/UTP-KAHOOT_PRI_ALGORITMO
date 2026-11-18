BEGIN;

-- Nuevas condiciones de logro basadas en las salas en vivo (se calculan en backend/services/achievementService.js).
ALTER TABLE logro DROP CONSTRAINT ck_logro_condicion;
ALTER TABLE logro ADD CONSTRAINT ck_logro_condicion CHECK (tipo_condicion IN (
    'xp_acumulado', 'mundos_completados', 'partidas_participadas', 'ejercicios_aprobados',
    'podios_sala', 'victorias_sala', 'respuestas_rapidas'
));

INSERT INTO logro (nombre, descripcion, tipo, tipo_condicion, valor_umbral) VALUES
    ('En el podio',         'Termina en el top 3 de una sala Kahoot.',                  'insignia', 'podios_sala',        1),
    ('Habitual del podio',  'Llega al top 3 en 5 salas Kahoot.',                        'logro',    'podios_sala',        5),
    ('Rey de la sala',      'Gana una sala Kahoot (1.er puesto).',                      'insignia', 'victorias_sala',     1),
    ('Imparable',           'Gana 5 salas Kahoot.',                                     'logro',    'victorias_sala',     5),
    ('Rayo',                'Acierta una respuesta en menos de 3 segundos.',            'insignia', 'respuestas_rapidas', 1),
    ('Reflejos',            'Acierta 10 respuestas en menos de 3 segundos.',            'logro',    'respuestas_rapidas', 10)
ON CONFLICT DO NOTHING;

COMMIT;

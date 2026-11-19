# Diccionario de datos de codeInt

Generado automáticamente desde la base (2026-11-19) con `npm run docs:dictionary`. No lo edites a mano: cambia las migraciones en `database/migrations/` y vuelve a generarlo.

- **Tablas:** 32
- **Migraciones aplicadas:** 28 (001_usuario_security_profile.sql … 028_pista_ia.sql)

## Índice

- [`asignacion_tokens`](#asignacion_tokens)
- [`auditoria_seguridad`](#auditoria_seguridad)
- [`banco_pregunta`](#banco_pregunta)
- [`borrador_curso`](#borrador_curso)
- [`curso`](#curso)
- [`ejercicio`](#ejercicio)
- [`envio_ejercicio`](#envio_ejercicio)
- [`estudiante_logro`](#estudiante_logro)
- [`estudiante_mision`](#estudiante_mision)
- [`evaluacion_ia`](#evaluacion_ia)
- [`institucion`](#institucion)
- [`institucion_dominio`](#institucion_dominio)
- [`invitacion_usuario`](#invitacion_usuario)
- [`logro`](#logro)
- [`matricula`](#matricula)
- [`mision`](#mision)
- [`mundo`](#mundo)
- [`nivel`](#nivel)
- [`notificacion`](#notificacion)
- [`opcion`](#opcion)
- [`participante_sala`](#participante_sala)
- [`pista_ia`](#pista_ia)
- [`pregunta`](#pregunta)
- [`progreso_mundo`](#progreso_mundo)
- [`respuesta_sala`](#respuesta_sala)
- [`sala_multijugador`](#sala_multijugador)
- [`schema_migration`](#schema_migration)
- [`silabo`](#silabo)
- [`token_cuenta`](#token_cuenta)
- [`uso_ia`](#uso_ia)
- [`usuario`](#usuario)
- [`xp_movimiento`](#xp_movimiento)

## asignacion_tokens

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_asignacion_tokens` | uuid | no | gen_random_uuid() |
| `id_docente_beneficiario` | uuid | no |  |
| `id_superadmin_asignador` | uuid | no |  |
| `limite_tokens` | bigint | no |  |
| `fecha_inicio` | timestamp with time zone | no |  |
| `fecha_fin` | timestamp with time zone | no |  |

**Restricciones**

- Regla (CHECK) `ck_asigntok_fechas`: `CHECK ((fecha_fin > fecha_inicio))`
- Regla (CHECK) `ck_asigntok_limite`: `CHECK ((limite_tokens >= 0))`
- Llave foránea `fk_asigntok_docente`: `FOREIGN KEY (id_docente_beneficiario) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_asigntok_superadmin`: `FOREIGN KEY (id_superadmin_asignador) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `asignacion_tokens_fecha_fin_not_null`: `NOT NULL fecha_fin`
- n `asignacion_tokens_fecha_inicio_not_null`: `NOT NULL fecha_inicio`
- n `asignacion_tokens_id_asignacion_tokens_not_null`: `NOT NULL id_asignacion_tokens`
- n `asignacion_tokens_id_docente_beneficiario_not_null`: `NOT NULL id_docente_beneficiario`
- n `asignacion_tokens_id_superadmin_asignador_not_null`: `NOT NULL id_superadmin_asignador`
- n `asignacion_tokens_limite_tokens_not_null`: `NOT NULL limite_tokens`
- Llave primaria `pk_asignacion_tokens`: `PRIMARY KEY (id_asignacion_tokens)`
- Exclusión `asignacion_tokens_id_docente_beneficiario_tstzrange_excl`: `EXCLUDE USING gist (id_docente_beneficiario WITH =, tstzrange(fecha_inicio, fecha_fin, '[)'::text) WITH &&)`

## auditoria_seguridad

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_auditoria_seguridad` | uuid | no | gen_random_uuid() |
| `id_actor` | uuid | sí |  |
| `id_institucion` | uuid | sí |  |
| `accion` | character varying(80) | no |  |
| `tipo_objetivo` | character varying(50) | sí |  |
| `id_objetivo` | uuid | sí |  |
| `resultado` | character varying(20) | no |  |
| `direccion_ip` | inet | sí |  |
| `metadatos` | jsonb | no | '{}'::jsonb |
| `fecha_evento` | timestamp with time zone | no | now() |

**Restricciones**

- Regla (CHECK) `ck_auditoria_accion`: `CHECK ((((accion)::text = upper(btrim((accion)::text))) AND ((char_length((accion)::text) >= 3) AND (char_length((accion)::text) <= 80))))`
- Regla (CHECK) `ck_auditoria_metadatos_objeto`: `CHECK ((jsonb_typeof(metadatos) = 'object'::text))`
- Regla (CHECK) `ck_auditoria_resultado`: `CHECK (((resultado)::text = ANY ((ARRAY['exitoso'::character varying, 'rechazado'::character varying, 'fallido'::character varying])::text[])))`
- Llave foránea `fk_auditoria_actor`: `FOREIGN KEY (id_actor) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_auditoria_institucion`: `FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `auditoria_seguridad_accion_not_null`: `NOT NULL accion`
- n `auditoria_seguridad_fecha_evento_not_null`: `NOT NULL fecha_evento`
- n `auditoria_seguridad_id_auditoria_seguridad_not_null`: `NOT NULL id_auditoria_seguridad`
- n `auditoria_seguridad_metadatos_not_null`: `NOT NULL metadatos`
- n `auditoria_seguridad_resultado_not_null`: `NOT NULL resultado`
- Llave primaria `pk_auditoria_seguridad`: `PRIMARY KEY (id_auditoria_seguridad)`

## banco_pregunta

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_banco_pregunta` | uuid | no | gen_random_uuid() |
| `id_curso` | uuid | no |  |
| `id_mundo` | uuid | sí |  |
| `enunciado` | character varying(300) | no |  |
| `opciones` | jsonb | no |  |
| `origen` | character varying(10) | no | 'ia'::character varying |
| `activa` | boolean | no | true |
| `fecha_creacion` | timestamp with time zone | no | now() |

**Restricciones**

- Regla (CHECK) `ck_banco_opciones`: `CHECK (((jsonb_typeof(opciones) = 'array'::text) AND (jsonb_array_length(opciones) = 4)))`
- Regla (CHECK) `ck_banco_origen`: `CHECK (((origen)::text = ANY ((ARRAY['ia'::character varying, 'docente'::character varying])::text[])))`
- Llave foránea `banco_pregunta_id_curso_fkey`: `FOREIGN KEY (id_curso) REFERENCES curso(id_curso) ON DELETE CASCADE`
- Llave foránea `banco_pregunta_id_mundo_fkey`: `FOREIGN KEY (id_mundo) REFERENCES mundo(id_mundo) ON DELETE SET NULL`
- n `banco_pregunta_activa_not_null`: `NOT NULL activa`
- n `banco_pregunta_enunciado_not_null`: `NOT NULL enunciado`
- n `banco_pregunta_fecha_creacion_not_null`: `NOT NULL fecha_creacion`
- n `banco_pregunta_id_banco_pregunta_not_null`: `NOT NULL id_banco_pregunta`
- n `banco_pregunta_id_curso_not_null`: `NOT NULL id_curso`
- n `banco_pregunta_opciones_not_null`: `NOT NULL opciones`
- n `banco_pregunta_origen_not_null`: `NOT NULL origen`
- Llave primaria `banco_pregunta_pkey`: `PRIMARY KEY (id_banco_pregunta)`

## borrador_curso

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_borrador` | uuid | no | gen_random_uuid() |
| `id_silabo` | uuid | no |  |
| `id_curso` | uuid | no |  |
| `contenido` | jsonb | no |  |
| `estado` | character varying(15) | no | 'generado'::character varying |
| `modelo_ia` | character varying(100) | sí |  |
| `fecha_creacion` | timestamp with time zone | no | now() |
| `fecha_actualizacion` | timestamp with time zone | no | now() |

**Restricciones**

- Regla (CHECK) `ck_borrador_contenido`: `CHECK (((jsonb_typeof(contenido) = 'object'::text) AND (octet_length((contenido)::text) <= 400000)))`
- Regla (CHECK) `ck_borrador_estado`: `CHECK (((estado)::text = ANY ((ARRAY['generado'::character varying, 'editado'::character varying, 'publicado'::character varying, 'descartado'::character varying])::text[])))`
- Llave foránea `borrador_curso_id_curso_fkey`: `FOREIGN KEY (id_curso) REFERENCES curso(id_curso) ON DELETE CASCADE`
- Llave foránea `borrador_curso_id_silabo_fkey`: `FOREIGN KEY (id_silabo) REFERENCES silabo(id_silabo) ON DELETE CASCADE`
- n `borrador_curso_contenido_not_null`: `NOT NULL contenido`
- n `borrador_curso_estado_not_null`: `NOT NULL estado`
- n `borrador_curso_fecha_actualizacion_not_null`: `NOT NULL fecha_actualizacion`
- n `borrador_curso_fecha_creacion_not_null`: `NOT NULL fecha_creacion`
- n `borrador_curso_id_borrador_not_null`: `NOT NULL id_borrador`
- n `borrador_curso_id_curso_not_null`: `NOT NULL id_curso`
- n `borrador_curso_id_silabo_not_null`: `NOT NULL id_silabo`
- Llave primaria `borrador_curso_pkey`: `PRIMARY KEY (id_borrador)`

## curso

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_curso` | uuid | no | gen_random_uuid() |
| `id_institucion` | uuid | no |  |
| `id_docente` | uuid | no |  |
| `nombre` | character varying(200) | no |  |
| `codigo_curso` | character varying(50) | no |  |
| `periodo` | character varying(30) | no |  |
| `estado` | character varying(20) | no | 'activo'::character varying |
| `fecha_creacion` | timestamp with time zone | no | now() |
| `lenguaje` | character varying(12) | no | 'pseint'::character varying |
| `union_por_codigo` | boolean | no | true |

**Restricciones**

- Regla (CHECK) `ck_curso_estado`: `CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))`
- Regla (CHECK) `ck_curso_lenguaje`: `CHECK (((lenguaje)::text = ANY ((ARRAY['pseint'::character varying, 'python'::character varying, 'javascript'::character varying, 'java'::character varying, 'c_cpp'::character varying])::text[])))`
- Llave foránea `fk_curso_docente`: `FOREIGN KEY (id_docente) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_curso_institucion`: `FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `curso_codigo_curso_not_null`: `NOT NULL codigo_curso`
- n `curso_estado_not_null`: `NOT NULL estado`
- n `curso_fecha_creacion_not_null`: `NOT NULL fecha_creacion`
- n `curso_id_curso_not_null`: `NOT NULL id_curso`
- n `curso_id_docente_not_null`: `NOT NULL id_docente`
- n `curso_id_institucion_not_null`: `NOT NULL id_institucion`
- n `curso_lenguaje_not_null`: `NOT NULL lenguaje`
- n `curso_nombre_not_null`: `NOT NULL nombre`
- n `curso_periodo_not_null`: `NOT NULL periodo`
- n `curso_union_por_codigo_not_null`: `NOT NULL union_por_codigo`
- Llave primaria `pk_curso`: `PRIMARY KEY (id_curso)`
- Única `uq_curso_codigo_periodo`: `UNIQUE (id_institucion, codigo_curso, periodo)`

## ejercicio

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_ejercicio` | uuid | no | gen_random_uuid() |
| `id_mundo` | uuid | no |  |
| `id_curso` | uuid | no |  |
| `titulo` | character varying(200) | no |  |
| `enunciado` | text | no |  |
| `plantilla_pseint` | text | sí |  |
| `orden` | smallint | no |  |
| `xp_recompensa` | integer | no | 50 |
| `nivel` | character varying(12) | sí |  |
| `rubrica` | jsonb | sí |  |
| `fuente_silabo` | character varying(300) | sí |  |
| `tipo` | character varying(10) | no | 'escribir'::character varying |
| `material` | jsonb | sí |  |
| `solucion` | jsonb | sí |  |

**Restricciones**

- Regla (CHECK) `ck_ejercicio_material`: `CHECK (((((tipo)::text = 'escribir'::text) AND (material IS NULL) AND (solucion IS NULL)) OR (((tipo)::text <> 'escribir'::text) AND (jsonb_typeof(material) = 'object'::text) AND (jsonb_typeof(solucion) = 'object'::text) AND (octet_length((material)::text) <= 20000) AND (octet_length((solucion)::text) <= 20000))))`
- Regla (CHECK) `ck_ejercicio_nivel`: `CHECK (((nivel IS NULL) OR ((nivel)::text = ANY ((ARRAY['basico'::character varying, 'intermedio'::character varying, 'reto'::character varying])::text[]))))`
- Regla (CHECK) `ck_ejercicio_orden`: `CHECK ((orden > 0))`
- Regla (CHECK) `ck_ejercicio_rubrica`: `CHECK (((rubrica IS NULL) OR (jsonb_typeof(rubrica) = 'array'::text)))`
- Regla (CHECK) `ck_ejercicio_tipo`: `CHECK (((tipo)::text = ANY ((ARRAY['escribir'::character varying, 'predecir'::character varying, 'completar'::character varying, 'ordenar'::character varying, 'corregir'::character varying])::text[])))`
- Regla (CHECK) `ck_ejercicio_xp`: `CHECK ((xp_recompensa >= 0))`
- Llave foránea `fk_ejercicio_curso`: `FOREIGN KEY (id_curso) REFERENCES curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_ejercicio_mundo`: `FOREIGN KEY (id_mundo) REFERENCES mundo(id_mundo) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `ejercicio_enunciado_not_null`: `NOT NULL enunciado`
- n `ejercicio_id_curso_not_null`: `NOT NULL id_curso`
- n `ejercicio_id_ejercicio_not_null`: `NOT NULL id_ejercicio`
- n `ejercicio_id_mundo_not_null`: `NOT NULL id_mundo`
- n `ejercicio_orden_not_null`: `NOT NULL orden`
- n `ejercicio_tipo_not_null`: `NOT NULL tipo`
- n `ejercicio_titulo_not_null`: `NOT NULL titulo`
- n `ejercicio_xp_recompensa_not_null`: `NOT NULL xp_recompensa`
- Llave primaria `pk_ejercicio`: `PRIMARY KEY (id_ejercicio)`
- Única `uq_ejercicio_orden`: `UNIQUE (id_mundo, orden)`

## envio_ejercicio

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_envio_ejercicio` | uuid | no | gen_random_uuid() |
| `id_matricula` | uuid | no |  |
| `id_estudiante` | uuid | no |  |
| `id_ejercicio` | uuid | no |  |
| `id_curso` | uuid | no |  |
| `codigo_pseint` | text | no |  |
| `sintaxis_valida` | boolean | no | false |
| `mensaje_sintaxis` | text | sí |  |
| `fecha_envio` | timestamp with time zone | no | now() |
| `id_operacion` | uuid | no | gen_random_uuid() |
| `estado_evaluacion` | character varying(20) | no | 'pendiente'::character varying |
| `senales` | jsonb | sí |  |
| `riesgo` | character varying(8) | no | 'verde'::character varying |
| `motivos_riesgo` | jsonb | no | '[]'::jsonb |
| `similitud` | numeric | sí |  |
| `id_envio_similar` | uuid | sí |  |
| `revisado_en` | timestamp with time zone | sí |  |
| `revisado_por` | uuid | sí |  |

**Restricciones**

- Regla (CHECK) `ck_envio_codigo_longitud`: `CHECK (((length(btrim(codigo_pseint)) >= 1) AND (length(btrim(codigo_pseint)) <= 12000)))`
- Regla (CHECK) `ck_envio_estado_evaluacion`: `CHECK (((estado_evaluacion)::text = ANY ((ARRAY['rechazado_local'::character varying, 'pendiente'::character varying, 'procesando'::character varying, 'completado'::character varying, 'fallido'::character varying])::text[])))`
- Regla (CHECK) `ck_envio_estado_sintaxis`: `CHECK ((((NOT sintaxis_valida) AND ((estado_evaluacion)::text = 'rechazado_local'::text)) OR (sintaxis_valida AND ((estado_evaluacion)::text = ANY ((ARRAY['pendiente'::character varying, 'procesando'::character varying, 'completado'::character varying, 'fallido'::character varying])::text[])))))`
- Regla (CHECK) `ck_envio_mensaje_longitud`: `CHECK (((mensaje_sintaxis IS NULL) OR (length(mensaje_sintaxis) <= 8000)))`
- Regla (CHECK) `ck_envio_motivos`: `CHECK (((jsonb_typeof(motivos_riesgo) = 'array'::text) AND (jsonb_array_length(motivos_riesgo) <= 20)))`
- Regla (CHECK) `ck_envio_riesgo`: `CHECK (((riesgo)::text = ANY ((ARRAY['verde'::character varying, 'ambar'::character varying, 'rojo'::character varying])::text[])))`
- Regla (CHECK) `ck_envio_senales`: `CHECK (((senales IS NULL) OR ((jsonb_typeof(senales) = 'object'::text) AND (octet_length((senales)::text) <= 2000))))`
- Regla (CHECK) `ck_envio_similitud`: `CHECK (((similitud IS NULL) OR ((similitud >= (0)::numeric) AND (similitud <= (1)::numeric))))`
- Llave foránea `envio_ejercicio_id_envio_similar_fkey`: `FOREIGN KEY (id_envio_similar) REFERENCES envio_ejercicio(id_envio_ejercicio) ON DELETE SET NULL`
- Llave foránea `envio_ejercicio_revisado_por_fkey`: `FOREIGN KEY (revisado_por) REFERENCES usuario(id_usuario) ON DELETE SET NULL`
- Llave foránea `fk_envio_curso`: `FOREIGN KEY (id_curso) REFERENCES curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_envio_ejercicio_ref`: `FOREIGN KEY (id_ejercicio) REFERENCES ejercicio(id_ejercicio) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_envio_estudiante`: `FOREIGN KEY (id_estudiante) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_envio_matricula`: `FOREIGN KEY (id_matricula) REFERENCES matricula(id_matricula) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `envio_ejercicio_codigo_pseint_not_null`: `NOT NULL codigo_pseint`
- n `envio_ejercicio_estado_evaluacion_not_null`: `NOT NULL estado_evaluacion`
- n `envio_ejercicio_fecha_envio_not_null`: `NOT NULL fecha_envio`
- n `envio_ejercicio_id_curso_not_null`: `NOT NULL id_curso`
- n `envio_ejercicio_id_ejercicio_not_null`: `NOT NULL id_ejercicio`
- n `envio_ejercicio_id_envio_ejercicio_not_null`: `NOT NULL id_envio_ejercicio`
- n `envio_ejercicio_id_estudiante_not_null`: `NOT NULL id_estudiante`
- n `envio_ejercicio_id_matricula_not_null`: `NOT NULL id_matricula`
- n `envio_ejercicio_id_operacion_not_null`: `NOT NULL id_operacion`
- n `envio_ejercicio_motivos_riesgo_not_null`: `NOT NULL motivos_riesgo`
- n `envio_ejercicio_riesgo_not_null`: `NOT NULL riesgo`
- n `envio_ejercicio_sintaxis_valida_not_null`: `NOT NULL sintaxis_valida`
- Llave primaria `pk_envio_ejercicio`: `PRIMARY KEY (id_envio_ejercicio)`
- Única `uq_envio_id_operacion`: `UNIQUE (id_operacion)`

## estudiante_logro

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_estudiante_logro` | uuid | no | gen_random_uuid() |
| `id_estudiante` | uuid | no |  |
| `id_logro` | uuid | no |  |
| `fecha_obtencion` | timestamp with time zone | no | now() |

**Restricciones**

- Llave foránea `fk_estudlogro_estudiante`: `FOREIGN KEY (id_estudiante) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_estudlogro_logro`: `FOREIGN KEY (id_logro) REFERENCES logro(id_logro) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `estudiante_logro_fecha_obtencion_not_null`: `NOT NULL fecha_obtencion`
- n `estudiante_logro_id_estudiante_logro_not_null`: `NOT NULL id_estudiante_logro`
- n `estudiante_logro_id_estudiante_not_null`: `NOT NULL id_estudiante`
- n `estudiante_logro_id_logro_not_null`: `NOT NULL id_logro`
- Llave primaria `pk_estudiante_logro`: `PRIMARY KEY (id_estudiante_logro)`
- Única `uq_estudiante_logro`: `UNIQUE (id_estudiante, id_logro)`

## estudiante_mision

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_estudiante` | uuid | no |  |
| `codigo` | character varying(30) | no |  |
| `semana` | date | no |  |
| `fecha_completada` | timestamp with time zone | no | now() |

**Restricciones**

- Llave foránea `estudiante_mision_codigo_fkey`: `FOREIGN KEY (codigo) REFERENCES mision(codigo) ON UPDATE CASCADE ON DELETE RESTRICT`
- Llave foránea `estudiante_mision_id_estudiante_fkey`: `FOREIGN KEY (id_estudiante) REFERENCES usuario(id_usuario) ON DELETE CASCADE`
- n `estudiante_mision_codigo_not_null`: `NOT NULL codigo`
- n `estudiante_mision_fecha_completada_not_null`: `NOT NULL fecha_completada`
- n `estudiante_mision_id_estudiante_not_null`: `NOT NULL id_estudiante`
- n `estudiante_mision_semana_not_null`: `NOT NULL semana`
- Llave primaria `estudiante_mision_pkey`: `PRIMARY KEY (id_estudiante, codigo, semana)`

## evaluacion_ia

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_evaluacion` | uuid | no | gen_random_uuid() |
| `id_envio_ejercicio` | uuid | no |  |
| `id_estudiante` | uuid | no |  |
| `id_curso` | uuid | no |  |
| `puntaje` | smallint | no |  |
| `retroalimentacion` | text | no |  |
| `categoria_error` | character varying(50) | sí |  |
| `fecha_evaluacion` | timestamp with time zone | no | now() |
| `sugerencias` | jsonb | no | '[]'::jsonb |
| `eficiencia_algoritmica` | text | no | 'No registrada.'::text |
| `codigo_sugerido_mejora` | text | no | ''::text |
| `modelo_ia` | character varying(100) | no | 'legacy'::character varying |
| `id_respuesta_proveedor` | character varying(255) | sí |  |
| `alerta_manipulacion` | boolean | no | false |
| `motivos_alerta` | jsonb | no | '[]'::jsonb |
| `puntaje_modelo` | smallint | sí |  |
| `defensa` | jsonb | sí |  |
| `defensa_respuesta` | smallint | sí |  |
| `defensa_correcta` | boolean | sí |  |
| `defensa_en` | timestamp with time zone | sí |  |

**Restricciones**

- Regla (CHECK) `ck_evaluacion_categoria`: `CHECK (((categoria_error IS NULL) OR ((categoria_error)::text = ANY ((ARRAY['ninguno'::character varying, 'sintaxis'::character varying, 'logica'::character varying, 'condicion_borde'::character varying, 'eficiencia'::character varying, 'formato'::character varying, 'otro'::character varying])::text[]))))`
- Regla (CHECK) `ck_evaluacion_codigo_sugerido_longitud`: `CHECK ((length(codigo_sugerido_mejora) <= 12000))`
- Regla (CHECK) `ck_evaluacion_defensa`: `CHECK (((defensa IS NULL) OR ((jsonb_typeof(defensa) = 'object'::text) AND (octet_length((defensa)::text) <= 3000))))`
- Regla (CHECK) `ck_evaluacion_defensa_respuesta`: `CHECK (((defensa_respuesta IS NULL) OR ((defensa_respuesta >= 0) AND (defensa_respuesta <= 3))))`
- Regla (CHECK) `ck_evaluacion_eficiencia_longitud`: `CHECK (((length(btrim(eficiencia_algoritmica)) >= 1) AND (length(btrim(eficiencia_algoritmica)) <= 1000)))`
- Regla (CHECK) `ck_evaluacion_motivos`: `CHECK (((jsonb_typeof(motivos_alerta) = 'array'::text) AND (jsonb_array_length(motivos_alerta) <= 20)))`
- Regla (CHECK) `ck_evaluacion_puntaje`: `CHECK (((puntaje >= 0) AND (puntaje <= 100)))`
- Regla (CHECK) `ck_evaluacion_puntaje_modelo`: `CHECK (((puntaje_modelo IS NULL) OR ((puntaje_modelo >= 0) AND (puntaje_modelo <= 100))))`
- Regla (CHECK) `ck_evaluacion_retroalimentacion_longitud`: `CHECK (((length(btrim(retroalimentacion)) >= 10) AND (length(btrim(retroalimentacion)) <= 4000)))`
- Regla (CHECK) `ck_evaluacion_sugerencias`: `CHECK (((jsonb_typeof(sugerencias) = 'array'::text) AND (jsonb_array_length(sugerencias) <= 5)))`
- Llave foránea `fk_evaluacion_curso`: `FOREIGN KEY (id_curso) REFERENCES curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_evaluacion_envio`: `FOREIGN KEY (id_envio_ejercicio) REFERENCES envio_ejercicio(id_envio_ejercicio) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_evaluacion_estudiante`: `FOREIGN KEY (id_estudiante) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `evaluacion_ia_alerta_manipulacion_not_null`: `NOT NULL alerta_manipulacion`
- n `evaluacion_ia_codigo_sugerido_mejora_not_null`: `NOT NULL codigo_sugerido_mejora`
- n `evaluacion_ia_eficiencia_algoritmica_not_null`: `NOT NULL eficiencia_algoritmica`
- n `evaluacion_ia_fecha_evaluacion_not_null`: `NOT NULL fecha_evaluacion`
- n `evaluacion_ia_id_curso_not_null`: `NOT NULL id_curso`
- n `evaluacion_ia_id_envio_ejercicio_not_null`: `NOT NULL id_envio_ejercicio`
- n `evaluacion_ia_id_estudiante_not_null`: `NOT NULL id_estudiante`
- n `evaluacion_ia_id_evaluacion_not_null`: `NOT NULL id_evaluacion`
- n `evaluacion_ia_modelo_ia_not_null`: `NOT NULL modelo_ia`
- n `evaluacion_ia_motivos_alerta_not_null`: `NOT NULL motivos_alerta`
- n `evaluacion_ia_puntaje_not_null`: `NOT NULL puntaje`
- n `evaluacion_ia_retroalimentacion_not_null`: `NOT NULL retroalimentacion`
- n `evaluacion_ia_sugerencias_not_null`: `NOT NULL sugerencias`
- Llave primaria `pk_evaluacion_ia`: `PRIMARY KEY (id_evaluacion)`
- Única `uq_evaluacion_envio`: `UNIQUE (id_envio_ejercicio)`

## institucion

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_institucion` | uuid | no | gen_random_uuid() |
| `nombre` | character varying(150) | no |  |
| `codigo_licencia` | character varying(80) | no |  |
| `estado` | character varying(20) | no | 'activa'::character varying |
| `fecha_creacion` | timestamp with time zone | no | now() |

**Restricciones**

- Regla (CHECK) `ck_institucion_estado`: `CHECK (((estado)::text = ANY ((ARRAY['activa'::character varying, 'inactiva'::character varying])::text[])))`
- n `institucion_codigo_licencia_not_null`: `NOT NULL codigo_licencia`
- n `institucion_estado_not_null`: `NOT NULL estado`
- n `institucion_fecha_creacion_not_null`: `NOT NULL fecha_creacion`
- n `institucion_id_institucion_not_null`: `NOT NULL id_institucion`
- n `institucion_nombre_not_null`: `NOT NULL nombre`
- Llave primaria `pk_institucion`: `PRIMARY KEY (id_institucion)`
- Única `uq_institucion_licencia`: `UNIQUE (codigo_licencia)`
- Única `uq_institucion_nombre`: `UNIQUE (nombre)`

## institucion_dominio

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_institucion_dominio` | uuid | no | gen_random_uuid() |
| `id_institucion` | uuid | no |  |
| `dominio` | character varying(253) | no |  |
| `estado` | character varying(20) | no | 'pendiente'::character varying |
| `verificado_en` | timestamp with time zone | sí |  |
| `creado_por` | uuid | sí |  |
| `fecha_creacion` | timestamp with time zone | no | now() |

**Restricciones**

- Regla (CHECK) `ck_instdom_dominio`: `CHECK ((((dominio)::text = lower(btrim((dominio)::text))) AND ((char_length((dominio)::text) >= 3) AND (char_length((dominio)::text) <= 253)) AND ((dominio)::text ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'::text)))`
- Regla (CHECK) `ck_instdom_estado`: `CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'activo'::character varying, 'inactivo'::character varying])::text[])))`
- Regla (CHECK) `ck_instdom_verificacion`: `CHECK (((((estado)::text = 'activo'::text) AND (verificado_en IS NOT NULL)) OR ((estado)::text <> 'activo'::text)))`
- Llave foránea `fk_instdom_creador`: `FOREIGN KEY (creado_por) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_instdom_institucion`: `FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `institucion_dominio_dominio_not_null`: `NOT NULL dominio`
- n `institucion_dominio_estado_not_null`: `NOT NULL estado`
- n `institucion_dominio_fecha_creacion_not_null`: `NOT NULL fecha_creacion`
- n `institucion_dominio_id_institucion_dominio_not_null`: `NOT NULL id_institucion_dominio`
- n `institucion_dominio_id_institucion_not_null`: `NOT NULL id_institucion`
- Llave primaria `pk_institucion_dominio`: `PRIMARY KEY (id_institucion_dominio)`
- Única `uq_institucion_dominio`: `UNIQUE (dominio)`

## invitacion_usuario

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_invitacion_usuario` | uuid | no | gen_random_uuid() |
| `id_institucion` | uuid | no |  |
| `email` | character varying(254) | no |  |
| `rol` | character varying(25) | no |  |
| `token_hash` | character(64) | no |  |
| `estado` | character varying(20) | no | 'pendiente'::character varying |
| `expira_en` | timestamp with time zone | no |  |
| `usada_en` | timestamp with time zone | sí |  |
| `creada_por` | uuid | no |  |
| `usada_por` | uuid | sí |  |
| `fecha_creacion` | timestamp with time zone | no | now() |

**Restricciones**

- Regla (CHECK) `ck_invitacion_email`: `CHECK ((((email)::text = lower(btrim((email)::text))) AND ((char_length((email)::text) >= 3) AND (char_length((email)::text) <= 254)) AND ((email)::text ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text)))`
- Regla (CHECK) `ck_invitacion_estado`: `CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'usada'::character varying, 'revocada'::character varying, 'vencida'::character varying])::text[])))`
- Regla (CHECK) `ck_invitacion_expiracion`: `CHECK ((expira_en > fecha_creacion))`
- Regla (CHECK) `ck_invitacion_rol`: `CHECK (((rol)::text = ANY ((ARRAY['estudiante'::character varying, 'docente'::character varying])::text[])))`
- Regla (CHECK) `ck_invitacion_token_hash`: `CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text))`
- Regla (CHECK) `ck_invitacion_uso`: `CHECK (((((estado)::text = 'usada'::text) AND (usada_en IS NOT NULL) AND (usada_por IS NOT NULL)) OR (((estado)::text <> 'usada'::text) AND (usada_en IS NULL) AND (usada_por IS NULL))))`
- Llave foránea `fk_invitacion_creador`: `FOREIGN KEY (creada_por) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_invitacion_institucion`: `FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_invitacion_usuario_usado`: `FOREIGN KEY (usada_por) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `invitacion_usuario_creada_por_not_null`: `NOT NULL creada_por`
- n `invitacion_usuario_email_not_null`: `NOT NULL email`
- n `invitacion_usuario_estado_not_null`: `NOT NULL estado`
- n `invitacion_usuario_expira_en_not_null`: `NOT NULL expira_en`
- n `invitacion_usuario_fecha_creacion_not_null`: `NOT NULL fecha_creacion`
- n `invitacion_usuario_id_institucion_not_null`: `NOT NULL id_institucion`
- n `invitacion_usuario_id_invitacion_usuario_not_null`: `NOT NULL id_invitacion_usuario`
- n `invitacion_usuario_rol_not_null`: `NOT NULL rol`
- n `invitacion_usuario_token_hash_not_null`: `NOT NULL token_hash`
- Llave primaria `pk_invitacion_usuario`: `PRIMARY KEY (id_invitacion_usuario)`
- Única `uq_invitacion_token_hash`: `UNIQUE (token_hash)`

## logro

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_logro` | uuid | no | gen_random_uuid() |
| `nombre` | character varying(120) | no |  |
| `descripcion` | text | no |  |
| `tipo` | character varying(20) | no |  |
| `tipo_condicion` | character varying(50) | no |  |
| `valor_umbral` | integer | no |  |

**Restricciones**

- Regla (CHECK) `ck_logro_condicion`: `CHECK (((tipo_condicion)::text = ANY ((ARRAY['xp_acumulado'::character varying, 'mundos_completados'::character varying, 'partidas_participadas'::character varying, 'ejercicios_aprobados'::character varying, 'podios_sala'::character varying, 'victorias_sala'::character varying, 'respuestas_rapidas'::character varying])::text[])))`
- Regla (CHECK) `ck_logro_tipo`: `CHECK (((tipo)::text = ANY ((ARRAY['logro'::character varying, 'insignia'::character varying])::text[])))`
- Regla (CHECK) `ck_logro_umbral`: `CHECK ((valor_umbral > 0))`
- n `logro_descripcion_not_null`: `NOT NULL descripcion`
- n `logro_id_logro_not_null`: `NOT NULL id_logro`
- n `logro_nombre_not_null`: `NOT NULL nombre`
- n `logro_tipo_condicion_not_null`: `NOT NULL tipo_condicion`
- n `logro_tipo_not_null`: `NOT NULL tipo`
- n `logro_valor_umbral_not_null`: `NOT NULL valor_umbral`
- Llave primaria `pk_logro`: `PRIMARY KEY (id_logro)`
- Única `uq_logro_nombre`: `UNIQUE (nombre)`

## matricula

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_matricula` | uuid | no | gen_random_uuid() |
| `id_curso` | uuid | no |  |
| `id_estudiante` | uuid | no |  |
| `fecha_matricula` | timestamp with time zone | no | now() |
| `estado` | character varying(20) | no | 'activa'::character varying |
| `mundos_convalidados` | integer | no | 0 |
| `diagnostico_aciertos` | integer | sí |  |
| `diagnostico_total` | integer | sí |  |
| `diagnostico_en` | timestamp with time zone | sí |  |

**Restricciones**

- Regla (CHECK) `ck_matricula_convalidados`: `CHECK (((mundos_convalidados >= 0) AND (mundos_convalidados <= 50)))`
- Regla (CHECK) `ck_matricula_estado`: `CHECK (((estado)::text = ANY ((ARRAY['activa'::character varying, 'retirada'::character varying])::text[])))`
- Llave foránea `fk_matricula_curso`: `FOREIGN KEY (id_curso) REFERENCES curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_matricula_estudiante`: `FOREIGN KEY (id_estudiante) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `matricula_estado_not_null`: `NOT NULL estado`
- n `matricula_fecha_matricula_not_null`: `NOT NULL fecha_matricula`
- n `matricula_id_curso_not_null`: `NOT NULL id_curso`
- n `matricula_id_estudiante_not_null`: `NOT NULL id_estudiante`
- n `matricula_id_matricula_not_null`: `NOT NULL id_matricula`
- n `matricula_mundos_convalidados_not_null`: `NOT NULL mundos_convalidados`
- Llave primaria `pk_matricula`: `PRIMARY KEY (id_matricula)`
- Única `uq_matricula`: `UNIQUE (id_curso, id_estudiante)`

## mision

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `codigo` | character varying(30) | no |  |
| `nombre` | character varying(80) | no |  |
| `descripcion` | character varying(200) | no |  |
| `tipo_condicion` | character varying(30) | no |  |
| `meta` | smallint | no |  |
| `recompensa_capa` | character varying(20) | sí |  |
| `recompensa_pieza` | character varying(30) | sí |  |

**Restricciones**

- Regla (CHECK) `ck_mision_condicion`: `CHECK (((tipo_condicion)::text = ANY ((ARRAY['ejercicios_enviados'::character varying, 'ejercicios_aprobados'::character varying, 'partidas_jugadas'::character varying, 'dias_activos'::character varying])::text[])))`
- Regla (CHECK) `ck_mision_meta`: `CHECK (((meta > 0) AND (meta <= 100)))`
- Regla (CHECK) `ck_mision_recompensa`: `CHECK (((recompensa_capa IS NULL) = (recompensa_pieza IS NULL)))`
- n `mision_codigo_not_null`: `NOT NULL codigo`
- n `mision_descripcion_not_null`: `NOT NULL descripcion`
- n `mision_meta_not_null`: `NOT NULL meta`
- n `mision_nombre_not_null`: `NOT NULL nombre`
- n `mision_tipo_condicion_not_null`: `NOT NULL tipo_condicion`
- Llave primaria `mision_pkey`: `PRIMARY KEY (codigo)`

## mundo

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_mundo` | uuid | no | gen_random_uuid() |
| `id_curso` | uuid | no |  |
| `id_silabo` | uuid | sí |  |
| `orden` | smallint | no |  |
| `nombre` | character varying(100) | no |  |
| `descripcion` | text | sí |  |
| `tipo_origen` | character varying(20) | no | 'base'::character varying |
| `leccion` | jsonb | sí |  |

**Restricciones**

- Regla (CHECK) `ck_mundo_leccion`: `CHECK (((leccion IS NULL) OR ((jsonb_typeof(leccion) = 'object'::text) AND (octet_length((leccion)::text) <= 20000))))`
- Regla (CHECK) `ck_mundo_orden`: `CHECK ((orden > 0))`
- Regla (CHECK) `ck_mundo_origen`: `CHECK (((tipo_origen)::text = ANY ((ARRAY['base'::character varying, 'personalizado'::character varying])::text[])))`
- Llave foránea `fk_mundo_curso`: `FOREIGN KEY (id_curso) REFERENCES curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_mundo_silabo`: `FOREIGN KEY (id_silabo) REFERENCES silabo(id_silabo) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `mundo_id_curso_not_null`: `NOT NULL id_curso`
- n `mundo_id_mundo_not_null`: `NOT NULL id_mundo`
- n `mundo_nombre_not_null`: `NOT NULL nombre`
- n `mundo_orden_not_null`: `NOT NULL orden`
- n `mundo_tipo_origen_not_null`: `NOT NULL tipo_origen`
- Llave primaria `pk_mundo`: `PRIMARY KEY (id_mundo)`
- Única `uq_mundo_orden`: `UNIQUE (id_curso, orden)`

## nivel

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_nivel` | uuid | no | gen_random_uuid() |
| `numero` | smallint | no |  |
| `nombre` | character varying(80) | no |  |
| `xp_requerido` | integer | no |  |

**Restricciones**

- Regla (CHECK) `ck_nivel_numero`: `CHECK ((numero > 0))`
- Regla (CHECK) `ck_nivel_xp`: `CHECK ((xp_requerido >= 0))`
- n `nivel_id_nivel_not_null`: `NOT NULL id_nivel`
- n `nivel_nombre_not_null`: `NOT NULL nombre`
- n `nivel_numero_not_null`: `NOT NULL numero`
- n `nivel_xp_requerido_not_null`: `NOT NULL xp_requerido`
- Llave primaria `pk_nivel`: `PRIMARY KEY (id_nivel)`
- Única `uq_nivel_nombre`: `UNIQUE (nombre)`
- Única `uq_nivel_numero`: `UNIQUE (numero)`
- Única `uq_nivel_xp`: `UNIQUE (xp_requerido)`

## notificacion

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_notificacion` | uuid | no | gen_random_uuid() |
| `id_usuario` | uuid | no |  |
| `tipo` | character varying(20) | no |  |
| `titulo` | character varying(80) | no |  |
| `mensaje` | character varying(200) | no |  |
| `enlace` | character varying(200) | sí |  |
| `leida_en` | timestamp with time zone | sí |  |
| `fecha_creacion` | timestamp with time zone | no | now() |

**Restricciones**

- Regla (CHECK) `ck_notificacion_enlace`: `CHECK (((enlace IS NULL) OR ((enlace)::text ~ '^#/[A-Za-z0-9/_?=&.-]*$'::text)))`
- Regla (CHECK) `ck_notificacion_tipo`: `CHECK (((tipo)::text = ANY ((ARRAY['logro'::character varying, 'mundo'::character varying, 'sala'::character varying, 'integridad'::character varying, 'matricula'::character varying])::text[])))`
- Llave foránea `notificacion_id_usuario_fkey`: `FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE`
- n `notificacion_fecha_creacion_not_null`: `NOT NULL fecha_creacion`
- n `notificacion_id_notificacion_not_null`: `NOT NULL id_notificacion`
- n `notificacion_id_usuario_not_null`: `NOT NULL id_usuario`
- n `notificacion_mensaje_not_null`: `NOT NULL mensaje`
- n `notificacion_tipo_not_null`: `NOT NULL tipo`
- n `notificacion_titulo_not_null`: `NOT NULL titulo`
- Llave primaria `notificacion_pkey`: `PRIMARY KEY (id_notificacion)`

## opcion

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_opcion` | uuid | no | gen_random_uuid() |
| `id_pregunta` | uuid | no |  |
| `etiqueta` | character varying(10) | no |  |
| `texto` | text | no |  |
| `es_correcta` | boolean | no | false |

**Restricciones**

- Llave foránea `fk_opcion_pregunta`: `FOREIGN KEY (id_pregunta) REFERENCES pregunta(id_pregunta) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `opcion_es_correcta_not_null`: `NOT NULL es_correcta`
- n `opcion_etiqueta_not_null`: `NOT NULL etiqueta`
- n `opcion_id_opcion_not_null`: `NOT NULL id_opcion`
- n `opcion_id_pregunta_not_null`: `NOT NULL id_pregunta`
- n `opcion_texto_not_null`: `NOT NULL texto`
- Llave primaria `pk_opcion`: `PRIMARY KEY (id_opcion)`
- Única `uq_opcion_etiqueta`: `UNIQUE (id_pregunta, etiqueta)`

## participante_sala

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_participante` | uuid | no | gen_random_uuid() |
| `id_sala` | uuid | no |  |
| `id_matricula` | uuid | no |  |
| `id_estudiante` | uuid | no |  |
| `id_curso` | uuid | no |  |
| `fecha_ingreso` | timestamp with time zone | no | now() |
| `puntaje_final` | integer | no | 0 |
| `posicion_final` | smallint | sí |  |

**Restricciones**

- Regla (CHECK) `ck_participante_puntaje`: `CHECK ((puntaje_final >= 0))`
- Llave foránea `fk_participante_curso`: `FOREIGN KEY (id_curso) REFERENCES curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_participante_estudiante`: `FOREIGN KEY (id_estudiante) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_participante_matricula`: `FOREIGN KEY (id_matricula) REFERENCES matricula(id_matricula) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_participante_sala_ref`: `FOREIGN KEY (id_sala) REFERENCES sala_multijugador(id_sala) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `participante_sala_fecha_ingreso_not_null`: `NOT NULL fecha_ingreso`
- n `participante_sala_id_curso_not_null`: `NOT NULL id_curso`
- n `participante_sala_id_estudiante_not_null`: `NOT NULL id_estudiante`
- n `participante_sala_id_matricula_not_null`: `NOT NULL id_matricula`
- n `participante_sala_id_participante_not_null`: `NOT NULL id_participante`
- n `participante_sala_id_sala_not_null`: `NOT NULL id_sala`
- n `participante_sala_puntaje_final_not_null`: `NOT NULL puntaje_final`
- Llave primaria `pk_participante_sala`: `PRIMARY KEY (id_participante)`
- Única `uq_participante_sala`: `UNIQUE (id_sala, id_estudiante)`

## pista_ia

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_pista` | uuid | no | gen_random_uuid() |
| `id_estudiante` | uuid | no |  |
| `id_ejercicio` | uuid | no |  |
| `id_envio_ejercicio` | uuid | sí |  |
| `nivel` | smallint | no |  |
| `contenido` | character varying(600) | no |  |
| `fecha_creacion` | timestamp with time zone | no | now() |

**Restricciones**

- Regla (CHECK) `ck_pista_nivel`: `CHECK (((nivel >= 1) AND (nivel <= 3)))`
- Llave foránea `pista_ia_id_ejercicio_fkey`: `FOREIGN KEY (id_ejercicio) REFERENCES ejercicio(id_ejercicio) ON DELETE CASCADE`
- Llave foránea `pista_ia_id_envio_ejercicio_fkey`: `FOREIGN KEY (id_envio_ejercicio) REFERENCES envio_ejercicio(id_envio_ejercicio) ON DELETE SET NULL`
- Llave foránea `pista_ia_id_estudiante_fkey`: `FOREIGN KEY (id_estudiante) REFERENCES usuario(id_usuario) ON DELETE CASCADE`
- n `pista_ia_contenido_not_null`: `NOT NULL contenido`
- n `pista_ia_fecha_creacion_not_null`: `NOT NULL fecha_creacion`
- n `pista_ia_id_ejercicio_not_null`: `NOT NULL id_ejercicio`
- n `pista_ia_id_estudiante_not_null`: `NOT NULL id_estudiante`
- n `pista_ia_id_pista_not_null`: `NOT NULL id_pista`
- n `pista_ia_nivel_not_null`: `NOT NULL nivel`
- Llave primaria `pista_ia_pkey`: `PRIMARY KEY (id_pista)`
- Única `uq_pista_nivel`: `UNIQUE (id_estudiante, id_ejercicio, nivel)`

## pregunta

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_pregunta` | uuid | no | gen_random_uuid() |
| `id_sala` | uuid | no |  |
| `orden` | smallint | no |  |
| `enunciado` | text | no |  |
| `tiempo_limite_seg` | smallint | no | 30 |
| `puntos_base` | integer | no | 1000 |

**Restricciones**

- Regla (CHECK) `ck_pregunta_orden`: `CHECK ((orden > 0))`
- Regla (CHECK) `ck_pregunta_puntos`: `CHECK ((puntos_base >= 0))`
- Regla (CHECK) `ck_pregunta_tiempo`: `CHECK ((tiempo_limite_seg > 0))`
- Llave foránea `fk_pregunta_sala`: `FOREIGN KEY (id_sala) REFERENCES sala_multijugador(id_sala) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `pregunta_enunciado_not_null`: `NOT NULL enunciado`
- n `pregunta_id_pregunta_not_null`: `NOT NULL id_pregunta`
- n `pregunta_id_sala_not_null`: `NOT NULL id_sala`
- n `pregunta_orden_not_null`: `NOT NULL orden`
- n `pregunta_puntos_base_not_null`: `NOT NULL puntos_base`
- n `pregunta_tiempo_limite_seg_not_null`: `NOT NULL tiempo_limite_seg`
- Llave primaria `pk_pregunta`: `PRIMARY KEY (id_pregunta)`
- Única `uq_pregunta_orden`: `UNIQUE (id_sala, orden)`

## progreso_mundo

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_progreso_mundo` | uuid | no | gen_random_uuid() |
| `id_matricula` | uuid | no |  |
| `id_mundo` | uuid | no |  |
| `id_curso` | uuid | no |  |
| `estado` | character varying(20) | no | 'bloqueado'::character varying |
| `fecha_inicio` | timestamp with time zone | sí |  |
| `fecha_completado` | timestamp with time zone | sí |  |

**Restricciones**

- Regla (CHECK) `ck_progreso_estado`: `CHECK (((estado)::text = ANY ((ARRAY['bloqueado'::character varying, 'en_progreso'::character varying, 'completado'::character varying])::text[])))`
- Llave foránea `fk_progreso_curso`: `FOREIGN KEY (id_curso) REFERENCES curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_progreso_matricula`: `FOREIGN KEY (id_matricula) REFERENCES matricula(id_matricula) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_progreso_mundo_ref`: `FOREIGN KEY (id_mundo) REFERENCES mundo(id_mundo) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `progreso_mundo_estado_not_null`: `NOT NULL estado`
- n `progreso_mundo_id_curso_not_null`: `NOT NULL id_curso`
- n `progreso_mundo_id_matricula_not_null`: `NOT NULL id_matricula`
- n `progreso_mundo_id_mundo_not_null`: `NOT NULL id_mundo`
- n `progreso_mundo_id_progreso_mundo_not_null`: `NOT NULL id_progreso_mundo`
- Llave primaria `pk_progreso_mundo`: `PRIMARY KEY (id_progreso_mundo)`
- Única `uq_progreso_mundo`: `UNIQUE (id_matricula, id_mundo)`

## respuesta_sala

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_respuesta_sala` | uuid | no | gen_random_uuid() |
| `id_participante` | uuid | no |  |
| `id_pregunta` | uuid | no |  |
| `id_opcion` | uuid | no |  |
| `id_sala` | uuid | no |  |
| `tiempo_respuesta` | integer | no |  |
| `puntaje_obtenido` | integer | no | 0 |

**Restricciones**

- Regla (CHECK) `ck_respuesta_puntaje`: `CHECK ((puntaje_obtenido >= 0))`
- Regla (CHECK) `ck_respuesta_tiempo`: `CHECK ((tiempo_respuesta >= 0))`
- Llave foránea `fk_respuesta_opcion`: `FOREIGN KEY (id_opcion) REFERENCES opcion(id_opcion) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_respuesta_participante`: `FOREIGN KEY (id_participante) REFERENCES participante_sala(id_participante) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_respuesta_pregunta`: `FOREIGN KEY (id_pregunta) REFERENCES pregunta(id_pregunta) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_respuesta_sala_ref`: `FOREIGN KEY (id_sala) REFERENCES sala_multijugador(id_sala) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `respuesta_sala_id_opcion_not_null`: `NOT NULL id_opcion`
- n `respuesta_sala_id_participante_not_null`: `NOT NULL id_participante`
- n `respuesta_sala_id_pregunta_not_null`: `NOT NULL id_pregunta`
- n `respuesta_sala_id_respuesta_sala_not_null`: `NOT NULL id_respuesta_sala`
- n `respuesta_sala_id_sala_not_null`: `NOT NULL id_sala`
- n `respuesta_sala_puntaje_obtenido_not_null`: `NOT NULL puntaje_obtenido`
- n `respuesta_sala_tiempo_respuesta_not_null`: `NOT NULL tiempo_respuesta`
- Llave primaria `pk_respuesta_sala`: `PRIMARY KEY (id_respuesta_sala)`
- Única `uq_respuesta_sala`: `UNIQUE (id_participante, id_pregunta)`

## sala_multijugador

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_sala` | uuid | no | gen_random_uuid() |
| `id_curso` | uuid | no |  |
| `pin_sala` | character(6) | no |  |
| `estado` | character varying(20) | no | 'espera'::character varying |
| `id_pregunta_activa` | uuid | sí |  |
| `fecha_apertura_pregunta` | timestamp with time zone | sí |  |
| `fecha_creacion` | timestamp with time zone | no | now() |
| `fecha_inicio` | timestamp with time zone | sí |  |
| `fecha_fin` | timestamp with time zone | sí |  |

**Restricciones**

- Regla (CHECK) `ck_sala_estado`: `CHECK (((estado)::text = ANY ((ARRAY['espera'::character varying, 'en_curso'::character varying, 'finalizada'::character varying, 'cancelada'::character varying])::text[])))`
- Regla (CHECK) `ck_sala_pin`: `CHECK ((pin_sala ~ '^\d{6}$'::text))`
- Llave foránea `fk_sala_curso`: `FOREIGN KEY (id_curso) REFERENCES curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_sala_pregunta_activa`: `FOREIGN KEY (id_pregunta_activa) REFERENCES pregunta(id_pregunta) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `sala_multijugador_estado_not_null`: `NOT NULL estado`
- n `sala_multijugador_fecha_creacion_not_null`: `NOT NULL fecha_creacion`
- n `sala_multijugador_id_curso_not_null`: `NOT NULL id_curso`
- n `sala_multijugador_id_sala_not_null`: `NOT NULL id_sala`
- n `sala_multijugador_pin_sala_not_null`: `NOT NULL pin_sala`
- Llave primaria `pk_sala`: `PRIMARY KEY (id_sala)`

## schema_migration

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `nombre` | character varying(255) | no |  |
| `aplicado_en` | timestamp with time zone | no | now() |

**Restricciones**

- n `schema_migration_aplicado_en_not_null`: `NOT NULL aplicado_en`
- n `schema_migration_nombre_not_null`: `NOT NULL nombre`
- Llave primaria `schema_migration_pkey`: `PRIMARY KEY (nombre)`

## silabo

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_silabo` | uuid | no | gen_random_uuid() |
| `id_curso` | uuid | no |  |
| `nombre_archivo` | character varying(255) | no |  |
| `ruta_archivo` | text | sí |  |
| `fecha_carga` | timestamp with time zone | no | now() |
| `estado_procesamiento` | character varying(20) | no | 'cargado'::character varying |
| `tamano_bytes` | integer | sí |  |
| `sha256` | character(64) | sí |  |
| `mensaje_error` | character varying(300) | sí |  |
| `contenido_pdf` | bytea | sí |  |

**Restricciones**

- Regla (CHECK) `ck_silabo_estado`: `CHECK (((estado_procesamiento)::text = ANY ((ARRAY['cargado'::character varying, 'procesando'::character varying, 'procesado'::character varying, 'error'::character varying])::text[])))`
- Regla (CHECK) `ck_silabo_pdf_tamano`: `CHECK (((contenido_pdf IS NULL) OR (octet_length(contenido_pdf) <= 10485760)))`
- Regla (CHECK) `ck_silabo_tamano`: `CHECK (((tamano_bytes IS NULL) OR ((tamano_bytes > 0) AND (tamano_bytes <= 10485760))))`
- Llave foránea `fk_silabo_curso`: `FOREIGN KEY (id_curso) REFERENCES curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `silabo_estado_procesamiento_not_null`: `NOT NULL estado_procesamiento`
- n `silabo_fecha_carga_not_null`: `NOT NULL fecha_carga`
- n `silabo_id_curso_not_null`: `NOT NULL id_curso`
- n `silabo_id_silabo_not_null`: `NOT NULL id_silabo`
- n `silabo_nombre_archivo_not_null`: `NOT NULL nombre_archivo`
- Llave primaria `pk_silabo`: `PRIMARY KEY (id_silabo)`

## token_cuenta

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_token_cuenta` | uuid | no | gen_random_uuid() |
| `id_usuario` | uuid | no |  |
| `tipo` | character varying(40) | no |  |
| `token_hash` | character(64) | no |  |
| `expira_en` | timestamp with time zone | no |  |
| `usado_en` | timestamp with time zone | sí |  |
| `revocado_en` | timestamp with time zone | sí |  |
| `fecha_creacion` | timestamp with time zone | no | now() |

**Restricciones**

- Regla (CHECK) `ck_token_cuenta_estado`: `CHECK ((NOT ((usado_en IS NOT NULL) AND (revocado_en IS NOT NULL))))`
- Regla (CHECK) `ck_token_cuenta_expiracion`: `CHECK ((expira_en > fecha_creacion))`
- Regla (CHECK) `ck_token_cuenta_hash`: `CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text))`
- Regla (CHECK) `ck_token_cuenta_tipo`: `CHECK (((tipo)::text = 'restablecer_password'::text))`
- Llave foránea `fk_token_cuenta_usuario`: `FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `token_cuenta_expira_en_not_null`: `NOT NULL expira_en`
- n `token_cuenta_fecha_creacion_not_null`: `NOT NULL fecha_creacion`
- n `token_cuenta_id_token_cuenta_not_null`: `NOT NULL id_token_cuenta`
- n `token_cuenta_id_usuario_not_null`: `NOT NULL id_usuario`
- n `token_cuenta_tipo_not_null`: `NOT NULL tipo`
- n `token_cuenta_token_hash_not_null`: `NOT NULL token_hash`
- Llave primaria `pk_token_cuenta`: `PRIMARY KEY (id_token_cuenta)`
- Única `uq_token_cuenta_hash`: `UNIQUE (token_hash)`

## uso_ia

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_uso_ia` | uuid | no | gen_random_uuid() |
| `id_operacion` | uuid | no |  |
| `id_docente` | uuid | no |  |
| `id_institucion` | uuid | no |  |
| `id_envio_ejercicio` | uuid | sí |  |
| `id_silabo` | uuid | sí |  |
| `tipo_operacion` | character varying(30) | no |  |
| `tokens_reservados` | bigint | no | 0 |
| `tokens_consumidos` | bigint | sí |  |
| `estado_consumo` | character varying(20) | no | 'reservado'::character varying |
| `resultado_operacion` | character varying(20) | no | 'pendiente'::character varying |
| `docente_snapshot` | character varying(200) | sí |  |
| `institucion_snapshot` | character varying(200) | sí |  |
| `fecha_uso` | timestamp with time zone | no | now() |
| `proveedor_ia` | character varying(30) | sí |  |
| `modelo_ia` | character varying(100) | sí |  |

**Restricciones**

- Regla (CHECK) `ck_uso_ia_estado`: `CHECK (((estado_consumo)::text = ANY ((ARRAY['reservado'::character varying, 'confirmado'::character varying, 'fallido'::character varying])::text[])))`
- Regla (CHECK) `ck_uso_ia_proveedor`: `CHECK (((proveedor_ia IS NULL) OR ((proveedor_ia)::text = 'gemini'::text)))`
- Regla (CHECK) `ck_uso_ia_referencias`: `CHECK (((((tipo_operacion)::text = 'evaluacion'::text) AND (id_envio_ejercicio IS NOT NULL) AND (id_silabo IS NULL)) OR (((tipo_operacion)::text = 'generacion_mundo'::text) AND (id_silabo IS NOT NULL) AND (id_envio_ejercicio IS NULL))))`
- Regla (CHECK) `ck_uso_ia_resultado`: `CHECK (((resultado_operacion)::text = ANY ((ARRAY['pendiente'::character varying, 'exitoso'::character varying, 'fallido'::character varying])::text[])))`
- Regla (CHECK) `ck_uso_ia_tipo`: `CHECK (((tipo_operacion)::text = ANY ((ARRAY['evaluacion'::character varying, 'generacion_mundo'::character varying])::text[])))`
- Regla (CHECK) `ck_uso_ia_tokens`: `CHECK (((tokens_reservados >= 0) AND ((tokens_consumidos IS NULL) OR ((tokens_consumidos >= 0) AND (tokens_consumidos <= tokens_reservados)))))`
- Regla (CHECK) `ck_uso_ia_transicion`: `CHECK (((((estado_consumo)::text = 'reservado'::text) AND ((resultado_operacion)::text = 'pendiente'::text) AND (tokens_consumidos IS NULL)) OR (((estado_consumo)::text = 'confirmado'::text) AND ((resultado_operacion)::text = 'exitoso'::text) AND (tokens_consumidos IS NOT NULL)) OR (((estado_consumo)::text = 'fallido'::text) AND ((resultado_operacion)::text = 'fallido'::text))))`
- Llave foránea `fk_uso_ia_docente`: `FOREIGN KEY (id_docente) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_uso_ia_envio`: `FOREIGN KEY (id_envio_ejercicio) REFERENCES envio_ejercicio(id_envio_ejercicio) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_uso_ia_institucion`: `FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_uso_ia_silabo`: `FOREIGN KEY (id_silabo) REFERENCES silabo(id_silabo) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `uso_ia_estado_consumo_not_null`: `NOT NULL estado_consumo`
- n `uso_ia_fecha_uso_not_null`: `NOT NULL fecha_uso`
- n `uso_ia_id_docente_not_null`: `NOT NULL id_docente`
- n `uso_ia_id_institucion_not_null`: `NOT NULL id_institucion`
- n `uso_ia_id_operacion_not_null`: `NOT NULL id_operacion`
- n `uso_ia_id_uso_ia_not_null`: `NOT NULL id_uso_ia`
- n `uso_ia_resultado_operacion_not_null`: `NOT NULL resultado_operacion`
- n `uso_ia_tipo_operacion_not_null`: `NOT NULL tipo_operacion`
- n `uso_ia_tokens_reservados_not_null`: `NOT NULL tokens_reservados`
- Llave primaria `pk_uso_ia`: `PRIMARY KEY (id_uso_ia)`
- Única `uq_uso_ia_operacion`: `UNIQUE (id_operacion)`

## usuario

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_usuario` | uuid | no | gen_random_uuid() |
| `id_institucion` | uuid | sí |  |
| `nombre` | character varying(100) | no |  |
| `apellido` | character varying(100) | no |  |
| `email` | character varying(254) | no |  |
| `password_hash` | text | no |  |
| `rol` | character varying(25) | no |  |
| `estado` | character varying(25) | no | 'pendiente'::character varying |
| `correo_verificado` | boolean | no | false |
| `fecha_creacion` | timestamp with time zone | no | now() |
| `genero` | character varying(25) | no |  |
| `ultimo_acceso` | timestamp with time zone | sí |  |
| `token_version` | integer | no | 0 |
| `correo_verificado_en` | timestamp with time zone | sí |  |
| `password_actualizada_en` | timestamp with time zone | no | now() |
| `avatar_config` | jsonb | sí |  |
| `fecha_nacimiento` | date | sí |  |
| `terminos_aceptados_en` | timestamp with time zone | sí |  |
| `terminos_version` | character varying(20) | sí |  |
| `consentimiento_tutor_en` | timestamp with time zone | sí |  |

**Restricciones**

- Regla (CHECK) `ck_usuario_apellido_formato`: `CHECK ((((apellido)::text = btrim((apellido)::text)) AND ((char_length((apellido)::text) >= 2) AND (char_length((apellido)::text) <= 100)) AND ((apellido)::text ~ '^[[:alpha:]][[:alpha:] .''-]*[[:alpha:]]$'::text)))`
- Regla (CHECK) `ck_usuario_avatar_config`: `CHECK (((avatar_config IS NULL) OR ((jsonb_typeof(avatar_config) = 'object'::text) AND (octet_length((avatar_config)::text) <= 600))))`
- Regla (CHECK) `ck_usuario_email_formato`: `CHECK ((((email)::text = lower(btrim((email)::text))) AND ((char_length((email)::text) >= 3) AND (char_length((email)::text) <= 254)) AND ((email)::text ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text)))`
- Regla (CHECK) `ck_usuario_estado`: `CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'activo'::character varying, 'inactivo'::character varying])::text[])))`
- Regla (CHECK) `ck_usuario_genero`: `CHECK (((genero)::text = ANY ((ARRAY['femenino'::character varying, 'masculino'::character varying])::text[])))`
- Regla (CHECK) `ck_usuario_institucion_requerida`: `CHECK (((((rol)::text = 'superadministrador'::text) AND (id_institucion IS NULL)) OR (((rol)::text <> 'superadministrador'::text) AND (id_institucion IS NOT NULL))))`
- Regla (CHECK) `ck_usuario_nacimiento`: `CHECK (((fecha_nacimiento IS NULL) OR (fecha_nacimiento >= '1900-01-01'::date)))`
- Regla (CHECK) `ck_usuario_nombre_formato`: `CHECK ((((nombre)::text = btrim((nombre)::text)) AND ((char_length((nombre)::text) >= 2) AND (char_length((nombre)::text) <= 100)) AND ((nombre)::text ~ '^[[:alpha:]][[:alpha:] .''-]*[[:alpha:]]$'::text)))`
- Regla (CHECK) `ck_usuario_password_hash_formato`: `CHECK ((password_hash ~ '^\$2[aby]\$(10\|11\|12\|13\|14)\$[./A-Za-z0-9]{53}$'::text))`
- Regla (CHECK) `ck_usuario_rol`: `CHECK (((rol)::text = ANY ((ARRAY['estudiante'::character varying, 'docente'::character varying, 'superadministrador'::character varying])::text[])))`
- Regla (CHECK) `ck_usuario_superadmin_fijo`: `CHECK ((((rol)::text <> 'superadministrador'::text) OR (((email)::text = 'admin@codeintcorp.com'::text) AND ((estado)::text = 'activo'::text) AND (correo_verificado = true))))`
- Regla (CHECK) `ck_usuario_terminos`: `CHECK (((terminos_aceptados_en IS NULL) = (terminos_version IS NULL)))`
- Regla (CHECK) `ck_usuario_token_version`: `CHECK ((token_version >= 0))`
- Regla (CHECK) `ck_usuario_verificacion_fecha`: `CHECK ((((correo_verificado = true) AND (correo_verificado_en IS NOT NULL)) OR ((correo_verificado = false) AND (correo_verificado_en IS NULL))))`
- Llave foránea `fk_usuario_institucion`: `FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `usuario_apellido_not_null`: `NOT NULL apellido`
- n `usuario_correo_verificado_not_null`: `NOT NULL correo_verificado`
- n `usuario_email_not_null`: `NOT NULL email`
- n `usuario_estado_not_null`: `NOT NULL estado`
- n `usuario_fecha_creacion_not_null`: `NOT NULL fecha_creacion`
- n `usuario_genero_not_null`: `NOT NULL genero`
- n `usuario_id_usuario_not_null`: `NOT NULL id_usuario`
- n `usuario_nombre_not_null`: `NOT NULL nombre`
- n `usuario_password_actualizada_en_not_null`: `NOT NULL password_actualizada_en`
- n `usuario_password_hash_not_null`: `NOT NULL password_hash`
- n `usuario_rol_not_null`: `NOT NULL rol`
- n `usuario_token_version_not_null`: `NOT NULL token_version`
- Llave primaria `pk_usuario`: `PRIMARY KEY (id_usuario)`
- Única `uq_usuario_email`: `UNIQUE (email)`

## xp_movimiento

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| `id_xp_movimiento` | uuid | no | gen_random_uuid() |
| `id_estudiante` | uuid | no |  |
| `id_curso` | uuid | no |  |
| `id_evaluacion` | uuid | sí |  |
| `id_participante_sala` | uuid | sí |  |
| `cantidad` | integer | no |  |
| `origen` | character varying(30) | no |  |
| `fecha` | timestamp with time zone | no | now() |
| `id_ejercicio` | uuid | sí |  |

**Restricciones**

- Regla (CHECK) `ck_xp_cantidad`: `CHECK ((cantidad > 0))`
- Regla (CHECK) `ck_xp_origen`: `CHECK (((origen)::text = ANY ((ARRAY['evaluacion_ia'::character varying, 'participante_sala'::character varying])::text[])))`
- Regla (CHECK) `ck_xp_referencia_origen`: `CHECK (((((origen)::text = 'evaluacion_ia'::text) AND (id_evaluacion IS NOT NULL) AND (id_ejercicio IS NOT NULL) AND (id_participante_sala IS NULL)) OR (((origen)::text = 'participante_sala'::text) AND (id_participante_sala IS NOT NULL) AND (id_evaluacion IS NULL) AND (id_ejercicio IS NULL))))`
- Llave foránea `fk_xp_curso`: `FOREIGN KEY (id_curso) REFERENCES curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_xp_ejercicio`: `FOREIGN KEY (id_ejercicio) REFERENCES ejercicio(id_ejercicio) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_xp_estudiante`: `FOREIGN KEY (id_estudiante) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_xp_evaluacion`: `FOREIGN KEY (id_evaluacion) REFERENCES evaluacion_ia(id_evaluacion) ON UPDATE RESTRICT ON DELETE RESTRICT`
- Llave foránea `fk_xp_participante_sala`: `FOREIGN KEY (id_participante_sala) REFERENCES participante_sala(id_participante) ON UPDATE RESTRICT ON DELETE RESTRICT`
- n `xp_movimiento_cantidad_not_null`: `NOT NULL cantidad`
- n `xp_movimiento_fecha_not_null`: `NOT NULL fecha`
- n `xp_movimiento_id_curso_not_null`: `NOT NULL id_curso`
- n `xp_movimiento_id_estudiante_not_null`: `NOT NULL id_estudiante`
- n `xp_movimiento_id_xp_movimiento_not_null`: `NOT NULL id_xp_movimiento`
- n `xp_movimiento_origen_not_null`: `NOT NULL origen`
- Llave primaria `pk_xp_movimiento`: `PRIMARY KEY (id_xp_movimiento)`


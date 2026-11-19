// ==============================================================
// codeInt - Controlador de Cursos y Matrículas (/api/cursos)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const { query, getClient } = require('../config/database');
const { getAuthorizedCourse } = require('../services/authorizationService');
const { normalizeEmail } = require('../utils/validation');
const { BASE_WORLDS } = require('../config/baseContent');
const { generateCourseCode, isValidCourseCode } = require('../utils/courseCode');
const { DEFAULT_LANGUAGE, getLanguage, isValidLanguage } = require('../config/languages');
const { httpError } = require('../utils/httpError');
const { notify } = require('../services/notificationService');
const { recordSecurityEvent, getRequestIp } = require('../services/securityAuditService');

/**
 * Listado de cursos según el rol del usuario
 * GET /api/cursos
 */
const getCursos = async (req, res, next) => {
    try {
        const user = req.user;
        let sql = '';
        let params = [];

        if (user.rol === 'estudiante') {
            // Cursos donde el estudiante está matriculado
            sql = `
                SELECT c.id_curso, c.id_institucion, c.nombre, c.codigo_curso, c.periodo, c.estado, c.lenguaje,
                       m.id_matricula, m.fecha_matricula, m.estado AS estado_matricula,
                       u.nombre AS docente_nombre, u.apellido AS docente_apellido, u.email AS docente_email,
                       (SELECT count(*) FROM mundo mu WHERE mu.id_curso = c.id_curso)::INTEGER AS total_mundos,
                       (SELECT count(*) FROM progreso_mundo pm WHERE pm.id_matricula = m.id_matricula AND pm.estado = 'completado')::INTEGER AS mundos_completados
                FROM matricula m
                JOIN curso c ON c.id_curso = m.id_curso
                JOIN usuario u ON u.id_usuario = c.id_docente
                WHERE m.id_estudiante = $1 AND m.estado = 'activa' AND c.estado = 'activo'
                ORDER BY c.fecha_creacion DESC;
            `;
            params = [user.id_usuario];
        } else if (user.rol === 'docente') {
            // Cursos administrados por este docente
            sql = `
                SELECT c.id_curso, c.id_institucion, c.nombre, c.codigo_curso, c.periodo, c.estado, c.lenguaje, c.union_por_codigo, c.fecha_creacion,
                       (SELECT count(*) FROM matricula m WHERE m.id_curso = c.id_curso AND m.estado = 'activa')::INTEGER AS total_estudiantes,
                       (SELECT count(*) FROM mundo mu WHERE mu.id_curso = c.id_curso)::INTEGER AS total_mundos
                FROM curso c
                WHERE c.id_docente = $1 AND c.id_institucion = $2
                ORDER BY c.fecha_creacion DESC;
            `;
            params = [user.id_usuario, user.id_institucion];
        } else {
            // Superadministrador: todos los cursos de todas las instituciones
            sql = `
                SELECT c.id_curso, c.id_institucion, c.nombre, c.codigo_curso, c.periodo, c.estado, c.lenguaje, c.union_por_codigo, c.fecha_creacion,
                       i.nombre AS institucion_nombre,
                       u.nombre AS docente_nombre, u.apellido AS docente_apellido,
                       (SELECT count(*) FROM matricula m WHERE m.id_curso = c.id_curso AND m.estado = 'activa')::INTEGER AS total_estudiantes,
                       (SELECT count(*) FROM mundo mu WHERE mu.id_curso = c.id_curso)::INTEGER AS total_mundos
                FROM curso c
                JOIN institucion i ON i.id_institucion = c.id_institucion
                JOIN usuario u ON u.id_usuario = c.id_docente
                ORDER BY c.fecha_creacion DESC;
            `;
            params = [];
        }

        const result = await query(sql, params);
        return res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Detalle de un curso específico
 * GET /api/cursos/:id_curso
 */
const getCursoById = async (req, res, next) => {
    try {
        const { id_curso } = req.params;
        const user = req.user;
        await getAuthorizedCourse(id_curso, user);

        const sql = `
            SELECT c.id_curso, c.id_institucion, c.id_docente, c.nombre, c.codigo_curso, c.periodo, c.estado, c.lenguaje, c.union_por_codigo, c.fecha_creacion,
                   i.nombre AS institucion_nombre,
                   u.nombre AS docente_nombre, u.apellido AS docente_apellido, u.email AS docente_email,
                   (SELECT count(*) FROM matricula m WHERE m.id_curso = c.id_curso AND m.estado = 'activa')::INTEGER AS total_estudiantes
            FROM curso c
            JOIN institucion i ON i.id_institucion = c.id_institucion
            JOIN usuario u ON u.id_usuario = c.id_docente
            WHERE c.id_curso = $1
            LIMIT 1;
        `;
        const result = await query(sql, [id_curso]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'El curso solicitado no fue encontrado.'
            });
        }

        const curso = result.rows[0];

        // Validar aislamiento de institución
        if (user.rol !== 'superadministrador' && curso.id_institucion !== user.id_institucion) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para acceder a este curso (pertenece a otra institución).'
            });
        }

        // Obtener mundos asociados al curso
        const mundosSql = `
            SELECT id_mundo, orden, nombre, descripcion, tipo_origen,
                   (SELECT count(*) FROM ejercicio e WHERE e.id_mundo = mu.id_mundo)::INTEGER AS total_ejercicios
            FROM mundo mu
            WHERE mu.id_curso = $1
            ORDER BY mu.orden ASC;
        `;
        const mundosRes = await query(mundosSql, [id_curso]);
        curso.mundos = mundosRes.rows;

        // Si es estudiante, adjuntar estado de matrícula
        if (user.rol === 'estudiante') {
            const matSql = `
                SELECT id_matricula, estado, fecha_matricula
                FROM matricula
                WHERE id_curso = $1 AND id_estudiante = $2
                LIMIT 1;
            `;
            const matRes = await query(matSql, [id_curso, user.id_usuario]);
            curso.matricula = matRes.rows[0] || null;
        }

        return res.json({
            success: true,
            data: curso
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Creación de un nuevo curso
 * POST /api/cursos
 */
// Sugiere un código libre para (institución, periodo) a partir del nombre del curso.
const suggestCourseCode = async (idInstitucion, nombre, periodo) => {
    const taken = await query(
        'SELECT codigo_curso FROM curso WHERE id_institucion = $1 AND periodo = $2;',
        [idInstitucion, String(periodo).trim()]
    );
    return generateCourseCode(nombre, taken.rows.map((row) => row.codigo_curso));
};

/**
 * Vista previa del código automático mientras se escribe el nombre
 * GET /api/cursos/codigo-sugerido?nombre=&periodo=
 */
const getCodigoSugerido = async (req, res, next) => {
    try {
        const nombre = String(req.query.nombre || '').trim().slice(0, 150);
        const periodo = String(req.query.periodo || '').trim().slice(0, 20);
        const idInstitucion = req.user.rol === 'superadministrador' ? req.query.id_institucion : req.user.id_institucion;
        if (!nombre || !idInstitucion) return res.json({ success: true, codigo: null });
        const codigo = await suggestCourseCode(idInstitucion, nombre, periodo);
        return res.json({ success: true, codigo });
    } catch (error) {
        return next(error);
    }
};

const createCurso = async (req, res, next) => {
    const client = await getClient();
    try {
        const { nombre, periodo } = req.body;
        const user = req.user;
        const lenguaje = req.body.lenguaje === undefined ? DEFAULT_LANGUAGE : req.body.lenguaje;
        if (!isValidLanguage(lenguaje)) {
            return res.status(400).json({ success: false, error: 'INVALID_LANGUAGE', message: 'El lenguaje del curso no es válido.' });
        }

        // El código es opcional: si el docente no lo escribe se genera desde el nombre.
        if (!nombre || !periodo) {
            return res.status(400).json({
                success: false,
                message: 'Los campos nombre y periodo son obligatorios.'
            });
        }

        const id_institucion = user.rol === 'superadministrador'
            ? req.body.id_institucion
            : user.id_institucion;
        const id_docente = (user.rol === 'superadministrador' && req.body.id_docente) ? req.body.id_docente : user.id_usuario;

        if (!id_institucion) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere una institución educativa para crear el curso.'
            });
        }

        const institution = await query(
            'SELECT estado FROM institucion WHERE id_institucion = $1 LIMIT 1;',
            [id_institucion]
        );
        if (institution.rowCount === 0 || institution.rows[0].estado !== 'activa') {
            return res.status(400).json({
                success: false,
                message: 'La institución debe estar activa para crear cursos.'
            });
        }

        if (user.rol === 'superadministrador') {
            const teacher = await query(
                `SELECT id_usuario FROM usuario
                 WHERE id_usuario = $1 AND id_institucion = $2
                   AND rol = 'docente' AND estado = 'activo';`,
                [id_docente, id_institucion]
            );
            if (teacher.rowCount === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El docente debe estar activo y pertenecer a la institución seleccionada.'
                });
            }
        }

        let codigo_curso = typeof req.body.codigo_curso === 'string' ? req.body.codigo_curso.trim().toUpperCase() : '';
        if (codigo_curso && !isValidCourseCode(codigo_curso)) {
            return res.status(400).json({
                success: false,
                message: 'El código del curso solo admite letras, números y guiones (2 a 20 caracteres).'
            });
        }
        if (!codigo_curso) {
            codigo_curso = await suggestCourseCode(id_institucion, nombre, periodo);
            if (!codigo_curso) {
                return res.status(400).json({
                    success: false,
                    message: 'No se pudo generar un código con ese nombre. Escribe uno manualmente.'
                });
            }
        }

        await client.query('BEGIN');

        // Insertar curso
        const insertCursoSql = `
            INSERT INTO curso (id_institucion, id_docente, nombre, codigo_curso, periodo, estado, lenguaje)
            VALUES ($1, $2, $3, $4, $5, 'activo', $6)
            RETURNING id_curso, id_institucion, id_docente, nombre, codigo_curso, periodo, estado, lenguaje, fecha_creacion;
        `;
        const cursoRes = await client.query(insertCursoSql, [
            id_institucion,
            id_docente,
            nombre.trim(),
            codigo_curso,
            periodo.trim(),
            lenguaje
        ]);
        const nuevoCurso = cursoRes.rows[0];

        // Solo los cursos de PSeInt traen los 7 Mundos Base; los demás nacen vacíos y se llenan con el sílabo + IA.
        for (const m of (lenguaje === DEFAULT_LANGUAGE ? BASE_WORLDS : [])) {
            const mundoRes = await client.query(
                `INSERT INTO mundo (id_curso, orden, nombre, descripcion, tipo_origen)
                 VALUES ($1, $2, $3, $4, 'base')
                 RETURNING id_mundo;`,
                [nuevoCurso.id_curso, m.orden, m.nombre, m.descripcion]
            );
            const idMundo = mundoRes.rows[0].id_mundo;

            for (const ejercicio of m.ejercicios) {
                await client.query(
                    `INSERT INTO ejercicio (id_mundo, id_curso, titulo, enunciado, plantilla_pseint, orden, xp_recompensa)
                     VALUES ($1, $2, $3, $4, $5, $6, $7);`,
                    [idMundo, nuevoCurso.id_curso, ejercicio.titulo, ejercicio.enunciado,
                        ejercicio.plantilla_pseint, ejercicio.orden, ejercicio.xp_recompensa]
                );
            }
        }

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: lenguaje === DEFAULT_LANGUAGE
                ? 'Curso creado exitosamente con sus 7 mundos temáticos y su contenido base.'
                : `Curso de ${getLanguage(lenguaje).nombre} creado. Empieza sin mundos: sube tu sílabo para que la IA los genere.`,
            data: nuevoCurso
        });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

/**
 * Actualización de un curso
 * PUT /api/cursos/:id_curso
 */
const updateCurso = async (req, res, next) => {
    try {
        const { id_curso } = req.params;
        const { nombre, codigo_curso, periodo, estado, lenguaje } = req.body;
        const unionPorCodigo = typeof req.body.union_por_codigo === 'boolean' ? req.body.union_por_codigo : null;
        const user = req.user;
        await getAuthorizedCourse(id_curso, user, { write: true });
        if (lenguaje !== undefined && !isValidLanguage(lenguaje)) {
            return res.status(400).json({ success: false, error: 'INVALID_LANGUAGE', message: 'El lenguaje del curso no es válido.' });
        }

        // Verificar que el curso exista y pertenezca al docente o institución
        const checkSql = 'SELECT id_curso, id_docente, id_institucion FROM curso WHERE id_curso = $1;';
        const checkRes = await query(checkSql, [id_curso]);

        if (checkRes.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Curso no encontrado.' });
        }

        const curso = checkRes.rows[0];
        if (lenguaje !== undefined) {
            const current = await query('SELECT lenguaje FROM curso WHERE id_curso = $1;', [id_curso]);
            if (current.rows[0].lenguaje !== lenguaje) {
                const content = await query(
                    `SELECT (SELECT count(*) FROM ejercicio WHERE id_curso = $1) AS ejercicios,
                            (SELECT count(*) FROM envio_ejercicio WHERE id_curso = $1) AS envios;`, [id_curso]
                );
                if (Number(content.rows[0].ejercicios) > 0 || Number(content.rows[0].envios) > 0) {
                    return res.status(409).json({
                        success: false, error: 'LANGUAGE_LOCKED',
                        message: 'El lenguaje ya no se puede cambiar: el curso tiene ejercicios o entregas.'
                    });
                }
            }
        }
        if (user.rol === 'docente' && curso.id_docente !== user.id_usuario) {
            return res.status(403).json({
                success: false,
                message: 'Sólo el docente asignado o el administrador puede modificar este curso.'
            });
        }

        const updateSql = `
            UPDATE curso
            SET nombre = COALESCE($1, nombre),
                codigo_curso = COALESCE($2, codigo_curso),
                periodo = COALESCE($3, periodo),
                estado = COALESCE($4, estado),
                lenguaje = COALESCE($6, lenguaje),
                union_por_codigo = COALESCE($7, union_por_codigo)
            WHERE id_curso = $5
            RETURNING id_curso, nombre, codigo_curso, periodo, estado, lenguaje, union_por_codigo;
        `;
        const updatedRes = await query(updateSql, [
            nombre ? nombre.trim() : null,
            codigo_curso ? codigo_curso.trim().toUpperCase() : null,
            periodo ? periodo.trim() : null,
            estado ? estado.trim() : null,
            id_curso,
            lenguaje === undefined ? null : lenguaje,
            unionPorCodigo
        ]);

        return res.json({
            success: true,
            message: 'Curso actualizado correctamente.',
            data: updatedRes.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listado de estudiantes matriculados en un curso
 * GET /api/cursos/:id_curso/matriculados
 */
const getMatriculados = async (req, res, next) => {
    try {
        const { id_curso } = req.params;
        await getAuthorizedCourse(id_curso, req.user, { write: true });

        const sql = `
            SELECT m.id_matricula, m.id_estudiante, m.fecha_matricula, m.estado,
                   u.nombre, u.apellido, u.email,
                   COALESCE((
                       SELECT SUM(cantidad)::INTEGER FROM xp_movimiento xm
                       WHERE xm.id_estudiante = u.id_usuario AND xm.id_curso = m.id_curso
                   ), 0) AS xp_en_curso,
                   (
                       SELECT count(*)::INTEGER FROM progreso_mundo pm
                       WHERE pm.id_matricula = m.id_matricula AND pm.estado = 'completado'
                   ) AS mundos_completados
            FROM matricula m
            JOIN usuario u ON u.id_usuario = m.id_estudiante
            WHERE m.id_curso = $1
            ORDER BY u.apellido ASC, u.nombre ASC;
        `;
        const result = await query(sql, [id_curso]);

        return res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Matricular a un estudiante individual
 * POST /api/cursos/:id_curso/matricular
 */
const matricularEstudiante = async (req, res, next) => {
    const client = await getClient();
    try {
        const { id_curso } = req.params;
        const { email, id_estudiante } = req.body;
        const course = await getAuthorizedCourse(id_curso, req.user, { write: true });

        if (!email && !id_estudiante) {
            return res.status(400).json({
                success: false,
                message: 'Debe proporcionar el email o id_estudiante del alumno a matricular.'
            });
        }

        // Obtener estudiante
        let userRes;
        if (id_estudiante) {
            userRes = await client.query('SELECT id_usuario, id_institucion, email, rol, estado FROM usuario WHERE id_usuario = $1;', [id_estudiante]);
        } else {
            userRes = await client.query('SELECT id_usuario, id_institucion, email, rol, estado FROM usuario WHERE lower(email) = lower($1);', [email.trim()]);
        }

        if (userRes.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontró ningún usuario con los datos proporcionados.'
            });
        }

        const estudiante = userRes.rows[0];
        if (estudiante.rol !== 'estudiante') {
            return res.status(400).json({
                success: false,
                message: 'El usuario seleccionado no tiene el rol de estudiante.'
            });
        }
        if (estudiante.estado !== 'activo' || estudiante.id_institucion !== course.id_institucion) {
            return res.status(400).json({
                success: false,
                message: 'El estudiante debe estar activo y pertenecer a la institución del curso.'
            });
        }

        await client.query('BEGIN');

        // Insertar matrícula
        const insertMatSql = `
            INSERT INTO matricula (id_curso, id_estudiante, estado)
            VALUES ($1, $2, 'activa')
            ON CONFLICT (id_curso, id_estudiante)
            DO UPDATE SET estado = 'activa'
            RETURNING id_matricula, id_curso, id_estudiante, estado, fecha_matricula;
        `;
        const matRes = await client.query(insertMatSql, [id_curso, estudiante.id_usuario]);
        const matricula = matRes.rows[0];

        // Inicializar progreso en los mundos del curso para esta matrícula
        // El Mundo 1 se inicia en 'en_progreso', los demás en 'bloqueado'
        const mundosSql = 'SELECT id_mundo, orden FROM mundo WHERE id_curso = $1 ORDER BY orden ASC;';
        const mundosRes = await client.query(mundosSql, [id_curso]);

        for (const m of mundosRes.rows) {
            const estadoInicial = m.orden === 1 ? 'en_progreso' : 'bloqueado';
            const fechaInicio = m.orden === 1 ? 'now()' : 'NULL';
            await client.query(`
                INSERT INTO progreso_mundo (id_matricula, id_mundo, id_curso, estado, fecha_inicio)
                VALUES ($1, $2, $3, $4, ${fechaInicio})
                ON CONFLICT (id_matricula, id_mundo) DO NOTHING;
            `, [matricula.id_matricula, m.id_mundo, id_curso, estadoInicial]);
        }

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: 'Estudiante matriculado con éxito en el curso.',
            data: matricula
        });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

/**
 * El estudiante se une a un curso con su código. Solo cursos activos de SU institución; el docente puede cerrar
 * esta vía (union_por_codigo). Un estudiante retirado por el docente no puede volver a entrar por código.
 * POST /api/cursos/unirse   { codigo, periodo? }
 */
const unirsePorCodigo = async (req, res, next) => {
    const client = await getClient();
    try {
        const user = req.user;
        const code = typeof req.body?.codigo === 'string' ? req.body.codigo.trim().toUpperCase() : '';
        if (!isValidCourseCode(code)) {
            throw httpError(400, 'El código del curso no tiene un formato válido.', 'INVALID_COURSE_CODE');
        }
        if (!user.id_institucion) throw httpError(403, 'Tu cuenta no pertenece a una institución.', 'NO_INSTITUTION');

        // Mensaje único si no hay coincidencia: no se revela si el código existe en otra institución.
        const notFound = () => httpError(404, 'No encontramos un curso activo con ese código en tu institución.', 'COURSE_CODE_NOT_FOUND');
        const found = await query(
            `SELECT c.id_curso, c.nombre, c.periodo, c.id_docente, c.union_por_codigo
               FROM curso c
              WHERE upper(c.codigo_curso) = $1 AND c.id_institucion = $2 AND c.estado = 'activo'
              ORDER BY c.periodo DESC;`,
            [code, user.id_institucion]
        );
        let candidates = found.rows;
        const period = typeof req.body?.periodo === 'string' ? req.body.periodo.trim() : '';
        if (period) candidates = candidates.filter((course) => course.periodo === period);
        if (candidates.length === 0) throw notFound();
        if (candidates.length > 1) {
            return res.status(409).json({
                success: false, error: 'AMBIGUOUS_COURSE_CODE',
                message: 'Ese código existe en más de un periodo. Indica el periodo.',
                periodos: candidates.map((course) => course.periodo)
            });
        }
        const course = candidates[0];
        if (!course.union_por_codigo) {
            throw httpError(403, 'El docente cerró la unión por código en este curso. Pídele que te matricule.', 'JOIN_BY_CODE_DISABLED');
        }

        await client.query('BEGIN');
        const existing = await client.query('SELECT id_matricula, estado FROM matricula WHERE id_curso = $1 AND id_estudiante = $2 FOR UPDATE;', [course.id_curso, user.id_usuario]);
        if (existing.rowCount > 0 && existing.rows[0].estado === 'retirada') {
            throw httpError(403, 'Tu docente te retiró de este curso. Pídele que te matricule de nuevo.', 'WITHDRAWN_BY_TEACHER');
        }
        let joined = false;
        let enrollmentId = existing.rows[0]?.id_matricula;
        if (existing.rowCount === 0) {
            const inserted = await client.query(
                `INSERT INTO matricula (id_curso, id_estudiante, estado) VALUES ($1, $2, 'activa') RETURNING id_matricula;`,
                [course.id_curso, user.id_usuario]
            );
            enrollmentId = inserted.rows[0].id_matricula;
            joined = true;
            const worlds = await client.query('SELECT id_mundo, orden FROM mundo WHERE id_curso = $1 ORDER BY orden ASC;', [course.id_curso]);
            for (const world of worlds.rows) {
                await client.query(
                    `INSERT INTO progreso_mundo (id_matricula, id_mundo, id_curso, estado, fecha_inicio)
                     VALUES ($1, $2, $3, $4, ${world.orden === 1 ? 'now()' : 'NULL'}) ON CONFLICT (id_matricula, id_mundo) DO NOTHING;`,
                    [enrollmentId, world.id_mundo, course.id_curso, world.orden === 1 ? 'en_progreso' : 'bloqueado']
                );
            }
            await recordSecurityEvent(client, {
                actorId: user.id_usuario, institutionId: user.id_institucion, action: 'MATRICULA_POR_CODIGO',
                targetType: 'curso', targetId: course.id_curso, result: 'exitoso', ip: getRequestIp(req), metadata: { codigo: code }
            });
            await notify(client, {
                idUsuario: course.id_docente, tipo: 'matricula', titulo: 'Nuevo estudiante',
                mensaje: `${user.nombre} ${user.apellido} se unió a ${course.nombre} con el código.`, enlace: `#/cursos/${course.id_curso}`
            });
        }
        await client.query('COMMIT');
        return res.status(joined ? 201 : 200).json({
            success: true,
            message: joined ? `Te uniste a ${course.nombre}.` : `Ya estabas en ${course.nombre}.`,
            data: { id_curso: course.id_curso, nombre: course.nombre, periodo: course.periodo, nuevo: joined }
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        return next(error);
    } finally {
        client.release();
    }
};

/**
 * Matrícula masiva de estudiantes mediante CSV (archivo o texto en formato CSV)
 * Formato esperado en el CSV: nombre,apellido,email
 * POST /api/cursos/:id_curso/matricular-csv
 */
const matricularCsvMasivo = async (req, res, next) => {
    const client = await getClient();
    try {
        const { id_curso } = req.params;
        const user = req.user;

        const curso = await getAuthorizedCourse(id_curso, user, { write: true });

        // Obtener contenido CSV (desde req.file con multer o desde body.csvText)
        let csvContent = '';
        if (req.file) {
            csvContent = req.file.buffer.toString('utf-8');
        } else if (req.body.csvText) {
            csvContent = req.body.csvText;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Debe adjuntar un archivo CSV (multipart/form-data) o enviar el campo "csvText" con los registros.'
            });
        }

        const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length === 0) {
            return res.status(400).json({ success: false, message: 'El archivo CSV está vacío.' });
        }
        if (lines.length > 1001) {
            return res.status(400).json({
                success: false,
                message: 'El CSV no puede contener más de 1000 estudiantes por carga.'
            });
        }

        // Mundos del curso
        const mundosRes = await client.query('SELECT id_mundo, orden FROM mundo WHERE id_curso = $1 ORDER BY orden ASC;', [id_curso]);
        const mundos = mundosRes.rows;

        let matriculadosExistentes = 0;
        let errores = [];

        await client.query('BEGIN');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Ignorar encabezados si contienen "email" o "correo"
            if (i === 0 && (line.toLowerCase().includes('email') || line.toLowerCase().includes('correo'))) {
                continue;
            }

            const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
            if (parts.length < 3) {
                errores.push(`Línea ${i + 1}: Formato inválido. Se requiere: nombre, apellido, email.`);
                continue;
            }

            const emailClean = normalizeEmail(parts[2]);

            if (!emailClean) {
                errores.push(`Línea ${i + 1}: Email inválido.`);
                continue;
            }

            try {
                // Verificar si el usuario ya existe
                let userSelect = await client.query(
                    'SELECT id_usuario, id_institucion, rol, estado FROM usuario WHERE lower(email) = lower($1);',
                    [emailClean]
                );
                let estudianteId;

                if (userSelect.rowCount === 0) {
                    errores.push(`Línea ${i + 1}: El estudiante debe registrarse antes de ser matriculado.`);
                    continue;
                }

                const existing = userSelect.rows[0];
                if (existing.rol !== 'estudiante' || existing.estado !== 'activo' ||
                    existing.id_institucion !== curso.id_institucion) {
                    errores.push(`Línea ${i + 1}: La cuenta no es un estudiante activo de esta institución.`);
                    continue;
                }
                estudianteId = existing.id_usuario;

                // Insertar matrícula
                const insertMatSql = `
                    INSERT INTO matricula (id_curso, id_estudiante, estado)
                    VALUES ($1, $2, 'activa')
                    ON CONFLICT (id_curso, id_estudiante)
                    DO UPDATE SET estado = 'activa'
                    RETURNING id_matricula;
                `;
                const matRes = await client.query(insertMatSql, [id_curso, estudianteId]);
                const matriculaId = matRes.rows[0].id_matricula;

                // Inicializar progreso_mundo
                for (const m of mundos) {
                    const estado = m.orden === 1 ? 'en_progreso' : 'bloqueado';
                    const fechaInicio = m.orden === 1 ? 'now()' : 'NULL';
                    await client.query(`
                        INSERT INTO progreso_mundo (id_matricula, id_mundo, id_curso, estado, fecha_inicio)
                        VALUES ($1, $2, $3, $4, ${fechaInicio})
                        ON CONFLICT (id_matricula, id_mundo) DO NOTHING;
                    `, [matriculaId, m.id_mundo, id_curso, estado]);
                }

                matriculadosExistentes++;
            } catch (lineErr) {
                errores.push(`Línea ${i + 1} (${emailClean}): ${lineErr.message}`);
            }
        }

        await client.query('COMMIT');

        return res.json({
            success: true,
            message: 'Procesamiento de archivo CSV de matrículas completado.',
            resumen: {
                total_lineas_procesadas: lines.length,
                total_matriculas_activadas: matriculadosExistentes,
                errores
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

module.exports = {
    unirsePorCodigo,
    getCursos,
    getCursoById,
    createCurso,
    updateCurso,
    getMatriculados,
    getCodigoSugerido,
    matricularEstudiante,
    matricularCsvMasivo
};

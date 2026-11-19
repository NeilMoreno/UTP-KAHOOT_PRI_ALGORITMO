// ==============================================================
// codeInt - Rutas de Cursos y Matrículas (/api/cursos)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const cursoController = require('../controllers/cursoController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { uploadLimiter, joinLimiter } = require('../config/security');

// Configuración de multer en memoria para carga de CSV (máximo 5MB)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 },
    fileFilter: (req, file, callback) => {
        const validMime = ['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(file.mimetype);
        const validName = file.originalname.toLowerCase().endsWith('.csv');
        if (validMime && validName) return callback(null, true);
        const error = new Error('Sólo se permiten archivos CSV.');
        error.status = 400;
        error.code = 'INVALID_FILE_TYPE';
        callback(error, false);
    }
});

// El estudiante se une con el código del curso (misma institución; con límite de intentos por usuario)
router.post('/unirse', authenticateJWT, authorizeRoles('estudiante'), joinLimiter, cursoController.unirsePorCodigo);

// Listado de cursos del usuario (estudiante ve sus cursos matriculados, docente ve los suyos)
router.get('/', authenticateJWT, cursoController.getCursos);

// Código de curso sugerido desde el nombre (debe ir antes de /:id_curso)
router.get('/codigo-sugerido', authenticateJWT, authorizeRoles('docente', 'superadministrador'), cursoController.getCodigoSugerido);

// Detalle de un curso
router.get('/:id_curso', authenticateJWT, cursoController.getCursoById);

// Creación de cursos (Solo docentes y superadministradores)
router.post('/', authenticateJWT, authorizeRoles('docente', 'superadministrador'), cursoController.createCurso);

// Actualización de cursos (Solo docentes y superadministradores)
router.put('/:id_curso', authenticateJWT, authorizeRoles('docente', 'superadministrador'), cursoController.updateCurso);

// Listado de estudiantes matriculados en el curso
router.get('/:id_curso/matriculados', authenticateJWT, authorizeRoles('docente', 'superadministrador'), cursoController.getMatriculados);

// Matrícula individual de estudiante
router.post('/:id_curso/matricular', authenticateJWT, authorizeRoles('docente', 'superadministrador'), cursoController.matricularEstudiante);

// Matrícula masiva mediante archivo CSV o texto CSV
router.post('/:id_curso/matricular-csv',
    authenticateJWT,
    authorizeRoles('docente', 'superadministrador'),
    uploadLimiter,
    upload.single('file'),
    cursoController.matricularCsvMasivo
);

module.exports = router;

// ==============================================================
// codeInt - Sílabo, borrador generado por IA y publicación (/api/cursos/:id_curso/silabo)
// ==============================================================

const express = require('express');
const multer = require('multer');
const silaboController = require('../controllers/silaboController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { uploadLimiter, aiGenerationLimiter } = require('../config/security');
const { httpError } = require('../utils/httpError');

const router = express.Router({ mergeParams: true });
const teacherOnly = [authenticateJWT, authorizeRoles('docente', 'superadministrador')];

// PDF en memoria (máx. 10 MB). La firma real del archivo se comprueba en el controlador.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 3 },
    fileFilter: (req, file, callback) => {
        const validName = String(file.originalname || '').toLowerCase().endsWith('.pdf');
        if (file.mimetype === 'application/pdf' && validName) return callback(null, true);
        return callback(httpError(400, 'Solo se permiten archivos PDF.', 'INVALID_FILE_TYPE'), false);
    }
});

const receivePdf = (req, res, next) => upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return next(httpError(413, 'El PDF no puede superar los 10 MB.', 'FILE_TOO_LARGE'));
    if (error.code === 'LIMIT_UNEXPECTED_FILE' || error.code === 'LIMIT_FILE_COUNT') return next(httpError(400, 'Adjunta un solo archivo PDF.', 'INVALID_FILE'));
    return next(error);
});

router.get('/', ...teacherOnly, silaboController.getEstado);
router.post('/', ...teacherOnly, uploadLimiter, receivePdf, silaboController.subirSilabo);
router.get('/borrador', ...teacherOnly, silaboController.getBorrador);
router.put('/borrador', ...teacherOnly, silaboController.actualizarBorrador);
router.post('/borrador/publicar', ...teacherOnly, silaboController.publicarBorrador);
router.post('/borrador/lecciones', ...teacherOnly, aiGenerationLimiter, silaboController.generarLecciones);
router.post('/:id_silabo/generar', ...teacherOnly, aiGenerationLimiter, silaboController.generarBorrador);

module.exports = router;

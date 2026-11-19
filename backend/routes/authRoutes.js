// ==============================================================
// codeInt - Rutas de Autenticación (/api/auth)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const identityController = require('../controllers/identityController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { authLimiter } = require('../config/security');

// Registro de usuario nuevo
router.post('/register', authLimiter, identityController.registerByInvitation);

// Inicio de sesión
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refreshSession);
router.post('/logout', authController.logout);
router.post('/invitation/inspect', authLimiter, identityController.inspectInvitation);
router.post('/password/forgot', authLimiter, identityController.requestPasswordReset);
router.post('/password/reset', authLimiter, identityController.resetPassword);

// Consulta de perfil del usuario logueado (incluye gamificación si es estudiante)
router.get('/me', authenticateJWT, authController.getMe);
router.patch('/me', authenticateJWT, authController.updateMe);
router.patch('/me/avatar', authenticateJWT, authController.updateAvatar);
router.patch('/me/nacimiento', authenticateJWT, authController.completeBirthDate);
router.post('/me/terminos', authenticateJWT, authController.acceptTerms);
router.patch('/password', authenticateJWT, authLimiter, identityController.changePassword);
router.post('/logout-all', authenticateJWT, identityController.logoutAll);

// Listado de instituciones activas
router.get('/instituciones', authController.getInstituciones);

// Listado administrativo de usuarios e instituciones
router.get('/usuarios',
    authenticateJWT,
    authorizeRoles('superadministrador'),
    authController.getUsuarios
);
router.get('/admin/instituciones',
    authenticateJWT,
    authorizeRoles('superadministrador'),
    authController.getAdminInstituciones
);

router.get('/docentes/pendientes',
    authenticateJWT,
    authorizeRoles('superadministrador'),
    authController.getPendingTeachers
);

router.patch('/usuarios/:id_usuario/estado',
    authenticateJWT,
    authorizeRoles('superadministrador'),
    authController.updateUserStatus
);

router.post('/admin/invitations',
    authenticateJWT,
    authorizeRoles('superadministrador'),
    authLimiter,
    identityController.createInvitation
);
router.get('/admin/invitations',
    authenticateJWT,
    authorizeRoles('superadministrador'),
    identityController.listInvitations
);
router.patch('/admin/invitations/:id_invitacion/revoke',
    authenticateJWT,
    authorizeRoles('superadministrador'),
    identityController.revokeInvitation
);
router.post('/admin/instituciones',
    authenticateJWT,
    authorizeRoles('superadministrador'),
    authController.createInstitucion
);
router.put('/admin/instituciones/:id_institucion',
    authenticateJWT,
    authorizeRoles('superadministrador'),
    authController.updateInstitucion
);
router.patch('/admin/instituciones/:id_institucion/estado',
    authenticateJWT,
    authorizeRoles('superadministrador'),
    authController.updateInstitucionStatus
);
router.post('/admin/instituciones/:id_institucion/dominios',
    authenticateJWT,
    authorizeRoles('superadministrador'),
    identityController.createInstitutionDomain
);
router.get('/admin/instituciones/:id_institucion/dominios',
    authenticateJWT,
    authorizeRoles('superadministrador'),
    identityController.listInstitutionDomains
);
router.patch('/admin/dominios/:id_dominio/estado',
    authenticateJWT,
    authorizeRoles('superadministrador'),
    identityController.updateInstitutionDomainStatus
);

module.exports = router;

// ==============================================================
// codeInt - Middleware de Control de Acceso Basado en Roles (RBAC)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

/**
 * Verifica si el usuario autenticado tiene al menos uno de los roles autorizados
 * @param  {...string} allowedRoles - Lista de roles permitidos ('estudiante', 'docente', 'superadministrador')
 */
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'No autenticado. Inicie sesión para continuar.'
            });
        }

        const userRole = req.user.rol;

        // Superadministrador tiene acceso universal
        if (userRole === 'superadministrador') {
            return next();
        }

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: `Acceso denegado: El rol '${userRole}' no cuenta con permisos suficientes para este recurso.`
            });
        }

        next();
    };
};

/**
 * Valida el aislamiento multi-institucional (Multi-tenant SaaS)
 * Garantiza que usuarios no superadmin solo operen en su propia institución
 */
const enforceInstitutionIsolation = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'No autenticado.' });
    }

    if (req.user.rol === 'superadministrador') {
        return next();
    }

    if (!req.user.id_institucion) {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado: El usuario no está asignado a ninguna institución educativa.'
        });
    }

    // Parámetro o cuerpo de la solicitud que especifique id_institucion
    const targetInstitucion = req.params.id_institucion || req.body.id_institucion || req.query.id_institucion;
    if (targetInstitucion && targetInstitucion !== req.user.id_institucion) {
        return res.status(403).json({
            success: false,
            message: 'Violación de aislamiento multi-tenant: No puede acceder a datos de otra institución.'
        });
    }

    next();
};

module.exports = {
    authorizeRoles,
    enforceInstitutionIsolation
};

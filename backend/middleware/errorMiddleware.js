// ==============================================================
// codeInt - Middleware Centralizado de Manejo de Errores y 404
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

/**
 * Middleware para rutas no encontradas (404)
 */
const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Ruta no encontrada en el API de codeInt: [${req.method}] ${req.originalUrl}`
    });
};

/**
 * Middleware centralizado de gestión de excepciones y errores
 */
const errorHandler = (err, req, res, next) => {
    console.error(`💥 [Error Global - ${req.method} ${req.url}]:`, {
        name: err.name,
        code: err.code,
        message: err.message
    });

    // Errores específicos de PostgreSQL (códigos SQLSTATE)
    if (err.code) {
        switch (err.code) {
            case '23505': // unique_violation
                return res.status(409).json({
                    success: false,
                    error: 'Conflicto de datos',
                    message: 'El registro o valor ingresado ya existe.'
                });
            case '23503': // foreign_key_violation
                return res.status(400).json({
                    success: false,
                    error: 'Relación no válida',
                    message: 'La entidad relacionada especificada no existe.'
                });
            case '23514': // check_violation
                return res.status(400).json({
                    success: false,
                    error: 'Dato no válido',
                    message: 'Uno de los campos no cumple con las reglas permitidas.'
                });
            case '22P02': // invalid_text_representation (e.g. UUID mal formado)
                return res.status(400).json({
                    success: false,
                    error: 'Formato de dato no válido',
                    message: 'Uno de los identificadores UUID o tipos de datos enviados no tiene el formato correcto.'
                });
            default:
                break;
        }
    }

    // Errores de Multer (carga de archivos)
    if (err.name === 'MulterError') {
        return res.status(400).json({
            success: false,
            error: 'Error en la subida de archivos',
            message: err.message
        });
    }

    // Error por defecto 500
    const statusCode = err.status || err.statusCode || 500;
    const isServerError = statusCode >= 500;
    res.status(statusCode).json({
        success: false,
        error: isServerError ? 'InternalServerError' : (err.code || err.name || 'RequestError'),
        message: isServerError && process.env.NODE_ENV === 'production'
            ? 'Ocurrió un error inesperado en el servidor de codeInt.'
            : (err.message || 'Ocurrió un error inesperado en el servidor de codeInt.')
    });
};

module.exports = {
    notFoundHandler,
    errorHandler
};

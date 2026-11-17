// ==============================================================
// codeInt - Script de Pruebas Automatizadas de la Fase 2
// Validación exhaustiva de API RESTful, RBAC y Base de Datos
// ==============================================================

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const reqOptions = {
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        if (options.body) {
            if (typeof options.body === 'object') {
                reqOptions.headers['Content-Type'] = 'application/json';
            }
        }

        const req = http.request(url, reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', reject);

        if (options.body) {
            const bodyStr = typeof options.body === 'object' ? JSON.stringify(options.body) : options.body;
            req.write(bodyStr);
        }
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Iniciando batería de pruebas de Fase 2 (Backend Core de codeInt)...\n');
    let passed = 0;
    let failed = 0;

    function assert(cond, name, details = '') {
        if (cond) {
            console.log(`  ✅ [PASS] ${name}`);
            passed++;
        } else {
            console.error(`  ❌ [FAIL] ${name} ${details ? '- ' + JSON.stringify(details) : ''}`);
            failed++;
        }
    }

    try {
        // 1. Healthcheck
        const health = await request('/api/health');
        assert(health.status === 200 && health.data.status === 'UP', 'Health Check endpoint (/api/health)');

        // 2. Instituciones
        const inst = await request('/api/auth/instituciones');
        assert(inst.status === 200 && inst.data.data.length > 0, 'Listar instituciones activas (/api/auth/instituciones)', inst.data);

        // 3. Login Docente Demo
        const loginDocente = await request('/api/auth/login', {
            method: 'POST',
            body: { email: 'docente.demo@utp.edu.pe', password: 'codeint123' }
        });
        assert(loginDocente.status === 200 && loginDocente.data.token, 'Login Docente Demo (/api/auth/login)');
        const tokenDocente = loginDocente.data.token;

        // 4. Login Estudiante Demo
        const loginEstudiante = await request('/api/auth/login', {
            method: 'POST',
            body: { email: 'estudiante.demo@utp.edu.pe', password: 'codeint123' }
        });
        assert(loginEstudiante.status === 200 && loginEstudiante.data.user.gamification !== undefined, 'Login Estudiante con Gamificación dinámica');
        const tokenEstudiante = loginEstudiante.data.token;

        // 5. Perfil de Usuario (/api/auth/me) con JWT
        const meEstudiante = await request('/api/auth/me', {
            headers: { Authorization: `Bearer ${tokenEstudiante}` }
        });
        assert(meEstudiante.status === 200 && meEstudiante.data.user.rol === 'estudiante', 'Verificar token JWT y perfil (/api/auth/me)');

        // 6. Registro de nuevo estudiante
        const randomEmail = `alumno_${Date.now()}@utp.edu.pe`;
        const registerRes = await request('/api/auth/register', {
            method: 'POST',
            body: {
                nombre: 'Carlos',
                apellido: 'García',
                email: randomEmail,
                password: 'PasswordSeguro123',
                rol: 'estudiante',
                genero: 'masculino',
                codigo_licencia: 'UTP-2026-DEMO-001'
            }
        });
        assert(registerRes.status === 201 && registerRes.data.token, 'Registro de nuevo estudiante (/api/auth/register)');

        // 7. Cursos del Docente
        const cursosDocente = await request('/api/cursos', {
            headers: { Authorization: `Bearer ${tokenDocente}` }
        });
        assert(cursosDocente.status === 200 && cursosDocente.data.data.length > 0, 'Consultar cursos del docente (/api/cursos)');
        const demoCursoId = cursosDocente.data.data[0].id_curso;

        // 8. Cursos del Estudiante matriculado
        const cursosEstudiante = await request('/api/cursos', {
            headers: { Authorization: `Bearer ${tokenEstudiante}` }
        });
        assert(cursosEstudiante.status === 200 && cursosEstudiante.data.data.length > 0, 'Consultar cursos del estudiante matriculado');

        // 9. Detalle del curso
        const cursoDetalle = await request(`/api/cursos/${demoCursoId}`, {
            headers: { Authorization: `Bearer ${tokenDocente}` }
        });
        assert(cursoDetalle.status === 200 && cursoDetalle.data.data.mundos.length === 7, 'Detalle de curso con sus 7 mundos base');

        // 10. Listado de Estudiantes Matriculados
        const matriculados = await request(`/api/cursos/${demoCursoId}/matriculados`, {
            headers: { Authorization: `Bearer ${tokenDocente}` }
        });
        assert(matriculados.status === 200 && matriculados.data.data.length > 0, 'Listar alumnos matriculados en el curso');

        // 11. Desbloqueo dinámico de mundos para el estudiante
        const mundosEstudiante = await request(`/api/mundos/curso/${demoCursoId}`, {
            headers: { Authorization: `Bearer ${tokenEstudiante}` }
        });
        assert(
            mundosEstudiante.status === 200 &&
            mundosEstudiante.data.data[0].desbloqueado === true &&
            mundosEstudiante.data.data[1].desbloqueado === false,
            'Cálculo dinámico de desbloqueo de mundos (Mundo 1 activo, Mundo 2 bloqueado según regla 3)'
        );
        const mundo1Id = mundosEstudiante.data.data[0].id_mundo;
        const mundo2Id = mundosEstudiante.data.data[1].id_mundo;

        // 12. Ejercicios del Mundo 1 (Desbloqueado)
        const ejerciciosMundo1 = await request(`/api/ejercicios/mundo/${mundo1Id}`, {
            headers: { Authorization: `Bearer ${tokenEstudiante}` }
        });
        assert(ejerciciosMundo1.status === 200 && ejerciciosMundo1.data.data.length === 3, 'Acceder a ejercicios del Mundo 1 desbloqueado');
        const ej1Id = ejerciciosMundo1.data.data[0].id_ejercicio;

        // 13. Intentar acceder a ejercicios del Mundo 2 (Bloqueado) como estudiante
        const ejerciciosMundo2 = await request(`/api/ejercicios/mundo/${mundo2Id}`, {
            headers: { Authorization: `Bearer ${tokenEstudiante}` }
        });
        assert(ejerciciosMundo2.status === 403 && ejerciciosMundo2.data.bloqueado === true, 'Protección de mundo bloqueado (403 Forbidden)');

        // 14. Detalle de ejercicio y plantilla PSeInt
        const ejDetalle = await request(`/api/ejercicios/${ej1Id}`, {
            headers: { Authorization: `Bearer ${tokenEstudiante}` }
        });
        assert(ejDetalle.status === 200 && ejDetalle.data.data.plantilla_pseint.includes('Algoritmo'), 'Plantilla PSeInt en detalle de ejercicio');

        // 15. Crear nuevo curso con auto-generación de 7 mundos
        const nuevoCursoRes = await request('/api/cursos', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenDocente}` },
            body: {
                nombre: 'Estructuras de Datos II',
                codigo_curso: `ED2-${Date.now().toString().slice(-4)}`,
                periodo: '2026-I'
            }
        });
        assert(nuevoCursoRes.status === 201, 'Crear nuevo curso con auto-inicialización de 7 mundos');
        const nuevoCursoId = nuevoCursoRes.data.data.id_curso;

        // 16. Matrícula individual en el nuevo curso
        const matricularRes = await request(`/api/cursos/${nuevoCursoId}/matricular`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenDocente}` },
            body: { email: 'estudiante.demo@utp.edu.pe' }
        });
        assert(matricularRes.status === 201, 'Matricular estudiante individual e inicializar progreso_mundo');

        // 17. Matrícula masiva vía CSV (texto)
        const csvDemo = `nombre,apellido,email
Carlos,García,${randomEmail}`;
        const csvRes = await request(`/api/cursos/${nuevoCursoId}/matricular-csv`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenDocente}` },
            body: { csvText: csvDemo }
        });
        assert(
            csvRes.status === 200 &&
            csvRes.data.resumen.total_matriculas_activadas === 1,
            'Matrícula masiva de estudiantes mediante CSV (/api/cursos/:id/matricular-csv)'
        );

        // 18. Validación de control RBAC: Estudiante no puede crear cursos
        const forbiddenCurso = await request('/api/cursos', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenEstudiante}` },
            body: {
                nombre: 'Curso Ilegal',
                codigo_curso: 'ILLEGAL-01',
                periodo: '2026-I'
            }
        });
        assert(forbiddenCurso.status === 403, 'Control RBAC: Estudiante denegado para crear cursos (403)');

        console.log(`\n==============================================================`);
        console.log(`🏁 Resultados de Pruebas: ${passed} exitosas, ${failed} fallidas.`);
        console.log(`==============================================================\n`);

        process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
        console.error('💥 Error inesperado durante la ejecución de las pruebas:', err);
        process.exit(1);
    }
}

// Iniciar servidor express temporalmente para correr las pruebas
const { server } = require('./backend/server');
const PORT = 3000;

server.listen(PORT, async () => {
    console.log(`Servidor de prueba iniciado en puerto ${PORT}`);
    await runTests();
});

import { h } from '../ui.js';
import { TERMS_VERSION } from '../age.js';

// TEXTO DE EJEMPLO para el entorno de pruebas con datos ficticios: la institución que use codeInt en
// producción debe revisarlo y adaptarlo con quien corresponda. La versión debe coincidir con la del servidor.
const SECTIONS = [
    {
        title: '1. Qué datos recogemos',
        items: [
            'Datos de cuenta: nombre, apellido, correo institucional, género y contraseña (guardada de forma cifrada).',
            'Fecha de nacimiento: la usamos para calcular tu edad y para estadísticas agregadas; nunca se muestra a otros estudiantes.',
            'Actividad académica: ejercicios enviados, puntajes, XP, logros, racha, misiones y partidas en salas.',
            'Código que envías a evaluar: se procesa con un servicio de inteligencia artificial para darte retroalimentación.'
        ]
    },
    {
        title: '2. Para qué los usamos',
        items: [
            'Darte acceso a tus cursos, evaluar tus ejercicios y mostrar tu progreso.',
            'Que tu docente vea el avance de su curso y apoye a quien lo necesite.',
            'Estadísticas agregadas para la administración, por rangos de edad, sin identificar personas. Los grupos de menos de 5 personas no se publican.'
        ]
    },
    {
        title: '3. Quién puede ver tus datos',
        items: [
            'Tu docente ve tu actividad en sus cursos. Tus compañeros solo ven tu avatar, tu nombre con la inicial del apellido y tu XP en rankings y salas.',
            'La administración de la institución gestiona las cuentas y ve estadísticas agregadas.',
            'No vendemos tus datos ni los usamos para publicidad.'
        ]
    },
    {
        title: '4. Menores de edad',
        items: [
            'Si tienes menos de 18 años, tu madre, padre o tutor debe autorizar el uso de la plataforma; por eso te lo pedimos al registrarte.',
            'La edad mínima para registrarse es de 10 años.'
        ]
    },
    {
        title: '5. Tus derechos',
        items: [
            'Puedes pedir acceso, corrección o eliminación de tus datos a la administración de tu institución.',
            'Si cambias de opinión sobre estos términos, puedes pedir que cierren tu cuenta.'
        ]
    }
];

export default function termsView({ root }) {
    document.title = 'Términos y privacidad · codeInt';
    root.append(h('div', { class: 'legal-page' },
        h('a', { class: 'auth-back', href: '#/inicio' }, '← Volver al inicio'),
        h('h1', {}, 'Términos de uso y política de privacidad'),
        h('p', { class: 'muted' }, `Versión ${TERMS_VERSION}`),
        h('div', { class: 'alert info' }, 'Texto de ejemplo para el entorno de pruebas (datos ficticios). La institución debe revisarlo y adaptarlo antes de un uso real.'),
        SECTIONS.map((section) => h('section', { class: 'legal-section' },
            h('h2', {}, section.title),
            h('ul', {}, section.items.map((item) => h('li', {}, item)))))));
}

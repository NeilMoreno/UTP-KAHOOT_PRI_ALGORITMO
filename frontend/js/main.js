import { applyStoredTheme, loadSession, state } from './state.js';
import { startRouter, navigate } from './router.js';
import { clearChrome, renderChrome } from './layout.js';
import { toast } from './ui.js';

applyStoredTheme();

const header = document.getElementById('topbar');
const sidebar = document.getElementById('sidebar');
const shell = document.getElementById('app-shell');
const main = document.getElementById('main');
let lastPath = '/';

const paintTopbar = (path, isPublic) => {
    lastPath = path;
    shell.classList.toggle('is-public', isPublic);
    if (isPublic) clearChrome({ sidebar, topbar: header });
    else renderChrome({ sidebar, topbar: header, currentPath: path });
};

window.addEventListener('user:updated', () => renderChrome({ sidebar, topbar: header, currentPath: lastPath }));
window.addEventListener('auth:expired', () => {
    state.user = null;
    toast('Tu sesión expiró. Inicia sesión de nuevo.', 'error');
    navigate('/login');
});

await loadSession();
startRouter({ host: main, onRender: paintTopbar });

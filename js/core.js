/**
 * js/core.js
 * Núcleo: API con estrategia SWR (Stale-While-Revalidate).
 * Permite carga instantánea + actualización silenciosa.
 */

const Config = {
    URL_API_PRINCIPAL: "https://script.google.com/macros/s/AKfycbxfHHUGrAPAJGCGLnX4LPoqsE4OECHO4jYuWkprw2FJHsgNHaCfy9-YCEOZ-PsMMbFa/exec"
};

const CacheSystem = {
    KEY_ENABLED: 'arzuka_cache_enabled',
    isEnabled: () => localStorage.getItem(CacheSystem.KEY_ENABLED) === 'true',
    toggle: (estado) => {
        localStorage.setItem(CacheSystem.KEY_ENABLED, estado);
        if(!estado) CacheSystem.clear();
    },
    get: (key) => {
        if (!CacheSystem.isEnabled()) return null;
        const item = localStorage.getItem(key);
        if (!item) return null;
        try {
            const parsed = JSON.parse(item);
            // Si expiró, igual lo devolvemos para mostrar algo rápido (Stale), 
            // luego la red lo actualizará. Solo borramos si es muy viejo (ej. 24h)
            if (Date.now() - parsed.timestamp > 86400000) { 
                localStorage.removeItem(key);
                return null;
            }
            return parsed.data;
        } catch (e) { return null; }
    },
    set: (key, data) => {
        if (!CacheSystem.isEnabled()) return;
        const item = { data: data, timestamp: Date.now() };
        localStorage.setItem(key, JSON.stringify(item));
    },
    clear: () => {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('cache_')) localStorage.removeItem(key);
        });
    }
};

// =============================================================================
// 2. CONECTOR API INTELIGENTE (SWR)
// =============================================================================

/**
 * @param {string} servicio - Módulo
 * @param {string} accion - Función Backend
 * @param {Object} payload - Datos
 * @param {Function} onUpdateCallback - (Opcional) Función a ejecutar si el servidor trae datos nuevos
 */
async function callAPI(servicio, accion, payload = {}, onUpdateCallback = null) {
    // Indicador visual de carga en segundo plano (pequeño spinner en esquina)
    mostrarIndicadorCarga(true);
    console.log(`📡 [${servicio}] Solicitando: ${accion}`);

    const cacheKey = `cache_${accion}_${JSON.stringify(payload)}`;
    let cachedData = null;

    // 1. INTENTAR CACHÉ (Retorno Inmediato)
    if (CacheSystem.isEnabled()) {
        cachedData = CacheSystem.get(cacheKey);
    }

    // Promesa de Red
    const networkPromise = fetch(Config.URL_API_PRINCIPAL, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ accion: accion, payload: payload })
    })
    .then(res => res.json())
    .then(newData => {
        mostrarIndicadorCarga(false);
        
        // Si hubo error en servidor
        if (!newData.success) {
            console.warn(`⚠️ [${servicio}] Error Servidor:`, newData.error);
            // Si no teníamos caché, devolvemos el error. Si teníamos, nos quedamos con lo viejo.
            if (!cachedData) return newData;
            return null; // No propagar error si ya mostramos caché
        }

        // COMPARACIÓN DE DATOS (Deep Compare simple)
        const serverStr = JSON.stringify(newData);
        const cacheStr = JSON.stringify(cachedData);

        if (serverStr !== cacheStr) {
            console.log(`🔄 [${servicio}] Datos nuevos detectados. Actualizando UI...`);
            CacheSystem.set(cacheKey, newData);
            
            // Si existe callback y ya habíamos devuelto caché, ejecutamos el callback para refrescar
            if (cachedData && onUpdateCallback) {
                onUpdateCallback(newData);
            }
            return newData; // Para el caso donde no había caché
        } else {
            console.log(`✅ [${servicio}] Datos sincronizados (Sin cambios).`);
            return newData; // Retornamos igual
        }
    })
    .catch(err => {
        mostrarIndicadorCarga(false);
        console.error(`🔥 [${servicio}] Error Red:`, err);
        return { success: false, error: err.message };
    });

    // LÓGICA DE RETORNO
    if (cachedData) {
        console.log(`⚡ [${servicio}] Usando Caché (Validando en 2do plano...)`);
        // Disparamos la petición de red pero NO la esperamos (Fire & Forget controlada)
        // El .then de networkPromise manejará el onUpdateCallback si hay cambios
        return cachedData; 
    } else {
        // Si no hay caché, tenemos que esperar a la red sí o sí
        return await networkPromise;
    }
}

// =============================================================================
// 3. UTILIDADES UI
// =============================================================================

function mostrarIndicadorCarga(activo) {
    // Un pequeño punto o spinner en la barra superior para saber que trabaja
    let ind = document.getElementById('global-spinner');
    if (!ind) {
        ind = document.createElement('div');
        ind.id = 'global-spinner';
        ind.style = "position:fixed; top:10px; right:10px; z-index:9999; display:none;";
        ind.innerHTML = '<div class="spinner-border spinner-border-sm text-primary bg-white rounded-circle shadow-sm"></div>';
        document.body.appendChild(ind);
    }
    ind.style.display = activo ? 'block' : 'none';
}

async function verificarConexion() {
    const ind = document.getElementById('indicador-conexion');
    if(!ind) return;
    try {
        // Test conexión no usa caché
        const res = await callAPI('sistema', 'testConexion');
        if (res.success) {
            ind.innerHTML = '<i class="bi bi-circle-fill text-success"></i> Online';
            ind.title = res.mensaje;
        }
    } catch (e) { ind.innerHTML = '<i class="bi bi-wifi-off text-danger"></i> Offline'; }
}

// Navegación Dinámica (Igual que antes)
function cargarComponenteDinamico(idVista, rutaHtml, callbackLoad) {
    const existente = document.getElementById(idVista);
    if (existente) {
        activarVistaUI(idVista);
        if (callbackLoad) callbackLoad();
        return;
    }
    const mainArea = document.getElementById('main-area');
    const include = document.createElement('arzuka-include');
    include.setAttribute('src', rutaHtml);
    include.addEventListener('loaded', () => {
        activarVistaUI(idVista);
        if (callbackLoad) callbackLoad();
    });
    mainArea.appendChild(include);
}

function activarVistaUI(idVista) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#sidebar .list-group-item, #sidebar a').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(idVista);
    if(el) el.classList.add('active');
    toggleSidebar(false);
}

function toggleSidebar(state) {
    const sb = document.getElementById('sidebar');
    if(sb) {
        if(state === false) sb.classList.remove('active');
        else sb.classList.toggle('active');
    }
}

// Funciones Puente para Sidebar
function nav(vista) {
    activarVistaUI('view-' + vista);
    if(vista === 'ventas-arzuka' && typeof cargarVentasArzuka === 'function') cargarVentasArzuka();
}
function cargarVistaConfiguracion() {
    cargarComponenteDinamico('view-configuracion', 'components/vista-configuracion.html', () => {
        if(typeof cargarConfiguracion === 'function') cargarConfiguracion();
    });
}
function cargarVistaCRM() {
    cargarComponenteDinamico('view-crm', 'components/vista-crm.html', () => {
        if(typeof cargarCRM === 'function') cargarCRM();
    });
}
function cargarVistaClientes() {
    cargarComponenteDinamico('view-clientes', 'components/vista-clientes.html', () => {
        if(typeof inicializarModuloClientes === 'function') inicializarModuloClientes();
    });
}
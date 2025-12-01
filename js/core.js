/**
 * js/core.js
 * Núcleo de la aplicación: API, Caché y Navegación Dinámica.
 * VERSIÓN FINAL: Con soporte para carga de vistas (CRM y Configuración).
 */

// =============================================================================
// 1. CONFIGURACIÓN Y CACHÉ
// =============================================================================

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
        const parsed = JSON.parse(item);
        if (Date.now() > parsed.expiry) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed.value;
    },
    set: (key, value, ttlMinutes = 60) => {
        if (!CacheSystem.isEnabled()) return;
        const item = { value: value, expiry: Date.now() + (ttlMinutes * 60 * 1000) };
        localStorage.setItem(key, JSON.stringify(item));
    },
    clear: () => {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('cache_')) localStorage.removeItem(key);
        });
    }
};

// =============================================================================
// 2. CONECTOR API
// =============================================================================

async function callAPI(servicio, accion, payload = {}, options = {}) {
    console.log(`📡 [${servicio}] ${accion}...`);
    const cacheKey = `cache_${accion}_${JSON.stringify(payload)}`;
    
    if (options.useCache && CacheSystem.isEnabled()) {
        const cachedData = CacheSystem.get(cacheKey);
        if (cachedData) {
            console.log(`⚡ [${servicio}] Caché`);
            return cachedData;
        }
    }

    try {
        const respuesta = await fetch(Config.URL_API_PRINCIPAL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ accion: accion, payload: payload })
        });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const datos = await respuesta.json();
        if (datos.success && options.useCache) CacheSystem.set(cacheKey, datos, options.ttl || 60);
        return datos;
    } catch (error) {
        console.error(`🔥 [${servicio}] Fallo:`, error);
        return { success: false, error: error.message };
    }
}

// =============================================================================
// 3. NAVEGACIÓN Y CARGA DE VISTAS
// =============================================================================

async function verificarConexion() {
    const ind = document.getElementById('indicador-conexion');
    if(!ind) return;
    ind.innerHTML = '<span class="spinner-border spinner-border-sm text-warning"></span>';
    try {
        const res = await callAPI('sistema', 'testConexion');
        if (res.success) {
            ind.innerHTML = '<i class="bi bi-circle-fill text-success"></i> Online';
            ind.title = res.mensaje;
        } else ind.innerHTML = '<i class="bi bi-exclamation-circle-fill text-danger"></i> Error';
    } catch (e) { ind.innerHTML = '<i class="bi bi-wifi-off text-danger"></i> Offline'; }
}

// Navegación Genérica (Para Dashboard y Ventas)
function nav(vista) {
    activarVistaUI('view-' + vista);
    if(vista === 'ventas-arzuka' && typeof cargarVentasArzuka === 'function') {
        cargarVentasArzuka();
    }
}

// Navegación Dinámica: CONFIGURACIÓN
function cargarVistaConfiguracion() {
    cargarComponenteDinamico('view-configuracion', 'components/vista-configuracion.html', () => {
        if(typeof cargarConfiguracion === 'function') cargarConfiguracion();
    });
}

// Navegación Dinámica: CRM
function cargarVistaCRM() {
    cargarComponenteDinamico('view-crm', 'components/vista-crm.html', () => {
        if(typeof cargarCRM === 'function') cargarCRM();
    });
}

// --- FUNCIÓN MAESTRA DE CARGA ---
function cargarComponenteDinamico(idVista, rutaHtml, callbackLoad) {
    // 1. Si ya existe en el DOM, solo mostramos
    const existente = document.getElementById(idVista);
    if (existente) {
        activarVistaUI(idVista);
        if (callbackLoad) callbackLoad();
        return;
    }

    // 2. Si no existe, lo creamos
    const mainArea = document.getElementById('main-area');
    
    // Crear el elemento <arzuka-include>
    const include = document.createElement('arzuka-include');
    include.setAttribute('src', rutaHtml);
    
    // Escuchar cuando termine de cargar el HTML
    include.addEventListener('loaded', () => {
        activarVistaUI(idVista);
        if (callbackLoad) callbackLoad();
    });

    mainArea.appendChild(include);
}

// Helper para manejar clases CSS de activo/inactivo
function activarVistaUI(idVista) {
    // Ocultar todas las secciones
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    // Desactivar menú
    document.querySelectorAll('#sidebar .list-group-item, #sidebar a').forEach(el => el.classList.remove('active'));
    
    // Mostrar la deseada (si ya se cargó el HTML)
    const el = document.getElementById(idVista);
    if(el) el.classList.add('active');
    
    // Cerrar sidebar móvil
    toggleSidebar(false);
}

function toggleSidebar(forceState = null) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (forceState === false) sidebar.classList.remove('active');
    else sidebar.classList.toggle('active');
}
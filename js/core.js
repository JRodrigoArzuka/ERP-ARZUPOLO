/**
 * js/core.js
 * Núcleo de la aplicación: API, Caché, Navegación y Utilidades.
 * VERSIÓN 4.0: Soporte para Caché Inteligente.
 */

// =============================================================================
// 1. CONFIGURACIÓN Y CACHÉ
// =============================================================================

const Config = {
    // URL del Script de Google (Debe ser la misma de tu Deploy)
    URL_API_PRINCIPAL: "https://script.google.com/macros/s/AKfycbxfHHUGrAPAJGCGLnX4LPoqsE4OECHO4jYuWkprw2FJHsgNHaCfy9-YCEOZ-PsMMbFa/exec"
};

const CacheSystem = {
    // Clave para saber si el caché está activado globalmente
    KEY_ENABLED: 'arzuka_cache_enabled',
    
    isEnabled: () => localStorage.getItem(CacheSystem.KEY_ENABLED) === 'true',
    
    toggle: (estado) => {
        localStorage.setItem(CacheSystem.KEY_ENABLED, estado);
        if(!estado) CacheSystem.clear(); // Si se apaga, limpiar basura
    },

    get: (key) => {
        if (!CacheSystem.isEnabled()) return null;
        const item = localStorage.getItem(key);
        if (!item) return null;
        
        const parsed = JSON.parse(item);
        // Validar tiempo de vida (TTL) - Ejemplo: 1 hora (3600000 ms)
        // Para ventas del día, usaremos un TTL corto (5 min)
        const now = Date.now();
        if (now > parsed.expiry) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed.value;
    },

    set: (key, value, ttlMinutes = 60) => {
        if (!CacheSystem.isEnabled()) return;
        const item = {
            value: value,
            expiry: Date.now() + (ttlMinutes * 60 * 1000)
        };
        localStorage.setItem(key, JSON.stringify(item));
    },

    clear: () => {
        // Borra solo items de caché, no la sesión de usuario
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('cache_')) localStorage.removeItem(key);
        });
    }
};

// =============================================================================
// 2. CONECTOR API (CEREBRO)
// =============================================================================

/**
 * Llama al Backend. Soporta Caché.
 * @param {string} servicio - Nombre del módulo (log)
 * @param {string} accion - Función del Backend
 * @param {Object} payload - Datos a enviar
 * @param {Object} options - { useCache: true, ttl: 10 }
 */
async function callAPI(servicio, accion, payload = {}, options = {}) {
    console.log(`📡 [${servicio}] ${accion}...`);

    // 1. INTENTAR LEER DE CACHÉ (Si está habilitado y solicitado)
    const cacheKey = `cache_${accion}_${JSON.stringify(payload)}`;
    
    if (options.useCache && CacheSystem.isEnabled()) {
        const cachedData = CacheSystem.get(cacheKey);
        if (cachedData) {
            console.log(`⚡ [${servicio}] Recuperado de Caché`);
            return cachedData;
        }
    }

    // 2. LLAMADA A LA RED
    try {
        const respuesta = await fetch(Config.URL_API_PRINCIPAL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ accion: accion, payload: payload })
        });

        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

        const datos = await respuesta.json();

        // 3. GUARDAR EN CACHÉ (Si fue exitoso y se solicitó)
        if (datos.success && options.useCache) {
            CacheSystem.set(cacheKey, datos, options.ttl || 60); // Default 60 min
        }
        
        return datos;

    } catch (error) {
        console.error(`🔥 [${servicio}] Fallo:`, error);
        return { success: false, error: error.message };
    }
}

// =============================================================================
// 3. NAVEGACIÓN Y UI
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
    // Verificar conexión al cargar (sin caché, siempre fresco)
    // Esto se llama desde app.js, así que aquí solo definimos la función
});

async function verificarConexion() {
    const indicador = document.getElementById('indicador-conexion');
    if(!indicador) return;

    indicador.innerHTML = '<span class="spinner-border spinner-border-sm text-warning"></span> ...';
    
    try {
        const res = await callAPI('sistema', 'testConexion');
        if (res.success) {
            indicador.innerHTML = '<i class="bi bi-circle-fill text-success"></i> Online';
            indicador.title = res.mensaje;
        } else {
            indicador.innerHTML = '<i class="bi bi-exclamation-circle-fill text-danger"></i> Error';
        }
    } catch (e) {
        indicador.innerHTML = '<i class="bi bi-wifi-off text-danger"></i> Offline';
    }
}

function nav(vista) {
    // Ocultar todas las vistas
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#sidebar a').forEach(el => el.classList.remove('active'));
    
    // Activar vista destino
    const vistaEl = document.getElementById('view-' + vista);
    if(vistaEl) vistaEl.classList.add('active');
    
    // Cerrar menú móvil
    toggleSidebar(false);

    // Lógica de carga perezosa (Lazy Load)
    if(vista === 'ventas-arzuka') {
        if(typeof cargarVentasArzuka === 'function') cargarVentasArzuka();
    }
}

function toggleSidebar(forceState = null) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    if (forceState === false) sidebar.classList.remove('active');
    else sidebar.classList.toggle('active');
}
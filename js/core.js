/**
 * js/core.js
 * Núcleo de la aplicación: Manejo de Estado, Navegación y Diagnóstico.
 */

// Estado global de la aplicación
let globalData = {
    listas: {},
    proveedores: [],
    sucursales: [],
    usuarios: [],
    cache: {
        proveedores: null,
        usuarios: null,
        timestamp: null
    }
};

// --- DIAGNÓSTICO DE CONEXIÓN ---
document.addEventListener("DOMContentLoaded", () => {
    verificarConexion();
});

async function verificarConexion() {
    const indicador = document.getElementById('indicador-conexion');
    if(!indicador) return;

    indicador.innerHTML = '<span class="spinner-border spinner-border-sm text-warning"></span> Conectando...';
    
    try {
        // Usamos la acción 'testConexion' que ya programamos en el Backend
        const respuesta = await callAPI('sistema', 'testConexion');
        
        if (respuesta.success) {
            indicador.innerHTML = '<i class="bi bi-circle-fill text-success"></i> Online';
            indicador.title = `Conectado: ${respuesta.mensaje}`;
        } else {
            indicador.innerHTML = '<i class="bi bi-exclamation-circle-fill text-danger"></i> Error API';
        }
    } catch (e) {
        indicador.innerHTML = '<i class="bi bi-wifi-off text-danger"></i> Offline';
        console.error("Fallo verificación de conexión:", e);
    }
}

// --- NAVEGACIÓN ---
function nav(vista) {
    // Ocultar todas las vistas y desactivar menús
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#sidebar a').forEach(el => el.classList.remove('active'));
    
    // Activar vista
    const vistaEl = document.getElementById('view-' + vista);
    if(vistaEl) vistaEl.classList.add('active');
    
    // En móvil, cerrar el menú al hacer clic
    toggleSidebar(false);

    // Carga diferida de datos (Lazy Loading)
    if(vista === 'proveedores') {
        if(typeof cargarProveedores === 'function') cargarProveedores();
    }
    
    if(vista === 'usuarios') {
        if(typeof cargarUsuarios === 'function') cargarUsuarios();
    }
    
    if(vista === 'ventas-arzuka') {
        if(typeof cargarVentasArzuka === 'function') cargarVentasArzuka();
    }

    // Scroll al inicio para mejor UX
    window.scrollTo(0, 0);
}

// --- UTILIDADES UI ---
function toggleSidebar(forceState = null) {
    const sidebar = document.getElementById('sidebar');
    const menuOverlay = document.getElementById('overlay'); 
    
    if (forceState === false) {
        sidebar.classList.remove('active');
        if(menuOverlay) menuOverlay.classList.remove('active');
    } else {
        sidebar.classList.toggle('active');
        if(menuOverlay) menuOverlay.classList.toggle('active');
    }
}

function limpiarCache() {
    globalData.cache = {
        proveedores: null,
        usuarios: null,
        timestamp: null
    };
}
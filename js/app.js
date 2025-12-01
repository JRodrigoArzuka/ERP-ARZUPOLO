/**
 * js/app.js
 * Orquestador principal. Inicializa la app una vez que los componentes HTML han cargado.
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Esperar a que todos los <arzuka-include> terminen de cargar
    const components = Array.from(document.querySelectorAll('arzuka-include'));
    
    Promise.all(components.map(el => {
        return new Promise(resolve => {
            // Si el componente ya tiene contenido, resolver
            if (el.innerHTML.trim() !== "") resolve();
            // Si no, escuchar evento 'loaded'
            el.addEventListener('loaded', () => resolve(), { once: true });
        });
    })).then(() => {
        console.log("✅ Todos los componentes cargados.");
        iniciarAplicacion();
    });
});

function iniciarAplicacion() {
    // 2. Verificar Sesión (Lógica movida de auth.js/index anterior)
    const usuario = JSON.parse(localStorage.getItem("erp_usuario"));
    const loginOverlay = document.getElementById("login-overlay");

    if (!usuario) {
        // No hay sesión: Mostrar Login
        if(loginOverlay) loginOverlay.style.display = "flex";
    } else {
        // Hay sesión: Ocultar Login y cargar
        if(loginOverlay) loginOverlay.style.display = "none";
        
        // Actualizar UI del sidebar
        if(typeof actualizarInfoUsuario === 'function') actualizarInfoUsuario(usuario);
        
        // Verificar conexión con Google
        if(typeof verificarConexion === 'function') verificarConexion();
        
        // Cargar vista inicial
        if(typeof nav === 'function') nav('ventas-arzuka');
    }
}
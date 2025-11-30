/**
 * js/auth.js
 * Maneja el inicio de sesión y la seguridad.
 * Actualizado para usar la Arquitectura Unificada (callAPI).
 */

// 1. Verificar sesión al cargar
document.addEventListener("DOMContentLoaded", () => {
    const usuario = JSON.parse(localStorage.getItem("erp_usuario"));
    const loginOverlay = document.getElementById("login-overlay");

    if (!usuario) {
        // No hay sesión: Mostrar Login y bloquear scroll
        if(loginOverlay) loginOverlay.style.display = "flex";
    } else {
        // Hay sesión: Ocultar Login y cargar datos usuario
        if(loginOverlay) loginOverlay.style.display = "none";
        actualizarInfoUsuario(usuario);
    }
});

// 2. Función de Login (Conecta con API_Handler)
async function iniciarSesion() {
    const user = document.getElementById("loginUser").value.trim();
    const pass = document.getElementById("loginPass").value.trim();
    const btn = document.getElementById("btnLogin");
    const errorMsg = document.getElementById("loginError");

    // Validaciones básicas
    if (!user || !pass) {
        errorMsg.innerText = "⚠️ Ingresa usuario y contraseña";
        return;
    }

    // UI: Bloquear botón
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Verificando...';
    errorMsg.innerText = "";

    try {
        // USAMOS callAPI (Conecta con API_Handler_ARZUKA.gs)
        const datos = await callAPI('usuarios', 'login', { 
            usuario: user, 
            password: pass 
        });

        if (datos.success) {
            // Guardar sesión en navegador
            localStorage.setItem("erp_usuario", JSON.stringify(datos.usuario));
            
            // Alerta de seguridad si es pass por defecto
            if (datos.usuario.cambiarPass) {
                alert("⚠️ Por seguridad, cambia tu contraseña pronto.");
            }

            location.reload(); // Recargar para entrar al sistema
        } else {
            errorMsg.innerText = "❌ " + datos.error;
        }

    } catch (e) {
        console.error(e);
        errorMsg.innerText = "Error de conexión. Intenta nuevamente.";
    } finally {
        // UI: Restaurar botón
        btn.disabled = false;
        btn.innerText = "INGRESAR";
    }
}

// 3. Cerrar Sesión
function cerrarSesion() {
    if(confirm("¿Seguro que deseas salir del sistema?")) {
        localStorage.removeItem("erp_usuario");
        location.reload(); // Al recargar, el paso 1 mostrará el login
    }
}

// 4. Actualizar UI del Sidebar
function actualizarInfoUsuario(usuario) {
    const lblUser = document.getElementById("lblUsuarioActual");
    if(lblUser) {
        // Mostrar Nombre y Rol (Ej: "Juan Perez (Vendedor)")
        lblUser.innerText = `${usuario.nombre} (${usuario.rol || 'Usuario'})`;
    }
    
    // Aquí podrías ocultar menús según el rol (Ej: ocultar Configuración si no es Admin)
}
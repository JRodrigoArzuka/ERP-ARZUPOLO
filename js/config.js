/**
 * js/config.js
 * Configuración Central del ERP ARZUPOLO.SAC
 * Conecta el Frontend con el API Gateway en Google Apps Script.
 */

const Config = {
    // URL del Despliegue Web App (API_Handler_ARZUKA.gs)
    // Esta es la URL única que maneja Ventas, Usuarios y CRM.
    URL_API_PRINCIPAL: "https://script.google.com/macros/s/AKfycbxfHHUGrAPAJGCGLnX4LPoqsE4OECHO4jYuWkprw2FJHsgNHaCfy9-YCEOZ-PsMMbFa/exec"
};

/**
 * Función Genérica para llamar al Backend
 * @param {string} servicio - Nombre del módulo (ej: 'ventas', 'usuarios') - Solo para log
 * @param {string} accion - Nombre de la función a ejecutar en GAS (ej: 'registrarVenta')
 * @param {Object} payload - Datos a enviar
 */
async function callAPI(servicio, accion, payload = {}) {
    console.log(`📡 [${servicio.toUpperCase()}] Solicitando: ${accion}...`);

    try {
        const respuesta = await fetch(Config.URL_API_PRINCIPAL, {
            method: "POST",
            mode: "cors", // Importante para evitar bloqueos de seguridad
            headers: {
                "Content-Type": "text/plain;charset=utf-8", // Evita preflight OPTIONS de Google
            },
            body: JSON.stringify({ 
                accion: accion, 
                payload: payload 
            })
        });

        if (!respuesta.ok) {
            throw new Error(`Error HTTP: ${respuesta.status}`);
        }

        const datos = await respuesta.json();
        
        if (!datos.success) {
            console.warn(`⚠️ [${servicio}] Error del servidor:`, datos.error);
            // Opcional: Mostrar alerta global si es error crítico
        } else {
            console.log(`✅ [${servicio}] Éxito:`, datos);
        }
        
        return datos;

    } catch (error) {
        console.error(`🔥 [${servicio}] Fallo de conexión:`, error);
        return { 
            success: false, 
            error: `No se pudo conectar con el servidor. Verifica tu internet. (${error.message})` 
        };
    }
}
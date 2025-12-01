/**
 * js/gestion_tickets.js
 * Controla la "Super Ventana" de Gestión (Modal).
 */

let currentTicketID = null;

// --- 1. ABRIR Y CARGAR EL MODAL ---
async function abrirGestionTicket(idTicket) {
    currentTicketID = idTicket;
    
    // UI: Resetear y mostrar cargando
    const modal = new bootstrap.Modal(document.getElementById('modalGestionTicket'));
    document.getElementById('lblGestionTicketID').innerText = idTicket;
    document.getElementById('tblGestionProductos').innerHTML = '<tr><td colspan="3" class="text-center"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr>';
    
    // Resetear pestañas
    const triggerFirstTab = new bootstrap.Tab(document.querySelector('#gestionTabs button[data-bs-target="#tab-resumen"]'));
    triggerFirstTab.show();
    
    modal.show();

    // Llamadas paralelas para optimizar velocidad
    // 1. Detalle de productos (ya existía la función, la reutilizamos)
    const promDetalle = callAPI('ventas', 'obtenerDetalleTicket', { id_ticket: idTicket });
    // 2. Datos de gestión (nueva función del backend)
    const promGestion = callAPI('ventas', 'obtenerDatosGestionTicket', { id_ticket: idTicket });

    try {
        const [resDetalle, resGestion] = await Promise.all([promDetalle, promGestion]);

        // A. Llenar Tabla Productos
        const tbody = document.getElementById('tblGestionProductos');
        tbody.innerHTML = '';
        if(resDetalle.success && resDetalle.items.length > 0) {
            resDetalle.items.forEach(item => {
                tbody.innerHTML += `<tr>
                    <td>${item.producto} <small class="text-muted d-block">${item.descripcion || ''}</small></td>
                    <td>${item.cantidad}</td>
                    <td class="text-end">S/ ${parseFloat(item.subtotal).toFixed(2)}</td>
                </tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Sin items</td></tr>';
        }

        // B. Llenar Datos de Gestión
        if(resGestion.success) {
            const data = resGestion.data;
            const cab = data.cabecera;
            const log = data.logistica;

            // Totales
            document.getElementById('lblResumenSubtotal').innerText = (cab.total - cab.costo_delivery).toFixed(2);
            document.getElementById('lblResumenDelivery').innerText = cab.costo_delivery.toFixed(2);
            document.getElementById('lblResumenTotal').innerText = cab.total.toFixed(2);
            document.getElementById('lblResumenPendiente').innerText = cab.saldo.toFixed(2);

            // Pestaña Delivery
            document.getElementById('swGestionDelivery').checked = log.es_delivery;
            toggleGestionDelivery(); // Mostrar/Ocultar panel
            
            document.getElementById('txtGestionDireccion').value = log.direccion;
            document.getElementById('txtGestionReferencia').value = log.referencia;
            document.getElementById('txtGestionPersona').value = log.persona;
            document.getElementById('txtGestionContacto').value = log.contacto;
            document.getElementById('numGestionCostoDelivery').value = cab.costo_delivery;

            // Pestaña Multimedia
            renderizarGaleria(data.multimedia);

            // Pestaña Editar
            document.getElementById('selGestionEstado').value = cab.estado;
            document.getElementById('dateGestionEvento').value = cab.fecha_evento;
            document.getElementById('selGestionTurno').value = cab.turno;
            document.getElementById('txtGestionObs').value = cab.observaciones;

            // Pestaña Contrato
            const divLink = document.getElementById('divContratoLink');
            const divAction = document.getElementById('divContratoActions');
            if(cab.url_contrato) {
                divLink.classList.remove('d-none');
                document.getElementById('linkContratoFinal').href = cab.url_contrato;
                divAction.classList.add('d-none'); // Ocultar botón generar si ya existe
            } else {
                divLink.classList.add('d-none');
                divAction.classList.remove('d-none');
            }
        }

    } catch (e) {
        alert("Error cargando datos: " + e.message);
    }
}

// --- 2. LÓGICA DELIVERY ---
function toggleGestionDelivery() {
    const isChecked = document.getElementById('swGestionDelivery').checked;
    const panel = document.getElementById('panelGestionDelivery');
    if(isChecked) panel.classList.remove('d-none');
    else panel.classList.add('d-none');
}

async function guardarLogistica() {
    const btn = document.querySelector('#panelGestionDelivery button');
    const originalText = btn.innerHTML;
    btn.disabled = true; btn.innerText = "Guardando...";

    const payload = {
        id_ticket: currentTicketID,
        es_delivery: document.getElementById('swGestionDelivery').checked,
        direccion: document.getElementById('txtGestionDireccion').value,
        referencia: document.getElementById('txtGestionReferencia').value,
        persona_recibe: document.getElementById('txtGestionPersona').value,
        contacto: document.getElementById('txtGestionContacto').value,
        costo_delivery: document.getElementById('numGestionCostoDelivery').value
    };

    const res = await callAPI('ventas', 'guardarLogisticaTicket', payload);
    
    if(res.success) {
        alert("✅ Datos actualizados.");
        // Recargar datos para ver nuevos totales
        abrirGestionTicket(currentTicketID); 
    } else {
        alert("❌ Error: " + res.error);
    }
    
    btn.disabled = false; btn.innerHTML = originalText;
}

// --- 3. LÓGICA MULTIMEDIA ---
function renderizarGaleria(fotos) {
    const container = document.getElementById('galeriaFotos');
    container.innerHTML = '';
    
    if(!fotos || fotos.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-5">No hay fotos cargadas.</div>';
        return;
    }

    fotos.forEach(f => {
        container.innerHTML += `
            <div class="col-6 col-md-3">
                <div class="card h-100 shadow-sm">
                    <img src="${f.url}" class="card-img-top" style="height: 120px; object-fit: cover;">
                    <div class="card-body p-2 small">
                        <p class="card-text mb-1 text-truncate">${f.comentario || 'Sin título'}</p>
                        <a href="${f.url}" target="_blank" class="text-decoration-none fw-bold">Ver <i class="bi bi-box-arrow-up-right"></i></a>
                    </div>
                </div>
            </div>
        `;
    });
}

function clickInputFoto() {
    document.getElementById('fileGestionFoto').click();
}

async function subirFotoSeleccionada() {
    const input = document.getElementById('fileGestionFoto');
    if(input.files.length === 0) return;
    
    const file = input.files[0];
    const comentario = prompt("Descripción de la foto (Opcional):", "Referencia");
    if(comentario === null) { input.value = ''; return; } // Cancelado

    // Convertir a Base64
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async function () {
        const base64 = reader.result.split(',')[1];
        
        // Mostrar cargando
        const container = document.getElementById('galeriaFotos');
        container.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary"></div><br>Subiendo...</div>';

        const payload = {
            id_ticket: currentTicketID,
            base64: base64,
            mimeType: file.type,
            comentario: comentario,
            usuario: 'WebUser' // Podrías sacar esto de localStorage
        };

        const res = await callAPI('ventas', 'subirFotoReferencia', payload);
        
        if(res.success) {
            // Recargar solo la galería
            const resData = await callAPI('ventas', 'obtenerDatosGestionTicket', { id_ticket: currentTicketID });
            if(resData.success) renderizarGaleria(resData.data.multimedia);
        } else {
            alert("Error subiendo: " + res.error);
        }
        input.value = '';
    };
}

// --- 4. LÓGICA EDITAR ---
async function guardarEdicion() {
    if(!confirm("¿Seguro que deseas modificar los datos del pedido?")) return;
    
    const usuario = JSON.parse(localStorage.getItem("erp_usuario"));
    
    const payload = {
        id_ticket: currentTicketID,
        usuario_rol: usuario ? usuario.rol : 'Anon', // Enviar rol para validación
        estado: document.getElementById('selGestionEstado').value,
        fecha_evento: document.getElementById('dateGestionEvento').value,
        turno: document.getElementById('selGestionTurno').value,
        observaciones: document.getElementById('txtGestionObs').value
    };

    const res = await callAPI('ventas', 'editarDatosTicket', payload);
    if(res.success) {
        alert("✅ Pedido actualizado.");
        // Refrescar tabla principal de ventas si está visible
        if(typeof cargarVentasArzuka === 'function') cargarVentasArzuka();
    } else {
        alert("⛔ " + res.error);
    }
}

// --- 5. LÓGICA CONTRATO ---
async function generarContrato() {
    const btn = document.querySelector('#divContratoActions button');
    btn.disabled = true; btn.innerText = "Generando PDF...";

    const res = await callAPI('ventas', 'generarContrato', { id_ticket: currentTicketID });
    
    if(res.success) {
        document.getElementById('divContratoActions').classList.add('d-none');
        const divLink = document.getElementById('divContratoLink');
        divLink.classList.remove('d-none');
        document.getElementById('linkContratoFinal').href = res.url;
        alert("✅ Contrato generado.");
    } else {
        alert("❌ Error: " + res.error);
    }
    
    btn.disabled = false; btn.innerText = "Generar PDF";
}
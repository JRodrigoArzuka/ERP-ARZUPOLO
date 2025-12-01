/**
 * js/gestion_tickets.js
 * Lógica del Frontend para la Super Ventana de Gestión.
 * Versión Final: Corrección de errores, validaciones y nuevos campos.
 */

let currentTicketID = null;
let currentClientData = {}; // Almacena temporalmente nombre/celular del cliente

// =============================================================================
// 1. ABRIR Y CARGAR EL MODAL
// =============================================================================
async function abrirGestionTicket(idTicket) {
    currentTicketID = idTicket;
    
    // Referencias UI
    const modalEl = document.getElementById('modalGestionTicket');
    const modal = new bootstrap.Modal(modalEl);
    
    // A. Resetear UI (Limpiar datos anteriores)
    document.getElementById('lblGestionTicketID').innerText = idTicket;
    document.getElementById('tblGestionProductos').innerHTML = '<tr><td colspan="3" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr>';
    
    // Resetear textos de totales
    ['lblResumenSubtotal', 'lblResumenDelivery', 'lblResumenTotal', 'lblResumenPendiente'].forEach(id => {
        document.getElementById(id).innerText = '...';
    });

    // Resetear Pestañas (Volver a la primera)
    const firstTabBtn = document.querySelector('#gestionTabs button[data-bs-target="#tab-resumen"]');
    if(firstTabBtn) new bootstrap.Tab(firstTabBtn).show();
    
    modal.show();

    // B. Cargar Datos del Servidor
    try {
        // Ejecutamos ambas peticiones en paralelo para mayor velocidad
        const [resDetalle, resGestion] = await Promise.all([
            callAPI('ventas', 'obtenerDetalleTicket', { id_ticket: idTicket }),
            callAPI('ventas', 'obtenerDatosGestionTicket', { id_ticket: idTicket })
        ]);

        // --- PROCESAR TABLA PRODUCTOS ---
        const tbody = document.getElementById('tblGestionProductos');
        tbody.innerHTML = '';
        
        if (resDetalle.success && resDetalle.items && resDetalle.items.length > 0) {
            resDetalle.items.forEach(item => {
                tbody.innerHTML += `
                    <tr>
                        <td>
                            <span class="fw-bold">${item.producto}</span>
                            ${item.descripcion ? `<br><small class="text-muted fst-italic">${item.descripcion}</small>` : ''}
                        </td>
                        <td class="text-center">${item.cantidad}</td>
                        <td class="text-end">S/ ${Number(item.subtotal || 0).toFixed(2)}</td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">No hay productos registrados.</td></tr>';
        }

        // --- PROCESAR DATOS DE GESTIÓN ---
        if (resGestion.success) {
            const data = resGestion.data;
            const cab = data.cabecera;
            const log = data.logistica;
            const listas = data.listas; // Maestros para selects

            // 1. Guardar datos para botón copiar
            currentClientData = { 
                nombre: cab.cliente_nombre || '', 
                celular: cab.cliente_celular || '' 
            };

            // 2. Cálculos Financieros Seguros (Evita error toFixed)
            const total = Number(cab.total || 0);
            const delivery = Number(cab.costo_delivery || 0);
            const saldo = Number(cab.saldo || 0);
            const subtotal = total - delivery;

            document.getElementById('lblResumenSubtotal').innerText = subtotal.toFixed(2);
            document.getElementById('lblResumenDelivery').innerText = delivery.toFixed(2);
            document.getElementById('lblResumenTotal').innerText = total.toFixed(2);
            document.getElementById('lblResumenPendiente').innerText = saldo.toFixed(2);

            // 3. Pestaña Delivery
            document.getElementById('swGestionDelivery').checked = log.es_delivery;
            toggleGestionDelivery(); // Actualizar visibilidad panel
            
            document.getElementById('txtGestionDireccion').value = log.direccion;
            document.getElementById('txtGestionReferencia').value = log.referencia;
            document.getElementById('txtGestionPersona').value = log.persona;
            document.getElementById('txtGestionContacto').value = log.contacto;
            document.getElementById('numGestionCostoDelivery').value = delivery;

            // 4. Pestaña Multimedia
            renderizarGaleria(data.multimedia);

            // 5. Pestaña Editar (Llenado Avanzado)
            
            // A. Llenar Selects Dinámicos
            llenarSelect('selGestionVendedor', listas.vendedores, cab.id_vendedor); // [{id, nombre}]
            llenarSelectSimple('selGestionTipoEvento', listas.tiposEvento, cab.tipo_evento); // ["Boda", "Cumple"]

            // B. Llenar Inputs
            document.getElementById('selGestionEstado').value = cab.estado;
            document.getElementById('selGestionTurno').value = cab.turno;
            
            document.getElementById('txtGestionIdentidad').value = cab.identidad;
            document.getElementById('txtGestionTematica').value = cab.texto_tematica;
            document.getElementById('txtGestionObs').value = cab.observaciones;

            // C. Fechas y Validación (Min = Hoy)
            const hoy = new Date().toISOString().split('T')[0];
            
            const dateEvento = document.getElementById('dateGestionEvento');
            dateEvento.value = cab.fecha_evento;
            dateEvento.min = hoy; // Bloquear pasado

            const dateEntrega = document.getElementById('dateGestionEntrega');
            dateEntrega.value = cab.fecha_entrega;
            dateEntrega.min = hoy; // Bloquear pasado

            // 6. Pestaña Contrato
            const divLink = document.getElementById('divContratoLink');
            const divAction = document.getElementById('divContratoActions');
            
            if (cab.url_contrato && cab.url_contrato.startsWith('http')) {
                divLink.classList.remove('d-none');
                document.getElementById('linkContratoFinal').href = cab.url_contrato;
                divAction.classList.add('d-none');
            } else {
                divLink.classList.add('d-none');
                divAction.classList.remove('d-none');
            }

        } else {
            console.error("Error backend gestion:", resGestion.error);
            alert("⚠️ Alerta: " + resGestion.error);
        }

    } catch (e) {
        console.error(e);
        alert("❌ Error crítico al cargar datos: " + e.message);
    }
}

// =============================================================================
// 2. FUNCIONES DE UTILIDAD UI
// =============================================================================

/**
 * Llena un select con array de objetos {id, nombre}
 */
function llenarSelect(idSelect, arrayDatos, valorSeleccionado) {
    const sel = document.getElementById(idSelect);
    sel.innerHTML = '<option value="">- Seleccionar -</option>';
    
    if (!arrayDatos) return;

    arrayDatos.forEach(item => {
        // Manejo robusto: item puede ser objeto o string
        const val = item.id || item;
        const txt = item.nombre || item;
        const isSelected = (String(val) === String(valorSeleccionado)) ? 'selected' : '';
        
        sel.innerHTML += `<option value="${val}" ${isSelected}>${txt}</option>`;
    });
}

/**
 * Llena un select con array simple de strings
 */
function llenarSelectSimple(idSelect, arrayDatos, valorSeleccionado) {
    const sel = document.getElementById(idSelect);
    sel.innerHTML = '<option value="">- Seleccionar -</option>';
    
    if (!arrayDatos) return;

    arrayDatos.forEach(txt => {
        const isSelected = (String(txt) === String(valorSeleccionado)) ? 'selected' : '';
        sel.innerHTML += `<option value="${txt}" ${isSelected}>${txt}</option>`;
    });
}

function toggleGestionDelivery() {
    const isChecked = document.getElementById('swGestionDelivery').checked;
    const panel = document.getElementById('panelGestionDelivery');
    if (isChecked) panel.classList.remove('d-none');
    else panel.classList.add('d-none');
}

/**
 * Copia nombre y celular del cliente a los campos de delivery
 */
function copiarDatosClienteDelivery() {
    if (currentClientData.nombre) {
        document.getElementById('txtGestionPersona').value = currentClientData.nombre;
    }
    if (currentClientData.celular) {
        document.getElementById('txtGestionContacto').value = currentClientData.celular;
    }
    // Feedback visual pequeño
    const btn = document.querySelector('#panelGestionDelivery button.btn-outline-info');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-check"></i> Copiado';
    setTimeout(() => btn.innerHTML = original, 1000);
}

function renderizarGaleria(fotos) {
    const container = document.getElementById('galeriaFotos');
    container.innerHTML = '';
    
    if (!fotos || fotos.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-5">No hay fotos cargadas para este pedido.</div>';
        return;
    }

    fotos.forEach(f => {
        container.innerHTML += `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="card h-100 shadow-sm border">
                    <div style="height: 150px; overflow: hidden;" class="bg-light d-flex align-items-center justify-content-center">
                        <img src="${f.url}" class="w-100 h-100" style="object-fit: cover;" onerror="this.src='https://via.placeholder.com/150?text=Error+Img'">
                    </div>
                    <div class="card-body p-2 text-center">
                        <small class="d-block text-truncate fw-bold text-dark mb-1" title="${f.comentario}">${f.comentario || 'Referencia'}</small>
                        <small class="d-block text-muted mb-2" style="font-size: 0.7rem;">${f.fecha || ''}</small>
                        <a href="${f.url}" target="_blank" class="btn btn-sm btn-outline-primary w-100 py-0" style="font-size: 0.8rem;">
                            <i class="bi bi-eye"></i> Ver
                        </a>
                    </div>
                </div>
            </div>
        `;
    });
}

// =============================================================================
// 3. ACCIONES DE GUARDADO (Backend Calls)
// =============================================================================

/**
 * Guarda configuración de Delivery
 */
async function guardarLogistica() {
    const btn = document.querySelector('#panelGestionDelivery button.btn-primary');
    const originalText = btn.innerHTML;
    
    btn.disabled = true; 
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

    const payload = {
        id_ticket: currentTicketID,
        es_delivery: document.getElementById('swGestionDelivery').checked,
        direccion: document.getElementById('txtGestionDireccion').value,
        referencia: document.getElementById('txtGestionReferencia').value,
        persona_recibe: document.getElementById('txtGestionPersona').value,
        contacto: document.getElementById('txtGestionContacto').value,
        costo_delivery: document.getElementById('numGestionCostoDelivery').value
    };

    try {
        const res = await callAPI('ventas', 'guardarLogisticaTicket', payload);
        
        if (res.success) {
            alert("✅ Datos de entrega actualizados.");
            abrirGestionTicket(currentTicketID); // Recargar para ver totales actualizados
        } else {
            alert("❌ Error al guardar: " + res.error);
        }
    } catch (e) {
        alert("Error de conexión: " + e.message);
    } finally {
        btn.disabled = false; 
        btn.innerHTML = originalText;
    }
}

/**
 * Sube foto a Drive
 */
function clickInputFoto() {
    document.getElementById('fileGestionFoto').click();
}

async function subirFotoSeleccionada() {
    const input = document.getElementById('fileGestionFoto');
    if (input.files.length === 0) return;
    
    const file = input.files[0];
    const comentario = prompt("Escribe una descripción para la foto (Ej: 'Diseño Torta', 'Comprobante'):", "Referencia");
    
    if (comentario === null) {
        input.value = ''; // Cancelado
        return; 
    }

    // UI Cargando
    const container = document.getElementById('galeriaFotos');
    container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div><div class="mt-2 text-muted">Subiendo imagen a la nube...</div></div>';

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = async function () {
        const base64 = reader.result.split(',')[1];
        
        const payload = {
            id_ticket: currentTicketID,
            base64: base64,
            mimeType: file.type,
            comentario: comentario,
            usuario: 'WebUser' 
        };

        try {
            const res = await callAPI('ventas', 'subirFotoReferencia', payload);
            
            if (res.success) {
                // Recargar solo la galería
                const resData = await callAPI('ventas', 'obtenerDatosGestionTicket', { id_ticket: currentTicketID });
                if (resData.success) {
                    renderizarGaleria(resData.data.multimedia);
                }
            } else {
                alert("❌ Error subiendo: " + res.error);
                container.innerHTML = '<div class="text-danger text-center">Error al subir imagen.</div>';
            }
        } catch (e) {
            alert("Error red: " + e.message);
        }
        
        input.value = ''; // Limpiar input para permitir subir la misma foto si falló
    };
}

/**
 * Guarda edición de datos generales
 */
async function guardarEdicion() {
    if (!confirm("¿Estás seguro de actualizar los datos principales del pedido?")) return;
    
    const usuario = JSON.parse(localStorage.getItem("erp_usuario"));
    
    // Obtener valores de los campos nuevos
    const payload = {
        id_ticket: currentTicketID,
        usuario_rol: usuario ? usuario.rol : 'Anon', // Validación de seguridad
        
        estado: document.getElementById('selGestionEstado').value,
        id_vendedor: document.getElementById('selGestionVendedor').value,
        tipo_evento: document.getElementById('selGestionTipoEvento').value,
        turno: document.getElementById('selGestionTurno').value,
        
        fecha_evento: document.getElementById('dateGestionEvento').value,
        fecha_entrega: document.getElementById('dateGestionEntrega').value,
        
        identidad: document.getElementById('txtGestionIdentidad').value,
        texto_tematica: document.getElementById('txtGestionTematica').value,
        observaciones: document.getElementById('txtGestionObs').value
    };

    try {
        const res = await callAPI('ventas', 'editarDatosTicket', payload);
        
        if (res.success) {
            alert("✅ Pedido actualizado correctamente.");
            // Opcional: Cerrar modal o recargar tabla principal
            // bootstrap.Modal.getInstance(document.getElementById('modalGestionTicket')).hide();
            // cargarVentasArzuka();
        } else {
            alert("⛔ Error: " + res.error);
        }
    } catch (e) {
        alert("Error de conexión.");
    }
}

/**
 * Generar Contrato PDF
 */
async function generarContrato() {
    const btn = document.querySelector('#divContratoActions button');
    btn.disabled = true; 
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generando PDF...';

    try {
        const res = await callAPI('ventas', 'generarContrato', { id_ticket: currentTicketID });
        
        if (res.success) {
            // Ocultar botón generar y mostrar descargar
            document.getElementById('divContratoActions').classList.add('d-none');
            const divLink = document.getElementById('divContratoLink');
            divLink.classList.remove('d-none');
            document.getElementById('linkContratoFinal').href = res.url;
            
            alert(res.mensaje);
        } else {
            alert("❌ " + res.error);
        }
    } catch (e) {
        alert("Error de conexión: " + e.message);
    } finally {
        btn.disabled = false; 
        btn.innerText = "Generar PDF";
    }
}
/**
 * js/gestion_tickets.js
 * Lógica del Frontend para la Super Ventana de Gestión.
 * VERSIÓN FINAL: Incluye Módulo de Pagos y Notificaciones.
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
    
    // A. Resetear UI
    document.getElementById('lblGestionTicketID').innerText = idTicket;
    document.getElementById('tblGestionProductos').innerHTML = '<tr><td colspan="3" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr>';
    
    // Resetear Totales
    ['lblResumenSubtotal', 'lblResumenDelivery', 'lblResumenTotal', 'lblResumenPendiente', 'lblPagoDeuda'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerText = '...';
    });

    // Resetear Formulario Pagos
    document.getElementById('txtPagoMonto').value = '';
    document.getElementById('txtPagoOperacion').value = '';
    document.getElementById('filePagoVoucher').value = '';
    document.getElementById('lblFotoVoucher').innerText = 'Seleccionar imagen...';

    // Resetear Pestañas
    const firstTabBtn = document.querySelector('#gestionTabs button[data-bs-target="#tab-resumen"]');
    if(firstTabBtn) new bootstrap.Tab(firstTabBtn).show();
    
    modal.show();

    // B. Cargar Datos del Servidor
    try {
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
            const listas = data.listas; 

            // 1. Datos Cliente
            currentClientData = { 
                nombre: cab.cliente_nombre || '', 
                celular: cab.cliente_celular || '' 
            };

            // 2. Cálculos Financieros
            const total = Number(cab.total || 0);
            const delivery = Number(cab.costo_delivery || 0);
            const saldo = Number(cab.saldo || 0);
            const subtotal = total - delivery;

            document.getElementById('lblResumenSubtotal').innerText = subtotal.toFixed(2);
            document.getElementById('lblResumenDelivery').innerText = delivery.toFixed(2);
            document.getElementById('lblResumenTotal').innerText = total.toFixed(2);
            document.getElementById('lblResumenPendiente').innerText = saldo.toFixed(2);
            
            // Actualizar Deuda en Pestaña Pagos
            document.getElementById('lblPagoDeuda').innerText = 'S/ ' + saldo.toFixed(2);
            document.getElementById('txtPagoMonto').value = saldo > 0 ? saldo : ''; // Sugerir monto total

            // 3. Pestaña Delivery
            document.getElementById('swGestionDelivery').checked = log.es_delivery;
            toggleGestionDelivery();
            
            document.getElementById('txtGestionDireccion').value = log.direccion;
            document.getElementById('txtGestionReferencia').value = log.referencia;
            document.getElementById('txtGestionPersona').value = log.persona;
            document.getElementById('txtGestionContacto').value = log.contacto;
            document.getElementById('numGestionCostoDelivery').value = delivery;

            // 4. Pestaña Multimedia
            renderizarGaleria(data.multimedia);

            // 5. Pestaña Editar
            llenarSelect('selGestionVendedor', listas.vendedores, cab.id_vendedor);
            llenarSelectSimple('selGestionTipoEvento', listas.tiposEvento, cab.tipo_evento);

            document.getElementById('selGestionEstado').value = cab.estado;
            document.getElementById('selGestionTurno').value = cab.turno;
            document.getElementById('txtGestionIdentidad').value = cab.identidad;
            document.getElementById('txtGestionTematica').value = cab.texto_tematica;
            document.getElementById('txtGestionObs').value = cab.observaciones;

            const hoy = new Date().toISOString().split('T')[0];
            const dateEvento = document.getElementById('dateGestionEvento');
            dateEvento.value = cab.fecha_evento;
            // dateEvento.min = hoy; // Opcional: Descomentar para bloquear fechas pasadas

            const dateEntrega = document.getElementById('dateGestionEntrega');
            dateEntrega.value = cab.fecha_entrega;
            // dateEntrega.min = hoy; // Opcional

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
            alert("⚠️ Alerta: " + resGestion.error);
        }

    } catch (e) {
        console.error(e);
        alert("❌ Error crítico: " + e.message);
    }
}

// =============================================================================
// 2. LÓGICA DE PAGOS (NUEVO)
// =============================================================================

function previewVoucherName() {
    const input = document.getElementById('filePagoVoucher');
    const lbl = document.getElementById('lblFotoVoucher');
    if(input.files.length > 0) lbl.innerText = input.files[0].name;
    else lbl.innerText = 'Seleccionar imagen...';
}

async function registrarPago() {
    // 1. Validaciones
    const monto = document.getElementById('txtPagoMonto').value;
    if(!monto || parseFloat(monto) <= 0) {
        alert("⚠️ Por favor ingresa un monto válido.");
        return;
    }

    if(!confirm(`¿Confirmar pago de S/ ${monto}?`)) return;

    const btn = document.querySelector('#tab-pagos button.btn-success');
    btn.disabled = true; 
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...';

    // 2. Preparar Datos
    const usuario = JSON.parse(localStorage.getItem("erp_usuario"));
    const fileInput = document.getElementById('filePagoVoucher');
    
    let base64 = null;
    let mimeType = null;

    // Función auxiliar para leer archivo como promesa
    const readFile = (file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });

    if(fileInput.files.length > 0) {
        const dataUrl = await readFile(fileInput.files[0]);
        base64 = dataUrl.split(',')[1];
        mimeType = fileInput.files[0].type;
    }

    const payload = {
        id_ticket: currentTicketID,
        monto: monto,
        metodo: document.getElementById('selPagoMetodo').value,
        nro_operacion: document.getElementById('txtPagoOperacion').value,
        usuario: usuario ? usuario.usuario : 'Web',
        base64: base64,
        mimeType: mimeType
    };

    // 3. Enviar al Servidor
    try {
        const res = await callAPI('finanzas', 'registrarPagoWeb', payload);
        
        if (res.success) {
            alert("✅ " + res.message);
            // Recargar datos para ver saldo actualizado en 0
            abrirGestionTicket(currentTicketID);
            // Actualizar tabla principal si está visible
            if(typeof cargarVentasArzuka === 'function') cargarVentasArzuka();
        } else {
            alert("⛔ Error: " + res.error);
        }
    } catch (e) {
        alert("Error de conexión: " + e.message);
    } finally {
        btn.disabled = false; 
        btn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i> CONFIRMAR PAGO';
    }
}

// =============================================================================
// 3. FUNCIONES DE UTILIDAD UI
// =============================================================================

function llenarSelect(idSelect, arrayDatos, valorSeleccionado) {
    const sel = document.getElementById(idSelect);
    sel.innerHTML = '<option value="">- Seleccionar -</option>';
    if (!arrayDatos) return;
    arrayDatos.forEach(item => {
        const val = item.id || item;
        const txt = item.nombre || item;
        const isSelected = (String(val) === String(valorSeleccionado)) ? 'selected' : '';
        sel.innerHTML += `<option value="${val}" ${isSelected}>${txt}</option>`;
    });
}

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
    if(isChecked) panel.classList.remove('d-none');
    else panel.classList.add('d-none');
}

function copiarDatosClienteDelivery() {
    if (currentClientData.nombre) document.getElementById('txtGestionPersona').value = currentClientData.nombre;
    if (currentClientData.celular) document.getElementById('txtGestionContacto').value = currentClientData.celular;
}

function renderizarGaleria(fotos) {
    const container = document.getElementById('galeriaFotos');
    container.innerHTML = '';
    if (!fotos || fotos.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-5">No hay fotos.</div>';
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
                        <a href="${f.url}" target="_blank" class="btn btn-sm btn-outline-primary w-100 py-0" style="font-size: 0.8rem;"><i class="bi bi-eye"></i> Ver</a>
                    </div>
                </div>
            </div>`;
    });
}

// =============================================================================
// 4. ACCIONES DE GUARDADO (Delivery, Fotos, Editar, Contrato)
// =============================================================================

async function guardarLogistica() {
    const btn = document.querySelector('#panelGestionDelivery button.btn-primary');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

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
            abrirGestionTicket(currentTicketID); 
        } else {
            alert("❌ Error: " + res.error);
        }
    } catch (e) { alert("Error de conexión: " + e.message); }
    finally { btn.disabled = false; btn.innerHTML = 'Guardar'; }
}

function clickInputFoto() { document.getElementById('fileGestionFoto').click(); }

async function subirFotoSeleccionada() {
    const input = document.getElementById('fileGestionFoto');
    if (input.files.length === 0) return;
    
    const file = input.files[0];
    const comentario = prompt("Descripción de la foto:", "Referencia");
    if (comentario === null) { input.value = ''; return; }

    const container = document.getElementById('galeriaFotos');
    container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div><div class="mt-2 text-muted">Subiendo imagen...</div></div>';

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async function () {
        const base64 = reader.result.split(',')[1];
        const payload = {
            id_ticket: currentTicketID, base64: base64, mimeType: file.type,
            comentario: comentario, usuario: 'WebUser' 
        };
        try {
            const res = await callAPI('ventas', 'subirFotoReferencia', payload);
            if (res.success) {
                const resData = await callAPI('ventas', 'obtenerDatosGestionTicket', { id_ticket: currentTicketID });
                if (resData.success) renderizarGaleria(resData.data.multimedia);
            } else {
                alert("❌ Error subiendo: " + res.error);
                container.innerHTML = '<div class="text-danger text-center">Error al subir imagen.</div>';
            }
        } catch (e) { alert("Error red: " + e.message); }
        input.value = '';
    };
}

async function guardarEdicion() {
    if (!confirm("¿Actualizar datos del pedido?")) return;
    const usuario = JSON.parse(localStorage.getItem("erp_usuario"));
    
    const payload = {
        id_ticket: currentTicketID,
        usuario_rol: usuario ? usuario.rol : 'Anon',
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
            alert("✅ " + res.message);
        } else {
            alert("⛔ Error: " + res.error);
        }
    } catch (e) { alert("Error de conexión."); }
}

async function generarContrato() {
    const btns = document.querySelectorAll('#divContratoActions button, #divContratoLink button');
    btns.forEach(b => { b.dataset.originalText = b.innerHTML; b.disabled = true; b.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...'; });

    try {
        const res = await callAPI('ventas', 'generarContrato', { id_ticket: currentTicketID });
        if (res.success) {
            document.getElementById('divContratoActions').classList.add('d-none');
            const divLink = document.getElementById('divContratoLink');
            divLink.classList.remove('d-none');
            document.getElementById('linkContratoFinal').href = res.url;
            alert(res.mensaje);
        } else {
            alert("❌ " + res.error);
        }
    } catch (e) { alert("Error de conexión: " + e.message); }
    finally {
        btns.forEach(b => { b.disabled = false; if(b.dataset.originalText) b.innerHTML = b.dataset.originalText; });
    }
}
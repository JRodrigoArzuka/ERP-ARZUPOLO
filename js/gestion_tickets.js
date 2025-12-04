/**
 * js/gestion_tickets.js
 * Lógica del Frontend para la Super Ventana de Gestión.
 * VERSIÓN FINAL: Implementación de "Cuenta Abierta" y Bloqueo por Deuda.
 */

let currentTicketID = null;
let currentClientData = {};

// =============================================================================
// 1. ABRIR Y CARGAR EL MODAL
// =============================================================================
async function abrirGestionTicket(idTicket) {
    currentTicketID = idTicket;
    
    const modalEl = document.getElementById('modalGestionTicket');
    const modal = new bootstrap.Modal(modalEl);
    
    // Reset UI
    document.getElementById('lblGestionTicketID').innerText = idTicket;
    document.getElementById('tblGestionProductos').innerHTML = '<tr><td colspan="3" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr>';
    
    ['lblResumenSubtotal', 'lblResumenDelivery', 'lblResumenTotal', 'lblResumenPendiente', 'lblPagoDeuda'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerText = '...';
    });

    document.getElementById('txtPagoMonto').value = '';
    document.getElementById('txtPagoOperacion').value = '';
    document.getElementById('filePagoVoucher').value = '';
    document.getElementById('lblFotoVoucher').innerText = 'Seleccionar imagen...';

    // Reset Tabs
    const firstTabBtn = document.querySelector('#gestionTabs button[data-bs-target="#tab-resumen"]');
    if(firstTabBtn) new bootstrap.Tab(firstTabBtn).show();
    
    modal.show();

    try {
        const [resDetalle, resGestion] = await Promise.all([
            callAPI('ventas', 'obtenerDetalleTicket', { id_ticket: idTicket }),
            callAPI('ventas', 'obtenerDatosGestionTicket', { id_ticket: idTicket })
        ]);

        // A. Renderizar Productos
        const tbody = document.getElementById('tblGestionProductos');
        tbody.innerHTML = '';
        if (resDetalle.success && resDetalle.items && resDetalle.items.length > 0) {
            resDetalle.items.forEach(item => {
                tbody.innerHTML += `
                    <tr>
                        <td><span class="fw-bold">${item.producto}</span>${item.descripcion ? `<br><small class="text-muted fst-italic">${item.descripcion}</small>` : ''}</td>
                        <td class="text-center">${item.cantidad}</td>
                        <td class="text-end">S/ ${Number(item.subtotal || 0).toFixed(2)}</td>
                    </tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">No hay productos registrados.</td></tr>';
        }

        // B. Renderizar Datos Gestión
        if (resGestion.success) {
            const data = resGestion.data;
            const cab = data.cabecera;
            const log = data.logistica;
            const listas = data.listas; 

            currentClientData = { nombre: cab.cliente_nombre || '', celular: cab.cliente_celular || '' };
            
            // Mostrar nombre cliente en tab editar (Nuevo requerimiento visual)
            const txtCliNom = document.getElementById('txtGestionClienteNombre');
            if(txtCliNom) txtCliNom.value = cab.cliente_nombre || 'Desconocido';

            // Cálculos Financieros
            const total = Number(cab.total || 0);
            const delivery = Number(cab.costo_delivery || 0);
            const saldo = Number(cab.saldo || 0);
            const subtotal = total - delivery;

            document.getElementById('lblResumenSubtotal').innerText = subtotal.toFixed(2);
            document.getElementById('lblResumenDelivery').innerText = delivery.toFixed(2);
            document.getElementById('lblResumenTotal').innerText = total.toFixed(2);
            document.getElementById('lblResumenPendiente').innerText = saldo.toFixed(2);
            
            // Sección Pagos
            document.getElementById('lblPagoDeuda').innerText = 'S/ ' + saldo.toFixed(2);
            // Sugerir monto total si hay deuda
            document.getElementById('txtPagoMonto').value = saldo > 0 ? saldo : ''; 

            // Logística
            document.getElementById('swGestionDelivery').checked = log.es_delivery;
            toggleGestionDelivery();
            
            document.getElementById('txtGestionDireccion').value = log.direccion;
            document.getElementById('txtGestionReferencia').value = log.referencia;
            document.getElementById('txtGestionPersona').value = log.persona;
            document.getElementById('txtGestionContacto').value = log.contacto;
            document.getElementById('numGestionCostoDelivery').value = delivery;

            // Galería
            renderizarGaleria(data.multimedia);

            // Selectores (Listas Maestras)
            llenarSelect('selGestionVendedor', listas.vendedores, cab.id_vendedor);
            llenarSelectSimple('selGestionTipoEvento', listas.tiposEvento, cab.tipo_evento);
            
            // Estado (Si la lista de estados viene del backend, la usamos, sino hardcode)
            // Aquí asumimos hardcode standard o carga previa, pero usamos el valor actual
            const selEst = document.getElementById('selGestionEstado');
            if(selEst.options.length <= 1) { // Si está vacío salvo el default
                 const estadosDefault = ["Nuevo Pedido", "Pendiente de Envio", "Pendiente Aprobación", "Aprobado", "En Producción", "Producto Listo", "Enviado", "Entregado", "Anulado", "Registro de Anulacion", "Pendiente de Pago"];
                 selEst.innerHTML = '';
                 estadosDefault.forEach(e => selEst.innerHTML += `<option value="${e}">${e}</option>`);
            }
            selEst.value = cab.estado;

            document.getElementById('selGestionTurno').value = cab.turno;
            document.getElementById('txtGestionIdentidad').value = cab.identidad;
            document.getElementById('txtGestionTematica').value = cab.texto_tematica;
            document.getElementById('txtGestionObs').value = cab.observaciones;

            const dateEvento = document.getElementById('dateGestionEvento');
            dateEvento.value = cab.fecha_evento;
            const dateEntrega = document.getElementById('dateGestionEntrega');
            dateEntrega.value = cab.fecha_entrega;

            // Contrato
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
// 2. LÓGICA DE FOTOS (VISUALIZACIÓN Y EDICIÓN)
// =============================================================================

function renderizarGaleria(fotos) {
    const container = document.getElementById('galeriaFotos');
    container.innerHTML = '';
    
    if (!fotos || fotos.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-5">No hay fotos cargadas.</div>';
        return;
    }

    fotos.forEach((f, index) => {
        // TRUCO: Convertir URL de descarga a URL de miniatura
        let imgUrl = f.url;
        if (imgUrl.includes('drive.google.com') && imgUrl.includes('id=')) {
            const idMatch = imgUrl.match(/id=([a-zA-Z0-9_-]+)/);
            if (idMatch) {
                imgUrl = `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
            }
        }

        container.innerHTML += `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="card h-100 shadow-sm border">
                    <div style="height: 160px; overflow: hidden; position: relative;" class="bg-light d-flex align-items-center justify-content-center cursor-pointer" onclick="window.open('${f.url}', '_blank')">
                        <img src="${imgUrl}" class="w-100 h-100" style="object-fit: cover;" 
                             onerror="this.src='https://via.placeholder.com/150?text=Error+Carga'; this.title='Error cargando imagen';">
                        <div class="position-absolute bottom-0 start-0 w-100 bg-dark bg-opacity-50 text-white text-center small py-1">
                            <i class="bi bi-zoom-in"></i> Ver Original
                        </div>
                    </div>
                    <div class="card-body p-2">
                        <textarea class="form-control form-control-sm mb-2" id="comment_${index}" rows="2" style="font-size: 0.8rem;">${f.comentario || ''}</textarea>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted" style="font-size: 0.65rem;">${f.fecha || ''}</small>
                            <button class="btn btn-sm btn-outline-success py-0 px-2" style="font-size: 0.75rem;" onclick="guardarComentarioFoto('${f.url}', 'comment_${index}')">
                                <i class="bi bi-check-lg"></i> Guardar
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

async function guardarComentarioFoto(urlOriginal, inputId) {
    const comentario = document.getElementById(inputId).value;
    const btn = document.querySelector(`button[onclick*="${inputId}"]`);
    const originalHtml = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '...';

    try {
        const res = await callAPI('ventas', 'actualizarComentarioFoto', { 
            url: urlOriginal, 
            comentario: comentario 
        });

        if (res.success) {
            btn.classList.replace('btn-outline-success', 'btn-success');
            btn.innerHTML = '<i class="bi bi-check"></i>';
            setTimeout(() => {
                btn.classList.replace('btn-success', 'btn-outline-success');
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }, 1500);
        } else {
            alert("Error: " + res.error);
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    } catch (e) {
        alert("Error red");
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

// =============================================================================
// 3. PAGOS Y CUENTA ABIERTA
// =============================================================================

function previewVoucherName() {
    const input = document.getElementById('filePagoVoucher');
    const lbl = document.getElementById('lblFotoVoucher');
    if(input.files.length > 0) lbl.innerText = input.files[0].name;
    else lbl.innerText = 'Seleccionar imagen...';
}

async function registrarPago() {
    const inputMonto = document.getElementById('txtPagoMonto');
    const monto = parseFloat(inputMonto.value);
    const lblDeuda = document.getElementById('lblPagoDeuda');
    const textoDeuda = lblDeuda ? lblDeuda.innerText.replace('S/ ', '').trim() : '0';
    const deudaActual = parseFloat(textoDeuda) || 0;

    if(!monto || monto <= 0) {
        alert("⚠️ Por favor ingresa un monto válido.");
        return;
    }

    if(!confirm(`¿Confirmar pago de S/ ${monto.toFixed(2)}?`)) return;

    const btn = document.querySelector('#tab-pagos button.btn-success');
    const originalContent = '<i class="bi bi-check-circle-fill me-2"></i> CONFIRMAR PAGO';
    
    btn.disabled = true; 
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...';

    const usuario = JSON.parse(localStorage.getItem("erp_usuario"));
    const fileInput = document.getElementById('filePagoVoucher');
    
    let base64 = null;
    let mimeType = null;

    if(fileInput.files.length > 0) {
        const readFile = (file) => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
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

    try {
        const res = await callAPI('finanzas', 'registrarPagoWeb', payload);
        if (res.success) {
            alert("✅ " + res.message);
            // Recargar datos para ver el saldo actualizado (deuda 0)
            abrirGestionTicket(currentTicketID);
            // Actualizar tablero principal por si cambió el estado
            if(typeof cargarVentasArzuka === 'function') cargarVentasArzuka();
        } else {
            alert("⛔ Error: " + res.error);
        }
    } catch (e) {
        alert("Error de conexión: " + e.message);
    } finally {
        btn.disabled = false; 
        btn.innerHTML = originalContent;
    }
}

// =============================================================================
// 4. EDICIÓN Y BLOQUEO POR DEUDA (CUENTA ABIERTA)
// =============================================================================

async function guardarEdicion() {
    const nuevoEstado = document.getElementById('selGestionEstado').value;
    const lblDeuda = document.getElementById('lblPagoDeuda');
    const textoDeuda = lblDeuda ? lblDeuda.innerText.replace('S/ ', '').replace(/,/g,'') : '0';
    const deuda = parseFloat(textoDeuda) || 0;

    // --- REGLA DE ORO: BLOQUEO POR DEUDA ---
    // Si intenta marcar como Entregado o Enviado y hay deuda, BLOQUEAR.
    const estadosRestringidos = ['Entregado', 'Enviado'];
    
    if (estadosRestringidos.includes(nuevoEstado) && deuda > 0.50) { // Margen 0.50 céntimos
        // 1. Alerta Visual (Animación en CSS)
        const modalBody = document.querySelector('#modalGestionTicket .modal-body');
        modalBody.classList.add('bloqueo-deuda');
        
        // 2. Mensaje Fuerte
        alert(`⛔ ¡ALTO! CUENTA ABIERTA DETECTADA ⛔\n\nEl cliente "${currentClientData.nombre}" todavía debe S/ ${deuda.toFixed(2)}.\n\nEl sistema PROHÍBE cambiar el estado a "${nuevoEstado}" hasta que la deuda sea CERO.\n\nPor favor, registra el pago en la pestaña 'Pagos' primero.`);
        
        // 3. Quitar animación
        setTimeout(() => modalBody.classList.remove('bloqueo-deuda'), 1000);
        return; // Detener ejecución
    }

    if (!confirm("¿Actualizar datos del pedido?")) return;
    
    const usuario = JSON.parse(localStorage.getItem("erp_usuario"));
    
    const payload = {
        id_ticket: currentTicketID,
        usuario_rol: usuario ? usuario.rol : 'Anon',
        estado: nuevoEstado,
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
            // Recargar Dashboard para reflejar cambios de estado/color
            if(typeof cargarVentasArzuka === 'function') cargarVentasArzuka();
        } else {
            alert("⛔ Error: " + res.error);
        }
    } catch (e) { alert("Error de conexión."); }
}

// =============================================================================
// 5. UTILIDADES UI Y LOGÍSTICA
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
            alert("✅ Logística guardada. Costos actualizados.");
            abrirGestionTicket(currentTicketID); 
        } else {
            alert("❌ " + res.error);
        }
    } catch (e) { alert("Error de conexión: " + e.message); }
    finally { btn.disabled = false; btn.innerHTML = 'Guardar Datos Delivery'; }
}

async function cambiarClienteTicket() {
    const nuevoNombre = prompt("Ingresa el NOMBRE EXACTO del nuevo cliente (debe existir en el Directorio):");
    if (!nuevoNombre) return;

    // Buscar ID en el datalist (memoria caché rápida)
    const datalist = document.getElementById('listaClientes');
    let nuevoId = null;
    
    for (let i = 0; i < datalist.options.length; i++) {
        if (datalist.options[i].value === nuevoNombre) {
            // Asumiendo que guardamos el ID en un atributo data-id, si no, hay que buscar en window.clientesCache
            // Buscaremos en window.clientesCache que cargó en ventas_arzuka.js
            if(window.clientesCache) {
                const c = window.clientesCache.find(cli => cli.nombre === nuevoNombre);
                if(c) nuevoId = c.id;
            }
            break;
        }
    }

    if (!nuevoId) {
        alert("Cliente no encontrado en memoria local. Asegúrate de que el nombre sea exacto o recarga la página.");
        return;
    }

    if(!confirm(`¿Reasignar el ticket ${currentTicketID} a ${nuevoNombre}?`)) return;

    try {
        const res = await callAPI('gestion', 'reasignarClienteTicket', { 
            id_ticket: currentTicketID,
            id_cliente: nuevoId
        });
        if(res.success) {
            alert("✅ Cliente actualizado.");
            abrirGestionTicket(currentTicketID);
        } else {
            alert("Error: " + res.error);
        }
    } catch(e) { alert("Error red"); }
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
            }
        } catch (e) { alert("Error red: " + e.message); }
        input.value = '';
    };
}

async function generarContrato() {
    const btns = document.querySelectorAll('#divContratoActions button');
    btns.forEach(b => { b.disabled = true; b.innerText = "Procesando..."; });

    try {
        const res = await callAPI('ventas', 'generarContrato', { id_ticket: currentTicketID });
        if (res.success) {
            document.getElementById('divContratoActions').classList.add('d-none');
            document.getElementById('divContratoLink').classList.remove('d-none');
            document.getElementById('linkContratoFinal').href = res.url;
        } else {
            alert("❌ " + res.error);
        }
    } catch (e) { alert("Error de conexión"); }
    finally { btns.forEach(b => b.disabled = false); }
}
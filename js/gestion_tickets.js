/**
 * js/gestion_tickets.js
 * Lógica del Frontend para la Super Ventana de Gestión.
 * VERSIÓN FINAL: Búsqueda Predictiva, Historial Pagos y Saldos Reales.
 */

let currentTicketID = null;
let clientesCacheLocal = []; // Almacena la lista ligera para búsqueda rápida

// =============================================================================
// 1. ABRIR Y CARGAR EL MODAL
// =============================================================================
async function abrirGestionTicket(idTicket) {
    currentTicketID = idTicket;
    
    const modalEl = document.getElementById('modalGestionTicket');
    const modal = new bootstrap.Modal(modalEl);
    
    // Reset UI Textos
    document.getElementById('lblGestionTicketID').innerText = idTicket;
    
    // Reset Spinners
    const spinner = '<div class="spinner-border spinner-border-sm text-secondary"></div>';
    document.getElementById('tblGestionProductos').innerHTML = `<tr><td colspan="3" class="text-center py-3">${spinner}</td></tr>`;
    document.getElementById('tblHistorialPagosBody').innerHTML = `<tr><td colspan="5" class="text-center py-3">${spinner}</td></tr>`;
    
    // Reset Labels Financieros
    ['lblResumenSubtotal', 'lblResumenDelivery', 'lblResumenTotal', 'lblResumenAbonado', 'lblResumenPendiente', 'lblPagoAbonado', 'lblPagoPendiente'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerText = '...';
    });

    // Reset Inputs Pagos
    document.getElementById('txtPagoMonto').value = '';
    document.getElementById('txtPagoOperacion').value = '';
    document.getElementById('filePagoVoucher').value = '';
    document.getElementById('lblFotoVoucher').innerText = 'Seleccionar imagen...';

    // Reset Buscador Clientes
    document.getElementById('txtGestionBusquedaCliente').value = '';
    document.getElementById('hdnGestionIdCliente').value = '';
    document.getElementById('listaResultadosClientes').style.display = 'none';

    // Reset Tabs
    const firstTabBtn = document.querySelector('#gestionTabs button[data-bs-target="#tab-resumen"]');
    if(firstTabBtn) new bootstrap.Tab(firstTabBtn).show();
    
    modal.show();

    try {
        // Llamada Paralela para velocidad
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
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">No hay productos.</td></tr>';
        }

        // B. Renderizar Datos Gestión
        if (resGestion.success) {
            const data = resGestion.data;
            const cab = data.cabecera;
            const log = data.logistica;
            const listas = data.listas; 
            const pagos = data.pagos || [];
            
            // Guardar lista de clientes para el buscador
            clientesCacheLocal = data.clientes || [];

            // 1. Datos Cliente en Editar (Inicializar buscador con el actual)
            document.getElementById('txtGestionBusquedaCliente').value = cab.cliente_nombre || '';
            // No seteamos ID oculto para no disparar cambio si no toca nada, 
            // a menos que queramos asegurar la integridad. Lo dejamos vacío o con ID actual si viniera.

            // 2. Cálculos Financieros
            const total = Number(cab.total || 0);
            const delivery = Number(cab.costo_delivery || 0);
            const abonado = Number(cab.total_abonado || 0);
            const pendiente = Number(cab.saldo_calculado || 0);
            const subtotal = total - delivery;

            // Tab Resumen
            document.getElementById('lblResumenSubtotal').innerText = subtotal.toFixed(2);
            document.getElementById('lblResumenDelivery').innerText = delivery.toFixed(2);
            document.getElementById('lblResumenTotal').innerText = total.toFixed(2);
            document.getElementById('lblResumenAbonado').innerText = abonado.toFixed(2);
            
            // LÓGICA VISUAL DE DEUDA (Rojo vs Verde)
            const alertPendiente = document.getElementById('alertSaldoPendiente');
            const alertPagado = document.getElementById('alertSaldoPagado');
            
            if (pendiente <= 0.05) { // Margen de error céntimos
                alertPendiente.classList.add('d-none');
                alertPagado.classList.remove('d-none');
                document.getElementById('lblPagoPendiente').innerText = "0.00";
                document.getElementById('txtPagoMonto').value = ''; // Nada que pagar
            } else {
                alertPagado.classList.add('d-none');
                alertPendiente.classList.remove('d-none');
                document.getElementById('lblResumenPendiente').innerText = 'S/ ' + pendiente.toFixed(2);
                
                // Tab Pagos
                document.getElementById('lblPagoPendiente').innerText = 'S/ ' + pendiente.toFixed(2);
                document.getElementById('txtPagoMonto').value = pendiente.toFixed(2); // Sugerir pago total
            }
            
            document.getElementById('lblPagoAbonado').innerText = 'S/ ' + abonado.toFixed(2);

            // 3. Tabla Historial Pagos
            const tblPagos = document.getElementById('tblHistorialPagosBody');
            tblPagos.innerHTML = '';
            if (pagos.length > 0) {
                pagos.forEach(p => {
                    tblPagos.innerHTML += `
                        <tr>
                            <td class="small">${p.fecha}</td>
                            <td><span class="badge bg-light text-dark border">${p.metodo}</span></td>
                            <td class="small font-monospace">${p.operacion || '-'}</td>
                            <td class="small text-muted">${p.usuario || 'Sys'}</td>
                            <td class="text-end fw-bold text-success">S/ ${parseFloat(p.monto).toFixed(2)}</td>
                        </tr>`;
                });
            } else {
                tblPagos.innerHTML = '<tr><td colspan="5" class="text-center text-muted fst-italic py-3">Sin pagos registrados.</td></tr>';
            }

            // 4. Logística
            document.getElementById('swGestionDelivery').checked = log.es_delivery;
            toggleGestionDelivery();
            document.getElementById('txtGestionDireccion').value = log.direccion;
            document.getElementById('txtGestionReferencia').value = log.referencia;
            document.getElementById('txtGestionPersona').value = log.persona;
            document.getElementById('txtGestionContacto').value = log.contacto;
            document.getElementById('numGestionCostoDelivery').value = delivery;

            // 5. Galería y Selectores
            renderizarGaleria(data.multimedia);
            llenarSelect('selGestionVendedor', listas.vendedores, cab.id_vendedor);
            llenarSelectSimple('selGestionTipoEvento', listas.tiposEvento, cab.tipo_evento);
            
            // Estado (Fallback si viene vacío)
            const selEst = document.getElementById('selGestionEstado');
            if(selEst.options.length <= 1) { 
                 const estadosDefault = ["Nuevo Pedido", "Pendiente de Envio", "Pendiente Aprobación", "Aprobado", "En Producción", "Producto Listo", "Enviado", "Entregado", "Anulado", "Registro de Anulacion", "Pendiente de Pago"];
                 selEst.innerHTML = '';
                 estadosDefault.forEach(e => selEst.innerHTML += `<option value="${e}">${e}</option>`);
            }
            selEst.value = cab.estado;

            // Otros campos
            document.getElementById('selGestionTurno').value = cab.turno;
            document.getElementById('txtGestionIdentidad').value = cab.identidad;
            document.getElementById('txtGestionTematica').value = cab.texto_tematica;
            document.getElementById('txtGestionObs').value = cab.observaciones;
            document.getElementById('dateGestionEvento').value = cab.fecha_evento;
            document.getElementById('dateGestionEntrega').value = cab.fecha_entrega;

            // 6. Contrato
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
// 2. BUSCADOR PREDICTIVO DE CLIENTES
// =============================================================================

function buscarClientePredictivo() {
    const input = document.getElementById('txtGestionBusquedaCliente');
    const lista = document.getElementById('listaResultadosClientes');
    const query = input.value.trim().toUpperCase();

    // Limpiar ID si el usuario edita el texto manualmente
    document.getElementById('hdnGestionIdCliente').value = '';

    if (query.length < 2) {
        lista.style.display = 'none';
        return;
    }

    // Filtrar en memoria (rápido)
    const resultados = clientesCacheLocal.filter(c => c.texto && c.texto.includes(query)).slice(0, 10); // Top 10

    lista.innerHTML = '';
    if (resultados.length > 0) {
        lista.style.display = 'block';
        resultados.forEach(c => {
            // c.texto viene como "NOMBRE | DOC | CEL"
            const partes = c.texto.split('|');
            const nombre = partes[0].trim();
            const info = partes.slice(1).join(' | ');

            const item = document.createElement('a');
            item.className = 'list-group-item list-group-item-action cursor-pointer';
            item.innerHTML = `<strong>${nombre}</strong><br><small class="text-muted">${info}</small>`;
            item.onclick = () => seleccionarClienteBusqueda(c.id, nombre);
            lista.appendChild(item);
        });
    } else {
        lista.style.display = 'none';
    }
}

function seleccionarClienteBusqueda(id, nombre) {
    document.getElementById('txtGestionBusquedaCliente').value = nombre;
    document.getElementById('hdnGestionIdCliente').value = id;
    document.getElementById('listaResultadosClientes').style.display = 'none';
}

// Ocultar lista al hacer clic fuera
document.addEventListener('click', function(event) {
    const lista = document.getElementById('listaResultadosClientes');
    const input = document.getElementById('txtGestionBusquedaCliente');
    if (event.target !== input && event.target !== lista) {
        lista.style.display = 'none';
    }
});

// =============================================================================
// 3. PAGOS Y REGISTRO
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
    
    // Leer el saldo pendiente actual del label rojo
    const textoPend = document.getElementById('lblPagoPendiente').innerText.replace('S/ ', '').trim();
    const pendienteActual = parseFloat(textoPend) || 0;

    if(!monto || monto <= 0) {
        alert("⚠️ Ingresa un monto válido.");
        return;
    }

    let msgConfirm = `¿Confirmar pago de S/ ${monto.toFixed(2)}?`;
    if (monto > (pendienteActual + 0.1)) {
        msgConfirm = `⚠️ ALERTA DE SOBREPAGO\n\nEstás pagando S/ ${monto.toFixed(2)} y la deuda es solo S/ ${pendienteActual.toFixed(2)}.\n\n¿Deseas continuar?`;
    }

    if(!confirm(msgConfirm)) return;

    const btn = document.querySelector('#tab-pagos button.btn-success');
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
            alert("✅ Pago registrado.");
            abrirGestionTicket(currentTicketID); // Recargar para ver historial y saldos nuevos
            if(typeof cargarVentasArzuka === 'function') cargarVentasArzuka(); // Actualizar dashboard
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
// 4. EDICIÓN Y BLOQUEO POR DEUDA
// =============================================================================

async function guardarEdicion() {
    const nuevoEstado = document.getElementById('selGestionEstado').value;
    
    // Leer Deuda desde el Label Pendiente
    const textoPend = document.getElementById('lblPagoPendiente').innerText.replace('S/ ', '').trim();
    const deuda = parseFloat(textoPend) || 0;

    // Regla de Bloqueo
    const estadosRestringidos = ['Entregado', 'Enviado'];
    if (estadosRestringidos.includes(nuevoEstado) && deuda > 0.50) { 
        alert(`⛔ BLOQUEO POR DEUDA ⛔\n\nEl cliente debe S/ ${deuda.toFixed(2)}.\nNo puedes cambiar a "${nuevoEstado}" hasta que pague.`);
        return; 
    }

    if (!confirm("¿Actualizar datos del pedido?")) return;
    
    const usuario = JSON.parse(localStorage.getItem("erp_usuario"));
    
    // Recopilar datos, incluyendo posible cambio de cliente
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
        observaciones: document.getElementById('txtGestionObs').value,
        
        // Datos Cliente (Si se seleccionó uno nuevo en el buscador)
        id_cliente: document.getElementById('hdnGestionIdCliente').value,
        nombre_cliente: document.getElementById('txtGestionBusquedaCliente').value
    };

    try {
        const res = await callAPI('ventas', 'editarDatosTicket', payload);
        if (res.success) {
            alert("✅ Datos actualizados.");
            // Si hubo cambio de cliente, recargamos para asegurar consistencia
            if (payload.id_cliente) abrirGestionTicket(currentTicketID);
            if(typeof cargarVentasArzuka === 'function') cargarVentasArzuka();
        } else {
            alert("⛔ Error: " + res.error);
        }
    } catch (e) { alert("Error de conexión."); }
}

// =============================================================================
// 5. UTILIDADES UI, FOTOS, ETC. (Estándar)
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
    btn.disabled = true; btn.innerHTML = 'Guardando...';
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
        if (res.success) { alert("✅ Logística guardada."); abrirGestionTicket(currentTicketID); } 
        else alert("❌ " + res.error);
    } catch (e) { alert("Error conexión"); }
    finally { btn.disabled = false; btn.innerHTML = 'Guardar Datos Delivery'; }
}

function clickInputFoto() { document.getElementById('fileGestionFoto').click(); }

async function subirFotoSeleccionada() {
    const input = document.getElementById('fileGestionFoto');
    if (input.files.length === 0) return;
    const comentario = prompt("Descripción:", "Referencia");
    if (comentario === null) { input.value = ''; return; }
    const reader = new FileReader();
    reader.readAsDataURL(input.files[0]);
    reader.onload = async function () {
        const base64 = reader.result.split(',')[1];
        try {
            await callAPI('ventas', 'subirFotoReferencia', { id_ticket: currentTicketID, base64: base64, mimeType: input.files[0].type, comentario: comentario });
            abrirGestionTicket(currentTicketID);
        } catch (e) { alert("Error red"); }
        input.value = '';
    };
}

async function guardarComentarioFoto(urlOriginal, inputId) {
    const comentario = document.getElementById(inputId).value;
    try {
        await callAPI('ventas', 'actualizarComentarioFoto', { url: urlOriginal, comentario: comentario });
        alert("Comentario guardado.");
    } catch (e) { alert("Error red"); }
}

function renderizarGaleria(fotos) {
    const container = document.getElementById('galeriaFotos');
    container.innerHTML = '';
    if (!fotos || fotos.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-5">No hay fotos cargadas.</div>';
        return;
    }
    fotos.forEach((f, index) => {
        let imgUrl = f.url;
        if (imgUrl.includes('drive.google.com') && imgUrl.includes('id=')) {
            const idMatch = imgUrl.match(/id=([a-zA-Z0-9_-]+)/);
            if (idMatch) imgUrl = `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
        }
        container.innerHTML += `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="card h-100 shadow-sm border">
                    <div style="height: 160px; overflow: hidden; position: relative;" class="bg-light d-flex align-items-center justify-content-center cursor-pointer" onclick="window.open('${f.url}', '_blank')">
                        <img src="${imgUrl}" class="w-100 h-100" style="object-fit: cover;">
                        <div class="position-absolute bottom-0 start-0 w-100 bg-dark bg-opacity-50 text-white text-center small py-1">Ver Original</div>
                    </div>
                    <div class="card-body p-2">
                        <textarea class="form-control form-control-sm mb-2" id="comment_${index}" rows="2">${f.comentario || ''}</textarea>
                        <button class="btn btn-sm btn-outline-success w-100" onclick="guardarComentarioFoto('${f.url}', 'comment_${index}')">Guardar</button>
                    </div>
                </div>
            </div>`;
    });
}

async function generarContrato() {
    try {
        const res = await callAPI('ventas', 'generarContrato', { id_ticket: currentTicketID });
        if (res.success) {
            document.getElementById('divContratoActions').classList.add('d-none');
            document.getElementById('divContratoLink').classList.remove('d-none');
            document.getElementById('linkContratoFinal').href = res.url;
        } else alert("❌ " + res.error);
    } catch (e) { alert("Error red"); }
}
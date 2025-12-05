/**
 * js/gestion_tickets.js
 * Lógica del Frontend para la Super Ventana de Gestión.
 * VERSIÓN FINAL CORREGIDA: Galería de Fotos Visible.
 */

let currentTicketID = null;
let clientesCacheLocal = []; 

// =============================================================================
// 1. ABRIR Y CARGAR EL MODAL
// =============================================================================
async function abrirGestionTicket(idTicket) {
    currentTicketID = idTicket;
    
    const modalEl = document.getElementById('modalGestionTicket');
    const modal = new bootstrap.Modal(modalEl);
    
    // Reset UI
    document.getElementById('lblGestionTicketID').innerText = idTicket;
    
    const spinner = '<div class="spinner-border spinner-border-sm text-secondary"></div>';
    document.getElementById('tblGestionProductos').innerHTML = `<tr><td colspan="3" class="text-center py-3">${spinner}</td></tr>`;
    document.getElementById('tblHistorialPagosBody').innerHTML = `<tr><td colspan="5" class="text-center py-3">${spinner}</td></tr>`;
    document.getElementById('galeriaFotos').innerHTML = '<div class="col-12 text-center text-muted">Cargando fotos...</div>';
    
    ['lblResumenSubtotal', 'lblResumenDelivery', 'lblResumenTotal', 'lblResumenAbonado', 'lblResumenPendiente', 'lblPagoAbonado', 'lblPagoPendiente'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerText = '...';
    });

    document.getElementById('txtPagoMonto').value = '';
    document.getElementById('txtPagoOperacion').value = '';
    document.getElementById('filePagoVoucher').value = '';
    document.getElementById('lblFotoVoucher').innerText = 'Seleccionar imagen...';
    
    document.getElementById('alertSaldoPendiente').classList.add('d-none');
    document.getElementById('alertSaldoPagado').classList.add('d-none');
    document.getElementById('txtGestionBusquedaCliente').value = '';
    document.getElementById('hdnGestionIdCliente').value = '';
    document.getElementById('listaResultadosClientes').style.display = 'none';

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
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">No hay productos.</td></tr>';
        }

        // B. Renderizar Datos Gestión
        if (resGestion.success) {
            const data = resGestion.data;
            const cab = data.cabecera;
            const log = data.logistica;
            const listas = data.listas; 
            const pagos = data.pagos || [];
            
            clientesCacheLocal = data.clientes || [];

            document.getElementById('txtGestionBusquedaCliente').value = cab.cliente_nombre || '';

            const total = Number(cab.total || 0);
            const delivery = Number(cab.costo_delivery || 0);
            const abonado = Number(cab.total_abonado || 0);
            const pendiente = Number(cab.saldo_calculado || 0);
            const subtotal = total - delivery;

            actualizarInterfazSaldos(total, subtotal, delivery, abonado, pendiente);

            const tblPagos = document.getElementById('tblHistorialPagosBody');
            tblPagos.innerHTML = '';
            if (pagos.length > 0) {
                pagos.forEach(p => {
                    tblPagos.innerHTML += crearFilaPagoHTML(p.fecha, p.metodo, p.operacion, p.usuario, p.monto);
                });
            } else {
                tblPagos.innerHTML = '<tr><td colspan="5" class="text-center text-muted fst-italic py-3">Sin pagos registrados.</td></tr>';
            }

            document.getElementById('swGestionDelivery').checked = log.es_delivery;
            toggleGestionDelivery();
            document.getElementById('txtGestionDireccion').value = log.direccion;
            document.getElementById('txtGestionReferencia').value = log.referencia;
            document.getElementById('txtGestionPersona').value = log.persona;
            document.getElementById('txtGestionContacto').value = log.contacto;
            document.getElementById('numGestionCostoDelivery').value = delivery;

            // *** AQUÍ RENDERIZAMOS LA GALERÍA ***
            renderizarGaleria(data.multimedia);

            llenarSelect('selGestionVendedor', listas.vendedores, cab.id_vendedor);
            llenarSelectSimple('selGestionTipoEvento', listas.tiposEvento, cab.tipo_evento);
            
            const selEst = document.getElementById('selGestionEstado');
            if(selEst.options.length <= 1) { 
                 const estadosDefault = ["Nuevo Pedido", "Pendiente de Envio", "Pendiente Aprobación", "Aprobado", "En Producción", "Producto Listo", "Enviado", "Entregado", "Anulado", "Registro de Anulacion", "Pendiente de Pago"];
                 selEst.innerHTML = '';
                 estadosDefault.forEach(e => selEst.innerHTML += `<option value="${e}">${e}</option>`);
            }
            selEst.value = cab.estado;

            document.getElementById('selGestionTurno').value = cab.turno;
            document.getElementById('txtGestionIdentidad').value = cab.identidad;
            document.getElementById('txtGestionTematica').value = cab.texto_tematica;
            document.getElementById('txtGestionObs').value = cab.observaciones;
            document.getElementById('dateGestionEvento').value = cab.fecha_evento;
            document.getElementById('dateGestionEntrega').value = cab.fecha_entrega;

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
        }
    } catch (e) { console.error(e); }
}

// === NUEVA FUNCIÓN CORREGIDA PARA GALERÍA ===
function renderizarGaleria(fotos) {
    const contenedor = document.getElementById('galeriaFotos');
    contenedor.innerHTML = '';

    if (!fotos || fotos.length === 0) {
        contenedor.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="bi bi-images fs-1 d-block mb-2"></i>No hay fotos cargadas.</div>';
        return;
    }

    fotos.forEach((foto, index) => {
        // Convertir URL de descarga a URL de vista para la miniatura
        const urlVista = _ticketConvertirUrlDrive(foto.url);
        
        contenedor.innerHTML += `
            <div class="col-md-4 col-sm-6">
                <div class="card h-100 shadow-sm">
                    <div style="height: 180px; overflow: hidden; background: #f0f0f0;">
                        <img src="${urlVista}" class="card-img-top" style="height: 100%; object-fit: cover; cursor: pointer;" 
                             onclick="window.open('${foto.url}', '_blank')">
                    </div>
                    <div class="card-body p-2">
                        <small class="text-muted d-block text-truncate fw-bold">${foto.tipo || 'Foto'}</small>
                        <p class="card-text small mb-1">${foto.comentario || 'Sin comentario'}</p>
                        <div class="d-flex justify-content-between align-items-center mt-2">
                            <small class="text-muted" style="font-size: 0.7rem">${foto.fecha || ''}</small>
                            <button class="btn btn-sm btn-light border" onclick="guardarComentarioFoto('${foto.url}', 'inputComent${index}')"><i class="bi bi-save"></i></button>
                        </div>
                        <input type="text" id="inputComent${index}" class="form-control form-control-sm mt-1" placeholder="Editar comentario..." value="${foto.comentario || ''}">
                    </div>
                </div>
            </div>
        `;
    });
}

function _ticketConvertirUrlDrive(url) {
    if (!url) return "";
    let id = "";
    const regex1 = /\/file\/d\/([a-zA-Z0-9_-]+)/;
    const regex2 = /id=([a-zA-Z0-9_-]+)/;
    const match1 = url.match(regex1);
    const match2 = url.match(regex2);
    if (match1 && match1[1]) id = match1[1];
    else if (match2 && match2[1]) id = match2[1];

    if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    return url;
}

// ... (Resto del código original de pagos, sálculos y edición) ...

function actualizarInterfazSaldos(total, subtotal, delivery, abonado, pendiente) {
    document.getElementById('lblResumenSubtotal').innerText = subtotal.toFixed(2);
    document.getElementById('lblResumenDelivery').innerText = delivery.toFixed(2);
    document.getElementById('lblResumenTotal').innerText = total.toFixed(2);
    document.getElementById('lblResumenAbonado').innerText = abonado.toFixed(2);
    
    document.getElementById('lblPagoAbonado').innerText = 'S/ ' + abonado.toFixed(2);
    document.getElementById('lblPagoPendiente').innerText = 'S/ ' + pendiente.toFixed(2);
    
    const alertPendiente = document.getElementById('alertSaldoPendiente');
    const alertPagado = document.getElementById('alertSaldoPagado');
    
    if (pendiente <= 0.05) { 
        alertPendiente.classList.add('d-none');
        alertPagado.classList.remove('d-none');
        document.getElementById('lblPagoPendiente').innerText = "0.00";
        document.getElementById('txtPagoMonto').value = ''; 
    } else {
        alertPagado.classList.add('d-none');
        alertPendiente.classList.remove('d-none');
        document.getElementById('lblResumenPendiente').innerText = 'S/ ' + pendiente.toFixed(2);
        document.getElementById('txtPagoMonto').value = pendiente.toFixed(2);
    }
}

function crearFilaPagoHTML(fecha, metodo, operacion, usuario, monto) {
    return `
        <tr class="anim-fade-in">
            <td class="small">${fecha}</td>
            <td><span class="badge bg-light text-dark border">${metodo}</span></td>
            <td class="small font-monospace">${operacion || '-'}</td>
            <td class="small text-muted">${usuario || 'Web'}</td>
            <td class="text-end fw-bold text-success">S/ ${parseFloat(monto).toFixed(2)}</td>
        </tr>`;
}

function buscarClientePredictivo() {
    const input = document.getElementById('txtGestionBusquedaCliente');
    const lista = document.getElementById('listaResultadosClientes');
    const query = input.value.trim().toUpperCase();

    document.getElementById('hdnGestionIdCliente').value = '';

    if (query.length < 2) {
        lista.style.display = 'none';
        return;
    }

    const resultados = clientesCacheLocal.filter(c => c.texto && c.texto.includes(query)).slice(0, 10);

    lista.innerHTML = '';
    if (resultados.length > 0) {
        lista.style.display = 'block';
        resultados.forEach(c => {
            const partes = c.texto.split('|');
            const nombre = partes[0].trim();
            const info = partes.slice(1).join(' | ');
            const item = document.createElement('a');
            item.className = 'list-group-item list-group-item-action cursor-pointer';
            item.innerHTML = `<strong>${nombre}</strong><br><small class="text-muted">${info}</small>`;
            item.onclick = () => {
                document.getElementById('txtGestionBusquedaCliente').value = nombre;
                document.getElementById('hdnGestionIdCliente').value = c.id;
                lista.style.display = 'none';
            };
            lista.appendChild(item);
        });
    } else {
        lista.style.display = 'none';
    }
}

document.addEventListener('click', function(event) {
    const lista = document.getElementById('listaResultadosClientes');
    const input = document.getElementById('txtGestionBusquedaCliente');
    if (event.target !== input && event.target !== lista) lista.style.display = 'none';
});

function previewVoucherName() {
    const input = document.getElementById('filePagoVoucher');
    const lbl = document.getElementById('lblFotoVoucher');
    if(input.files.length > 0) lbl.innerText = input.files[0].name;
    else lbl.innerText = 'Seleccionar imagen...';
}

async function registrarPago() {
    const inputMonto = document.getElementById('txtPagoMonto');
    const monto = parseFloat(inputMonto.value);
    
    const getVal = (id) => parseFloat(document.getElementById(id).innerText.replace(/[^\d.-]/g, '')) || 0;
    const pendienteActual = getVal('lblPagoPendiente');
    const abonadoActual = getVal('lblPagoAbonado');
    const totalVenta = getVal('lblResumenTotal');
    const delivery = getVal('lblResumenDelivery');
    const subtotal = getVal('lblResumenSubtotal');

    if(!monto || monto <= 0) {
        alert("⚠️ Ingresa un monto válido.");
        return;
    }

    if (monto > (pendienteActual + 0.1)) {
        if(!confirm(`⚠️ ALERTA: El pago excede la deuda actual (S/ ${pendienteActual.toFixed(2)}). ¿Continuar?`)) return;
    }

    const btn = document.querySelector('#tab-pagos button.btn-success');
    const originalText = btn.innerHTML;
    btn.disabled = true; 
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

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

    const metodo = document.getElementById('selPagoMetodo').value;
    const operacion = document.getElementById('txtPagoOperacion').value;

    const payload = {
        id_ticket: currentTicketID,
        monto: monto,
        metodo: metodo,
        nro_operacion: operacion,
        usuario: usuario ? usuario.usuario : 'Web',
        base64: base64,
        mimeType: mimeType
    };

    try {
        const res = await callAPI('finanzas', 'registrarPagoWeb', payload);
        
        if (res.success) {
            const nuevoAbonado = abonadoActual + monto;
            const nuevoPendiente = pendienteActual - monto;

            actualizarInterfazSaldos(totalVenta, subtotal, delivery, nuevoAbonado, nuevoPendiente);

            const tbody = document.getElementById('tblHistorialPagosBody');
            if(tbody.innerText.includes('Sin pagos')) tbody.innerHTML = '';
            
            const fechaHoy = new Date().toLocaleDateString('es-PE') + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const nuevaFilaHTML = crearFilaPagoHTML(fechaHoy, metodo, operacion, usuario ? usuario.usuario : 'Yo', monto);
            
            tbody.insertAdjacentHTML('afterbegin', nuevaFilaHTML);
            const insertedRow = tbody.firstElementChild;
            insertedRow.style.backgroundColor = '#d1e7dd'; 
            setTimeout(() => insertedRow.style.backgroundColor = 'transparent', 2000);

            document.getElementById('filePagoVoucher').value = '';
            document.getElementById('lblFotoVoucher').innerText = 'Seleccionar imagen...';
            document.getElementById('txtPagoOperacion').value = '';
            
            if(typeof cargarVentasArzuka === 'function') cargarVentasArzuka();

        } else {
            alert("⛔ Error: " + res.error);
        }
    } catch (e) {
        alert("Error de conexión: " + e.message);
    } finally {
        btn.disabled = false; 
        btn.innerHTML = originalText;
    }
}

async function guardarEdicion() {
    const nuevoEstado = document.getElementById('selGestionEstado').value;
    const textoPend = document.getElementById('lblPagoPendiente').innerText.replace(/[^\d.-]/g, '');
    const deuda = parseFloat(textoPend) || 0;

    const estadosRestringidos = ['Entregado', 'Enviado'];
    if (estadosRestringidos.includes(nuevoEstado) && deuda > 0.50) { 
        alert(`⛔ BLOQUEO: El cliente debe S/ ${deuda.toFixed(2)}. No puedes cambiar a "${nuevoEstado}".`);
        return; 
    }

    if (!confirm("¿Guardar cambios?")) return;
    
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
        observaciones: document.getElementById('txtGestionObs').value,
        id_cliente: document.getElementById('hdnGestionIdCliente').value,
        nombre_cliente: document.getElementById('txtGestionBusquedaCliente').value
    };

    try {
        const res = await callAPI('ventas', 'editarDatosTicket', payload);
        if (res.success) {
            alert("✅ Guardado.");
            if(payload.id_cliente) abrirGestionTicket(currentTicketID); 
            if(typeof cargarVentasArzuka === 'function') cargarVentasArzuka();
        } else { alert("⛔ Error: " + res.error); }
    } catch (e) { alert("Error conexión."); }
}

function llenarSelect(id, data, val) { const s=document.getElementById(id); s.innerHTML='<option value="">-</option>'; if(data) data.forEach(i=>{ s.innerHTML+=`<option value="${i.id||i}">${i.nombre||i}</option>`; }); s.value=val; }
function llenarSelectSimple(id, data, val) { const s=document.getElementById(id); s.innerHTML='<option value="">-</option>'; if(data) data.forEach(i=>{ s.innerHTML+=`<option value="${i}">${i}</option>`; }); s.value=val; }
function toggleGestionDelivery() { const c=document.getElementById('swGestionDelivery').checked; document.getElementById('panelGestionDelivery').classList.toggle('d-none', !c); }
function copiarDatosClienteDelivery() { if(currentClientData.nombre) document.getElementById('txtGestionPersona').value=currentClientData.nombre; if(currentClientData.celular) document.getElementById('txtGestionContacto').value=currentClientData.celular; }
async function guardarLogistica() {
    const btn = document.querySelector('#panelGestionDelivery .btn-primary'); btn.disabled=true; btn.innerText='Guardando...';
    try {
        const res=await callAPI('ventas','guardarLogisticaTicket',{
            id_ticket: currentTicketID, es_delivery: document.getElementById('swGestionDelivery').checked,
            direccion: document.getElementById('txtGestionDireccion').value, referencia: document.getElementById('txtGestionReferencia').value,
            persona_recibe: document.getElementById('txtGestionPersona').value, contacto: document.getElementById('txtGestionContacto').value,
            costo_delivery: document.getElementById('numGestionCostoDelivery').value
        });
        if(res.success){ alert("✅ Guardado"); abrirGestionTicket(currentTicketID); } else alert(res.error);
    } catch(e){alert("Error red");} finally{ btn.disabled=false; btn.innerText='Guardar Datos Delivery'; }
}
function clickInputFoto() { document.getElementById('fileGestionFoto').click(); }
async function subirFotoSeleccionada() {
    const f=document.getElementById('fileGestionFoto').files[0]; if(!f)return;
    const c=prompt("Descripción:","Referencia"); if(c===null)return;
    const r=new FileReader(); r.readAsDataURL(f);
    r.onload=async()=>{ try{ await callAPI('ventas','subirFotoReferencia',{id_ticket:currentTicketID, base64:r.result.split(',')[1], mimeType:f.type, comentario:c}); abrirGestionTicket(currentTicketID); }catch(e){alert("Error");} };
}
async function guardarComentarioFoto(u,i){ try{ await callAPI('ventas','actualizarComentarioFoto',{url:u, comentario:document.getElementById(i).value}); alert("Ok"); }catch(e){} }
async function generarContrato(){ try{ const r=await callAPI('ventas','generarContrato',{id_ticket:currentTicketID}); if(r.success) document.getElementById('linkContratoFinal').href=r.url; document.getElementById('divContratoLink').classList.remove('d-none'); }catch(e){} }
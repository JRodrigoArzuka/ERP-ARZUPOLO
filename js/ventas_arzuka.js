/**
 * js/ventas_arzuka.js
 * Lógica del Dashboard, Gráficos y Creación de Ventas.
 */

// =============================================================================
// 1. SECCIÓN DASHBOARD (KPIs, Tabla y Gráfico)
// =============================================================================

/**
 * Carga los datos del día actual desde el Backend
 */
async function cargarVentasArzuka() {
    const tbody = document.getElementById('tablaVentasBody');
    const kpiTotal = document.getElementById('kpiVentasHoy');
    const kpiTickets = document.getElementById('kpiTicketsHoy');
    const kpiPendiente = document.getElementById('kpiPendienteHoy');
    
    if(tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary"></div><br>Cargando datos...</td></tr>';

    try {
        const res = await callAPI('ventas', 'obtenerReporteVentasDia');

        if (res.success) {
            // A. Actualizar KPIs
            kpiTotal.innerText = `S/ ${parseFloat(res.kpis.total).toFixed(2)}`;
            kpiTickets.innerText = res.kpis.tickets;
            kpiPendiente.innerText = `S/ ${parseFloat(res.kpis.pendiente).toFixed(2)}`;

            // B. Actualizar Tabla
            tbody.innerHTML = '';
            if (res.ventas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay ventas registradas hoy.</td></tr>';
                if(window.chartVentasInstancia) { window.chartVentasInstancia.destroy(); window.chartVentasInstancia = null; }
            } else {
                const ventasCronologicas = [...res.ventas].reverse(); 
                renderizarGrafico(ventasCronologicas);

                res.ventas.forEach(venta => {
                    let badgeColor = 'bg-secondary';
                    if (venta.estado === 'Pagado' || venta.estado === 'Entregado') badgeColor = 'bg-success';
                    if (venta.estado === 'Pendiente') badgeColor = 'bg-warning text-dark';
                    if (venta.estado === 'Anulado') badgeColor = 'bg-danger';

                    // NOTA: Aquí usamos abrirGestionTicket del otro script (gestion_tickets.js)
                    const fila = `
                        <tr>
                            <td class="fw-bold text-primary">${venta.ticket}</td>
                            <td class="small">${venta.fecha}</td>
                            <td>${venta.cliente}</td>
                            <td class="fw-bold">S/ ${parseFloat(venta.total).toFixed(2)}</td>
                            <td><span class="badge ${badgeColor}">${venta.estado}</span></td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" onclick="abrirGestionTicket('${venta.ticket}')" title="Gestionar">
                                    <i class="bi bi-gear-fill"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.insertAdjacentHTML('beforeend', fila);
                });
            }
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error: ${res.error}</td></tr>`;
        }

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Fallo de conexión.</td></tr>';
    }
}

/**
 * Dibuja el gráfico de línea verde
 */
function renderizarGrafico(datosVentas) {
    const ctx = document.getElementById('graficoVentas');
    if(!ctx) return;

    const etiquetas = datosVentas.map(v => v.fecha.split(' ')[1]); 
    const valores = datosVentas.map(v => v.total);

    if (window.chartVentasInstancia) window.chartVentasInstancia.destroy();

    window.chartVentasInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Venta (S/)',
                data: valores,
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: true, borderDash: [5, 5] } },
                x: { grid: { display: false } }
            }
        }
    });
}

// =============================================================================
// 2. SINCRONIZACIÓN LOYVERSE (CORREGIDO)
// =============================================================================

async function sincronizarLoyverse() {
    const btn = document.querySelector('button[onclick="sincronizarLoyverse()"]');
    const originalText = btn ? btn.innerHTML : 'Sincronizar';
    
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sincronizando...';
    }
    
    try {
        // CORRECCIÓN AQUÍ: El segundo parámetro debe ser 'sincronizarLoyverse'
        // para coincidir con el 'case' de tu API_Handler_ARZUKA.gs
        const res = await callAPI('sincronizarLoyverse', 'sincronizarLoyverse');
        
        if (res.success) {
            alert(res.message);
            cargarVentasArzuka(); // Recargar tabla
        } else {
            alert("⚠️ " + res.error);
        }
    } catch (e) {
        alert("Error de conexión: " + e.message);
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// =============================================================================
// 3. NUEVA VENTA MANUAL (Formulario)
// =============================================================================

let clientesCache = [];

async function abrirModalNuevaVenta() {
    document.getElementById('formVenta').reset();
    document.getElementById('bodyTablaVentas').innerHTML = '';
    document.getElementById('lblTotalVenta').innerText = '0.00';
    document.getElementById('lblSaldoPendiente').innerText = '0.00';
    document.getElementById('divDelivery').classList.add('d-none');
    document.getElementById('dateEntrega').value = new Date().toISOString().split('T')[0];

    const modal = new bootstrap.Modal(document.getElementById('modalNuevaVenta'));
    modal.show();
    agregarLineaProducto();

    // Cargar Maestros
    try {
        const selectEvento = document.getElementById('selTipoEvento');
        if (selectEvento.options.length <= 1) {
            const datos = await callAPI('ventas', 'obtenerMaestrosVentas');
            if(datos.success) {
                llenarSelect('selTipoEvento', datos.config.Tipo_Evento);
                llenarSelect('selMetodoPago', datos.config.Metodo_Pago);
                clientesCache = datos.clientes; 
                const dataList = document.getElementById('listaClientes');
                dataList.innerHTML = '';
                datos.clientes.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.nombre; 
                    opt.setAttribute('data-id', c.id); 
                    dataList.appendChild(opt);
                });
            }
        }
    } catch (e) { console.error(e); }
}

function llenarSelect(id, data) {
    const sel = document.getElementById(id);
    sel.innerHTML = '';
    data.forEach(d => {
        sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
}

function toggleDelivery() {
    const chk = document.getElementById('chkDelivery');
    const div = document.getElementById('divDelivery');
    if(chk.checked) div.classList.remove('d-none'); else div.classList.add('d-none');
}

function agregarLineaProducto() {
    const tbody = document.getElementById('bodyTablaVentas');
    const index = Date.now();
    const row = `
        <tr id="fila_${index}">
            <td><input type="text" class="form-control form-control-sm desc-prod" placeholder="Producto"></td>
            <td><input type="number" class="form-control form-control-sm text-center cant-prod" value="1" oninput="calcularTotales()"></td>
            <td><input type="number" class="form-control form-control-sm text-end precio-prod" placeholder="0.00" oninput="calcularTotales()"></td>
            <td class="text-end fw-bold subtotal-prod">0.00</td>
            <td class="text-center"><button type="button" class="btn btn-link text-danger p-0" onclick="this.closest('tr').remove();calcularTotales()"><i class="bi bi-trash"></i></button></td>
        </tr>`;
    tbody.insertAdjacentHTML('beforeend', row);
}

function calcularTotales() {
    let total = 0;
    document.querySelectorAll('#bodyTablaVentas tr').forEach(row => {
        const cant = parseFloat(row.querySelector('.cant-prod').value) || 0;
        const precio = parseFloat(row.querySelector('.precio-prod').value) || 0;
        const sub = cant * precio;
        row.querySelector('.subtotal-prod').innerText = sub.toFixed(2);
        total += sub;
    });
    document.getElementById('lblTotalVenta').innerText = total.toFixed(2);
    calcularSaldo();
}

function calcularSaldo() {
    const total = parseFloat(document.getElementById('lblTotalVenta').innerText) || 0;
    const aCuenta = parseFloat(document.getElementById('txtACuenta').value) || 0;
    let saldo = total - aCuenta;
    if (saldo < 0) saldo = 0;
    document.getElementById('lblSaldoPendiente').innerText = saldo.toFixed(2);
}

async function guardarVenta() {
    const btn = document.querySelector('#modalNuevaVenta .btn-success');
    
    // Validaciones
    const cliente = document.getElementById('txtClienteBuscar').value;
    if(!cliente) { alert("Falta Cliente"); return; }
    
    const items = [];
    document.querySelectorAll('#bodyTablaVentas tr').forEach(row => {
        const nom = row.querySelector('.desc-prod').value;
        const pre = parseFloat(row.querySelector('.precio-prod').value);
        const cant = parseFloat(row.querySelector('.cant-prod').value);
        if(nom && pre) items.push({ nombre: nom, cantidad: cant, precio_unitario: pre, subtotal: cant*pre });
    });
    
    if(items.length === 0) { alert("Agrega productos válidos"); return; }

    // Enviar
    btn.disabled = true; btn.innerText = "Guardando...";
    
    // Buscar ID cliente existente
    const clienteObj = clientesCache.find(c => c.nombre === cliente);
    const idCliente = clienteObj ? clienteObj.id : ('NUEVO-' + Date.now());

    const payload = {
        cabecera: {
            id_cliente: idCliente,
            nombre_cliente: cliente,
            id_vendedor: 'WEB',
            observaciones: document.getElementById('txtObservaciones').value
        },
        totales: {
            total_venta: parseFloat(document.getElementById('lblTotalVenta').innerText),
            saldo_pendiente: parseFloat(document.getElementById('lblSaldoPendiente').innerText)
        },
        evento: {
            tipo: document.getElementById('selTipoEvento').value,
            fecha: document.getElementById('dateEntrega').value,
            turno: ''
        },
        entrega: {
            es_delivery: document.getElementById('chkDelivery').checked,
            direccion: document.getElementById('txtDireccion').value,
            referencia: document.getElementById('txtReferencia').value,
            persona_recibe: cliente,
            celular_contacto: ''
        },
        detalle: items
    };

    try {
        const res = await callAPI('ventas', 'registrarVenta', payload);
        if(res.success) {
            alert("✅ Venta registrada: " + res.data.id_ticket);
            bootstrap.Modal.getInstance(document.getElementById('modalNuevaVenta')).hide();
            cargarVentasArzuka();
        } else {
            alert("Error: " + res.error);
        }
    } catch(e) {
        alert("Error red: " + e.message);
    } finally {
        btn.disabled = false; btn.innerText = "REGISTRAR";
    }
}
/**
 * js/ventas_arzuka.js
 * Lógica del Dashboard Comercial.
 * ACTUALIZADO: Filtro Mes Actual por defecto, Botón "Hoy" y Colores.
 */

let chartInstancia = null;
let filtrosCargados = false;

// =============================================================================
// 1. INICIALIZACIÓN Y FILTROS
// =============================================================================

async function cargarVentasArzuka() {
    // 1. Configurar fechas por defecto (MES ACTUAL) si están vacías
    if (!document.getElementById('filtroFechaDesde').value) {
        const date = new Date();
        // Primer día del mes
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        // Último día del mes
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        // Helper para formato YYYY-MM-DD
        const fmt = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        
        document.getElementById('filtroFechaDesde').value = fmt(firstDay);
        document.getElementById('filtroFechaHasta').value = fmt(lastDay);
    }

    // 2. Cargar listas maestras (solo la primera vez)
    if (!filtrosCargados) {
        await cargarListasMaestrasFiltros();
        filtrosCargados = true;
    }

    // 3. Construir Payload
    const payload = {
        fechaDesde: document.getElementById('filtroFechaDesde').value,
        fechaHasta: document.getElementById('filtroFechaHasta').value,
        vendedor: document.getElementById('filtroVendedor').value,
        estado: document.getElementById('filtroEstado').value,
        evento: document.getElementById('filtroEvento').value,
        turno: document.getElementById('filtroTurno').value,
        pago: document.getElementById('filtroPago').value
    };

    const tbody = document.getElementById('tablaVentasBody');
    // Spinner suave
    if(tbody.children.length <= 1 || tbody.innerHTML.includes('Error')) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary"></div><br>Cargando mes actual...</td></tr>';
    }

    try {
        const res = await callAPI(
            'ventas', 
            'obtenerVentasFiltradas', 
            payload, 
            (datosFrescos) => {
                if(datosFrescos.success) actualizarDashboard(datosFrescos.ventas, datosFrescos.resumen);
            }
        );

        if (res && res.success) {
            actualizarDashboard(res.ventas, res.resumen);
        } else if (res && !res.success) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error: ${res.error}</td></tr>`;
        }

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error de conexión.</td></tr>';
    }
}

// NUEVA FUNCIÓN: Botón "Entregas Hoy"
function filtrarEntregasHoy() {
    const hoy = new Date();
    const fmt = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const hoyStr = fmt(hoy);
    
    // Setear fechas a HOY
    document.getElementById('filtroFechaDesde').value = hoyStr;
    document.getElementById('filtroFechaHasta').value = hoyStr;
    
    // Limpiar otros filtros para ver todo lo de hoy
    document.getElementById('filtroEstado').value = '';
    
    // Recargar
    cargarVentasArzuka();
}

async function cargarListasMaestrasFiltros() {
    try {
        const res = await callAPI('ventas', 'obtenerMaestrosVentas', {}, { useCache: true, ttl: 300 });
        if (res.success) {
            // A. Vendedores
            const selV = document.getElementById('filtroVendedor');
            const valV = selV.value;
            selV.innerHTML = '<option value="Todos">Todos los vendedores</option>';
            if(res.vendedores) {
                res.vendedores.forEach(v => selV.innerHTML += `<option value="${v.nombre}">${v.nombre}</option>`);
            }
            selV.value = valV;

            // B. Estados (Con soporte de color JSON)
            const selE = document.getElementById('filtroEstado');
            selE.innerHTML = '<option value="">Todos</option>';
            if(res.config && res.config.Estado_Pedido) {
                res.config.Estado_Pedido.forEach(item => {
                    let nombre = item;
                    try { if(item.trim().startsWith('{')) nombre = JSON.parse(item).nombre; } catch(e){}
                    selE.innerHTML += `<option value="${nombre}">${nombre}</option>`;
                });
            }

            // C. Otros Filtros
            llenarSelectSimple('filtroEvento', res.config.Tipo_Evento || []);
            llenarSelectSimple('filtroTurno', res.config.Turno || []);
            llenarSelectSimple('filtroPago', res.config.Metodo_Pago || []);

            if(res.clientes) window.clientesCache = res.clientes;
        }
    } catch (e) { console.error("Error filtros", e); }
}

function llenarSelectSimple(idSelect, data) {
    const sel = document.getElementById(idSelect);
    if(!sel) return;
    const prev = sel.value;
    sel.innerHTML = `<option value="">Todos</option>`;
    if(data) data.forEach(d => sel.innerHTML += `<option value="${d}">${d}</option>`);
    sel.value = prev;
}

// =============================================================================
// 2. RENDERIZADO (UI)
// =============================================================================

function actualizarDashboard(ventas, resumen) {
    // A. KPIs
    document.getElementById('kpiTotalPeriodo').innerText = `S/ ${parseFloat(resumen.total).toFixed(2)}`;
    document.getElementById('kpiCantidadTickets').innerText = resumen.cantidad;
    
    const promedio = resumen.cantidad > 0 ? (resumen.total / resumen.cantidad) : 0;
    document.getElementById('kpiTicketPromedio').innerText = `S/ ${promedio.toFixed(2)}`;

    // B. TABLA
    const tbody = document.getElementById('tablaVentasBody');
    document.getElementById('lblCountTabla').innerText = `${ventas.length} registros`;
    tbody.innerHTML = '';

    if (ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">No se encontraron ventas en este periodo.</td></tr>';
        renderizarGrafico([]);
        return;
    }

    const ventasOrdenadas = [...ventas].sort((a, b) => new Date(b.fecha + 'T' + b.hora) - new Date(a.fecha + 'T' + a.hora));

    ventasOrdenadas.forEach(v => {
        // LÓGICA DE COLOR (Background tintado + Borde)
        let badgeStyle = 'class="badge bg-light text-dark border"'; 
        
        if (v.color_estado) {
            // Convertir Hex a RGB simple o usar opacidad CSS
            // Usamos un fondo muy suave (10% opacidad) y texto del color fuerte
            badgeStyle = `style="background-color:${v.color_estado}15; color:${v.color_estado}; border:1px solid ${v.color_estado}60;" class="badge"`;
        }

        const fila = `
            <tr>
                <td class="fw-bold text-primary font-monospace">${v.ticket || '---'}</td>
                <td>${v.fecha} <small class="text-muted">${v.hora}</small></td>
                <td>${v.cliente || 'General'}</td>
                <td class="text-end fw-bold">S/ ${parseFloat(v.total).toFixed(2)}</td>
                <td><span ${badgeStyle}>${v.estado}</span></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-secondary border-0" onclick="abrirGestionTicket('${v.ticket}')" title="Gestionar">
                        <i class="bi bi-gear-fill"></i>
                    </button>
                </td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', fila);
    });

    // C. GRÁFICO
    renderizarGrafico(ventas);
}

function renderizarGrafico(datos) {
    const ctx = document.getElementById('graficoVentas');
    if (!ctx) return;

    if (chartInstancia) {
        chartInstancia.destroy();
        chartInstancia = null;
    }

    if (datos.length === 0) return;

    const fDesde = document.getElementById('filtroFechaDesde').value;
    const fHasta = document.getElementById('filtroFechaHasta').value;
    const esMismoDia = fDesde === fHasta;

    const dataMap = {};

    datos.forEach(v => {
        const key = esMismoDia ? v.hora.substring(0, 2) + ':00' : v.fecha;
        if (!dataMap[key]) dataMap[key] = 0;
        dataMap[key] += parseFloat(v.total);
    });

    const labels = Object.keys(dataMap).sort();
    const values = labels.map(k => dataMap[k]);

    chartInstancia = new Chart(ctx, {
        type: esMismoDia ? 'line' : 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ventas (S/)',
                data: values,
                backgroundColor: esMismoDia ? 'rgba(13, 110, 253, 0.1)' : '#0d6efd',
                borderColor: '#0d6efd',
                borderWidth: 2,
                borderRadius: 4,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [2, 2] } },
                x: { grid: { display: false } }
            }
        }
    });
}

/* ... (Las funciones de Sincronización y Nueva Venta se mantienen igual, no es necesario reenviarlas si no cambiaron, pero para copiar y pegar completo, las incluyo abajo) ... */

async function sincronizarLoyverse() {
    const btn = document.querySelector('button[onclick="sincronizarLoyverse()"]');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sync...';
    try {
        if(typeof CacheSystem !== 'undefined') CacheSystem.clear();
        const res = await callAPI('sincronizarLoyverse', 'sincronizarLoyverse');
        if (res.success) { alert(res.message); cargarVentasArzuka(); } 
        else { alert("⚠️ " + res.error); }
    } catch (e) { alert("Error conexión."); } 
    finally { btn.disabled = false; btn.innerHTML = originalHTML; }
}

async function abrirModalNuevaVenta() {
    document.getElementById('formVenta').reset();
    document.getElementById('bodyTablaVentas').innerHTML = '';
    document.getElementById('lblTotalVenta').innerText = '0.00';
    document.getElementById('lblSaldoPendiente').innerText = '0.00';
    document.getElementById('dateEntrega').value = new Date().toISOString().split('T')[0];
    const modal = new bootstrap.Modal(document.getElementById('modalNuevaVenta'));
    modal.show();
    agregarLineaProducto();
    const dl = document.getElementById('listaClientes');
    dl.innerHTML = '';
    if(window.clientesCache) {
        window.clientesCache.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.nombre;
            dl.appendChild(opt);
        });
    }
}

function agregarLineaProducto() {
    const tbody = document.getElementById('bodyTablaVentas');
    const id = Date.now();
    tbody.insertAdjacentHTML('beforeend', `
        <tr id="row_${id}">
            <td><input class="form-control form-control-sm desc" placeholder="Item"></td>
            <td><input type="number" class="form-control form-control-sm text-center cant" value="1" oninput="calcRow(${id})"></td>
            <td><input type="number" class="form-control form-control-sm text-end price" value="0" oninput="calcRow(${id})"></td>
            <td class="text-end fw-bold subtotal">0.00</td>
            <td><i class="bi bi-x text-danger cursor-pointer" onclick="this.closest('tr').remove(); calcTotal();"></i></td>
        </tr>
    `);
}

function calcRow(id) {
    const row = document.getElementById(`row_${id}`);
    const cant = row.querySelector('.cant').value;
    const price = row.querySelector('.price').value;
    row.querySelector('.subtotal').innerText = (cant * price).toFixed(2);
    calcTotal();
}

function calcTotal() {
    let tot = 0;
    document.querySelectorAll('.subtotal').forEach(el => tot += parseFloat(el.innerText));
    document.getElementById('lblTotalVenta').innerText = tot.toFixed(2);
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
    const cliente = document.getElementById('txtClienteBuscar').value;
    if(!cliente) return alert("Falta cliente");
    const items = [];
    document.querySelectorAll('#bodyTablaVentas tr').forEach(r => {
        const nom = r.querySelector('.desc').value;
        const pre = parseFloat(r.querySelector('.price').value);
        const cant = parseFloat(r.querySelector('.cant').value);
        const sub = parseFloat(r.querySelector('.subtotal').innerText);
        if(nom && pre) items.push({ nombre: nom, cantidad: cant, precio_unitario: pre, subtotal: sub });
    });
    if(items.length === 0) return alert("Agrega productos");
    const btn = document.querySelector('#modalNuevaVenta .btn-success');
    btn.disabled = true; btn.innerText = "Guardando...";
    const clienteObj = window.clientesCache ? window.clientesCache.find(c => c.nombre === cliente) : null;
    const idCliente = clienteObj ? clienteObj.id : ('NUEVO-' + Date.now());
    const payload = {
        cabecera: { id_cliente: idCliente, nombre_cliente: cliente, id_vendedor: 'WEB', observaciones: document.getElementById('txtObservaciones').value },
        totales: { total_venta: parseFloat(document.getElementById('lblTotalVenta').innerText), saldo_pendiente: parseFloat(document.getElementById('lblSaldoPendiente').innerText) },
        evento: { tipo: document.getElementById('selTipoEvento').value, fecha: document.getElementById('dateEntrega').value, turno: '' },
        entrega: { es_delivery: document.getElementById('chkDelivery').checked, direccion: document.getElementById('txtDireccion').value, referencia: document.getElementById('txtReferencia').value, persona_recibe: cliente, celular_contacto: '' },
        detalle: items
    };
    try {
        const res = await callAPI('ventas', 'registrarVenta', payload);
        if(res.success) {
            alert("✅ Venta registrada: " + res.data.id_ticket);
            bootstrap.Modal.getInstance(document.getElementById('modalNuevaVenta')).hide();
            cargarVentasArzuka();
        } else { alert("Error: " + res.error); }
    } catch(e) { alert(e); } 
    finally { btn.disabled = false; btn.innerText = "REGISTRAR"; }
}
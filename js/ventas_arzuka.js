/**
 * js/ventas_arzuka.js
 * Lógica del Dashboard Comercial.
 * ACTUALIZADO: Alertas visuales para pedidos sin cliente.
 */

let chartInstancia = null;
let filtrosCargados = false;

// =============================================================================
// 1. LÓGICA DE FECHAS
// =============================================================================

function aplicarRangoFecha(tipo) {
    const hoy = new Date();
    let inicio, fin;
    const fmt = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

    switch (tipo) {
        case 'hoy': inicio = new Date(hoy); fin = new Date(hoy); break;
        case 'ayer': inicio = new Date(hoy); inicio.setDate(hoy.getDate() - 1); fin = new Date(inicio); break;
        case 'semana': 
            inicio = new Date(hoy); 
            const day = hoy.getDay() || 7; 
            if (day !== 1) inicio.setHours(-24 * (day - 1));
            fin = new Date(hoy); 
            break;
        case 'ultima_semana':
            inicio = new Date(hoy);
            const dayLast = hoy.getDay() || 7;
            inicio.setDate(hoy.getDate() - dayLast - 6);
            fin = new Date(inicio);
            fin.setDate(inicio.getDate() + 6);
            break;
        case 'mes': inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1); fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0); break;
        case 'mes_anterior': inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1); fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0); break;
    }

    if (inicio && fin) {
        document.getElementById('filtroFechaDesde').value = fmt(inicio);
        document.getElementById('filtroFechaHasta').value = fmt(fin);
        cargarVentasArzuka(); 
    }
}

// =============================================================================
// 2. CARGA DE DATOS
// =============================================================================

async function cargarVentasArzuka() {
    if (!document.getElementById('filtroFechaDesde').value) {
        aplicarRangoFecha('mes'); 
        return; 
    }

    if (!filtrosCargados) {
        await cargarListasMaestrasFiltros();
        filtrosCargados = true;
    }

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
    if(tbody.children.length <= 1 || tbody.innerHTML.includes('Error')) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary"></div><br>Procesando datos...</td></tr>';
    }

    try {
        const res = await callAPI('ventas', 'obtenerVentasFiltradas', payload, (datosFrescos) => {
            if(datosFrescos.success) actualizarDashboard(datosFrescos.ventas, datosFrescos.resumen);
        });

        if (res && res.success) {
            actualizarDashboard(res.ventas, res.resumen);
        } else if (res && !res.success) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error: ${res.error}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error de conexión.</td></tr>';
    }
}

async function cargarListasMaestrasFiltros() {
    try {
        const res = await callAPI('ventas', 'obtenerMaestrosVentas', {}, { useCache: true, ttl: 300 });
        if (res.success) {
            const selV = document.getElementById('filtroVendedor');
            const valV = selV.value;
            selV.innerHTML = '<option value="Todos">Todos los vendedores</option>';
            if(res.vendedores) res.vendedores.forEach(v => selV.innerHTML += `<option value="${v.nombre}">${v.nombre}</option>`);
            selV.value = valV;

            const selE = document.getElementById('filtroEstado');
            selE.innerHTML = '<option value="">Todos</option>';
            if(res.config && res.config.Estado_Pedido) {
                res.config.Estado_Pedido.forEach(item => {
                    let nombre = item;
                    try { if(item.trim().startsWith('{')) nombre = JSON.parse(item).nombre; } catch(e){}
                    selE.innerHTML += `<option value="${nombre}">${nombre}</option>`;
                });
            }

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
// 3. RENDERIZADO
// =============================================================================

function actualizarDashboard(ventas, resumen) {
    document.getElementById('kpiTotalPeriodo').innerText = `S/ ${parseFloat(resumen.total).toFixed(2)}`;
    document.getElementById('kpiCantidadTickets').innerText = resumen.cantidad;
    const promedio = resumen.cantidad > 0 ? (resumen.total / resumen.cantidad) : 0;
    document.getElementById('kpiTicketPromedio').innerText = `S/ ${promedio.toFixed(2)}`;

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
        let badgeStyle = 'class="badge bg-light text-dark border"'; 
        if (v.color_estado) {
            badgeStyle = `style="background-color:${v.color_estado}25; color:${v.color_estado}; border:1px solid ${v.color_estado}60;" class="badge"`;
        }

        // ALERTA DE CLIENTE SIN ASIGNAR
        let celdaCliente = v.cliente;
        const clientesGenericos = ['Cliente General', 'CLI-GENERICO', 'Sin Nombre', ''];
        
        if (clientesGenericos.includes(v.cliente) || v.id_cliente === 'CLI-GENERICO' || v.id_cliente === 'CLI-GEN') {
            celdaCliente = `<span class="badge bg-danger text-white"><i class="bi bi-exclamation-triangle-fill me-1"></i> Sin Asignar</span>`;
        }

        const fila = `
            <tr>
                <td class="fw-bold text-primary font-monospace">${v.ticket || '---'}</td>
                <td>${v.fecha} <small class="text-muted">${v.hora}</small></td>
                <td>${celdaCliente}</td>
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

    renderizarGrafico(ventas);
}

function renderizarGrafico(datos) {
    const ctx = document.getElementById('graficoVentas');
    if (!ctx) return;

    if (chartInstancia) { chartInstancia.destroy(); chartInstancia = null; }
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
            scales: { y: { beginAtZero: true, grid: { borderDash: [2, 2] } }, x: { grid: { display: false } } }
        }
    });
}

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
    const modal = new bootstrap.Modal(document.getElementById('modalNuevaVenta'));
    document.getElementById('formVenta').reset();
    document.getElementById('bodyTablaVentas').innerHTML = '';
    document.getElementById('lblTotalVenta').innerText = '0.00';
    document.getElementById('dateEntrega').value = new Date().toISOString().split('T')[0];
    
    const dl = document.getElementById('listaClientes');
    if(dl && window.clientesCache) {
        dl.innerHTML = '';
        window.clientesCache.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.nombre;
            dl.appendChild(opt);
        });
    }
    modal.show();
}

// =============================================================================
// 4. FUNCIONES AUXILIARES (Sincronización, etc.)
// =============================================================================

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
    // Nota: Esta función es solo para abrir el modal, la lógica interna
    // está en el archivo modal-nueva-venta.html o embebida.
    // Mantenemos la llamada básica para que el botón funcione.
    const modal = new bootstrap.Modal(document.getElementById('modalNuevaVenta'));
    
    // Limpieza básica
    document.getElementById('formVenta').reset();
    document.getElementById('bodyTablaVentas').innerHTML = '';
    document.getElementById('lblTotalVenta').innerText = '0.00';
    document.getElementById('dateEntrega').value = new Date().toISOString().split('T')[0];
    
    // Re-poblar datalist de clientes si está disponible
    const dl = document.getElementById('listaClientes');
    if(dl && window.clientesCache) {
        dl.innerHTML = '';
        window.clientesCache.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.nombre;
            dl.appendChild(opt);
        });
    }
    
    modal.show();
}
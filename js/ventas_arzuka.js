/**
 * js/ventas_arzuka.js
 * Lógica del Dashboard Comercial.
 * ACTUALIZADO: Filtros de Fecha Inteligentes (Rangos Rápidos) y Colores.
 */

let chartInstancia = null;
let filtrosCargados = false;

// =============================================================================
// 1. LÓGICA DE FECHAS (RANGOS RÁPIDOS)
// =============================================================================

function aplicarRangoFecha(tipo) {
    const hoy = new Date();
    let inicio, fin;

    // Helper para formato YYYY-MM-DD (Input HTML)
    const fmt = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

    switch (tipo) {
        case 'hoy':
            inicio = new Date(hoy);
            fin = new Date(hoy);
            break;
        case 'ayer':
            inicio = new Date(hoy);
            inicio.setDate(hoy.getDate() - 1);
            fin = new Date(inicio);
            break;
        case 'semana': // Lunes a Domingo actual
            inicio = new Date(hoy);
            const day = hoy.getDay() || 7; // Hacer que domingo sea 7
            if (day !== 1) inicio.setHours(-24 * (day - 1));
            fin = new Date(hoy); // Hasta hoy (o fin de semana si prefieres)
            break;
        case 'ultima_semana': // Lunes a Domingo pasado
            inicio = new Date(hoy);
            const dayLast = hoy.getDay() || 7;
            inicio.setDate(hoy.getDate() - dayLast - 6);
            fin = new Date(inicio);
            fin.setDate(inicio.getDate() + 6);
            break;
        case 'mes': // 1 al ultimo del mes actual
            inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
            break;
        case 'mes_anterior': // 1 al ultimo del mes pasado
            inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
            fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
            break;
    }

    if (inicio && fin) {
        document.getElementById('filtroFechaDesde').value = fmt(inicio);
        document.getElementById('filtroFechaHasta').value = fmt(fin);
        cargarVentasArzuka(); // Recargar datos automáticamente
    }
}

// =============================================================================
// 2. CARGA DE DATOS Y FILTROS
// =============================================================================

async function cargarVentasArzuka() {
    // 1. Configurar fechas por defecto (MES ACTUAL) si están vacías
    if (!document.getElementById('filtroFechaDesde').value) {
        aplicarRangoFecha('mes'); // Usamos la lógica centralizada
        return; // aplicarRangoFecha ya llama a cargarVentasArzuka, así que salimos
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
    // Spinner
    if(tbody.children.length <= 1 || tbody.innerHTML.includes('Error')) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary"></div><br>Procesando datos...</td></tr>';
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

            // B. Estados (Soporte Color JSON)
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

            // Caché de clientes para búsqueda rápida en otros módulos
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
// 3. RENDERIZADO DEL DASHBOARD (TABLA Y GRÁFICOS)
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

    // Ordenar por fecha descendente
    const ventasOrdenadas = [...ventas].sort((a, b) => new Date(b.fecha + 'T' + b.hora) - new Date(a.fecha + 'T' + a.hora));

    ventasOrdenadas.forEach(v => {
        // Lógica de Color
        let badgeStyle = 'class="badge bg-light text-dark border"'; 
        
        if (v.color_estado) {
            // Fondo con 15% opacidad, borde con 60% opacidad, texto 100%
            badgeStyle = `style="background-color:${v.color_estado}25; color:${v.color_estado}; border:1px solid ${v.color_estado}60;" class="badge"`;
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
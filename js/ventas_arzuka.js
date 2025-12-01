/**
 * js/ventas_arzuka.js
 * Lógica del Dashboard Comercial: Filtros, Gráficos Dinámicos y Caché.
 */

let chartInstancia = null; // Variable global para el gráfico
let filtrosCargados = false;

// =============================================================================
// 1. INICIALIZACIÓN Y FILTROS
// =============================================================================

// Se llama automáticamente cuando el usuario entra a la vista (desde nav())
async function cargarVentasArzuka() {
    // 1. Configurar fechas por defecto (Hoy) si están vacías
    if (!document.getElementById('filtroFechaDesde').value) {
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('filtroFechaDesde').value = hoy;
        document.getElementById('filtroFechaHasta').value = hoy;
    }

    // 2. Cargar lista de vendedores solo la primera vez
    if (!filtrosCargados) {
        await cargarFiltroVendedores();
        filtrosCargados = true;
    }

    // 3. Obtener valores de filtro
    const payload = {
        fechaDesde: document.getElementById('filtroFechaDesde').value,
        fechaHasta: document.getElementById('filtroFechaHasta').value,
        vendedor: document.getElementById('filtroVendedor').value
    };

    // UI: Mostrar carga
    const tbody = document.getElementById('tablaVentasBody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary"></div><br>Analizando datos...</td></tr>';

    try {
        // 4. LLAMADA AL API (CON CACHÉ)
        // ttl: 5 minutos para reportes. Si el usuario activó el caché en Configuración, esto volará.
        const res = await callAPI('ventas', 'obtenerVentasFiltradas', payload, { useCache: true, ttl: 5 });

        if (res.success) {
            actualizarDashboard(res.ventas, res.resumen);
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error: ${res.error}</td></tr>`;
        }

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error de conexión.</td></tr>';
    }
}

async function cargarFiltroVendedores() {
    try {
        // Usamos caché alto (60 min) para la lista de vendedores, casi no cambia
        const res = await callAPI('ventas', 'obtenerMaestrosVentas', {}, { useCache: true, ttl: 60 });
        if (res.success && res.vendedores) {
            const sel = document.getElementById('filtroVendedor');
            // Mantener la opción "Todos" y agregar el resto
            sel.innerHTML = '<option value="Todos">Todos los vendedores</option>';
            res.vendedores.forEach(v => {
                // Guardamos el nombre o ID según como lo manejes en la BD. 
                // En Ventas_Code.gs comparamos strings, así que usamos el nombre.
                sel.innerHTML += `<option value="${v.nombre}">${v.nombre}</option>`;
            });
        }
        // También aprovechamos para llenar el cache de clientes para el formulario de nueva venta
        if(res.clientes) window.clientesCache = res.clientes;
        if(res.config) window.configCache = res.config; // Guardar config globalmente
    } catch (e) { console.error("Error cargando vendedores", e); }
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
        renderizarGrafico([]); // Limpiar gráfico
        return;
    }

    // Ordenar: Más reciente primero
    // El backend ya devuelve fechas, pero aseguramos orden visual
    const ventasOrdenadas = [...ventas].sort((a, b) => new Date(b.fecha + 'T' + b.hora) - new Date(a.fecha + 'T' + a.hora));

    ventasOrdenadas.forEach(v => {
        const fila = `
            <tr>
                <td class="fw-bold text-primary font-monospace">${v.ticket || '---'}</td>
                <td>${v.fecha} <small class="text-muted">${v.hora}</small></td>
                <td>${v.cliente || 'General'}</td>
                <td class="text-end fw-bold">S/ ${parseFloat(v.total).toFixed(2)}</td>
                <td><span class="badge bg-light text-dark border">${v.vendedor || 'N/A'}</span></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-secondary border-0" onclick="abrirGestionTicket('${v.ticket}')">
                        <i class="bi bi-gear-fill"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', fila);
    });

    // C. GRÁFICO
    renderizarGrafico(ventas); // Pasamos datos crudos para agrupar
}

function renderizarGrafico(datos) {
    const ctx = document.getElementById('graficoVentas');
    if (!ctx) return;

    // Destruir gráfico anterior
    if (chartInstancia) {
        chartInstancia.destroy();
        chartInstancia = null;
    }

    if (datos.length === 0) return;

    // Agrupación Inteligente
    // Si el rango es de 1 día -> Mostrar por Hora
    // Si son varios días -> Mostrar por Día
    
    const fDesde = document.getElementById('filtroFechaDesde').value;
    const fHasta = document.getElementById('filtroFechaHasta').value;
    const esMismoDia = fDesde === fHasta;

    const dataMap = {};

    datos.forEach(v => {
        // Clave: Hora (si es mismo día) o Fecha (si es rango)
        const key = esMismoDia ? v.hora.substring(0, 2) + ':00' : v.fecha; // Hora "14:00" o Fecha "2023-10-25"
        if (!dataMap[key]) dataMap[key] = 0;
        dataMap[key] += parseFloat(v.total);
    });

    // Ordenar claves cronológicamente
    const labels = Object.keys(dataMap).sort();
    const values = labels.map(k => dataMap[k]);

    // Crear Chart
    chartInstancia = new Chart(ctx, {
        type: esMismoDia ? 'line' : 'bar', // Línea para horas, Barras para días
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
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` S/ ${ctx.raw.toFixed(2)}`
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [2, 2] } },
                x: { grid: { display: false } }
            }
        }
    });
}

// =============================================================================
// 3. SINCRONIZACIÓN (Limpia caché para ver datos frescos)
// =============================================================================

async function sincronizarLoyverse() {
    const btn = document.querySelector('button[onclick="sincronizarLoyverse()"]');
    const originalHTML = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sincronizando...';
    
    try {
        // Limpiamos caché local para forzar recarga post-sincronización
        if(typeof CacheSystem !== 'undefined') CacheSystem.clear();

        const res = await callAPI('sincronizarLoyverse', 'sincronizarPedidosLoyverse');
        
        if (res.success) {
            // Mostrar mensaje sutil en vez de alert invasivo
            const toast = document.createElement('div');
            toast.className = 'position-fixed bottom-0 end-0 p-3';
            toast.style.zIndex = '2000';
            toast.innerHTML = `<div class="toast show bg-success text-white"><div class="toast-body">${res.message}</div></div>`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);

            cargarVentasArzuka(); // Recargar tabla
        } else {
            alert("⚠️ " + res.error);
        }
    } catch (e) {
        alert("Error de conexión.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// =============================================================================
// 4. MODAL NUEVA VENTA (Auxiliar)
// =============================================================================

async function abrirModalNuevaVenta() {
    // Lógica de apertura (reset form, date today...)
    document.getElementById('formVenta').reset();
    document.getElementById('bodyTablaVentas').innerHTML = '';
    document.getElementById('lblTotalVenta').innerText = '0.00';
    
    const modal = new bootstrap.Modal(document.getElementById('modalNuevaVenta'));
    modal.show();
    
    // Cargar listas si no están
    if (!window.clientesCache || !window.configCache) {
        await cargarFiltroVendedores();
    }
    
    // Llenar datalist clientes
    const dl = document.getElementById('listaClientes');
    dl.innerHTML = '';
    if(window.clientesCache) {
        window.clientesCache.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.nombre;
            dl.appendChild(opt);
        });
    }
    // Llenar selects
    if(window.configCache) {
        // Llenar selects del formulario (implementar helpers si necesario)
    }
}

// ... (Las funciones de agregarLineaProducto, calcularTotales, etc. se mantienen igual o se pueden importar si las tenías separadas. Si este archivo reemplaza al anterior, asegúrate de copiar esas funciones aquí también o mantenerlas).

// PARA ASEGURAR QUE NO SE PIERDA LA LÓGICA DE CREAR VENTA, AGREGO LAS FUNCIONES BÁSICAS AQUÍ ABAJO:

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
}

async function guardarVenta() {
    const cliente = document.getElementById('txtClienteBuscar').value;
    if(!cliente) return alert("Falta cliente");
    
    const items = [];
    document.querySelectorAll('#bodyTablaVentas tr').forEach(r => {
        items.push({
            nombre: r.querySelector('.desc').value,
            cantidad: r.querySelector('.cant').value,
            precio_unitario: r.querySelector('.price').value,
            subtotal: r.querySelector('.subtotal').innerText
        });
    });

    const payload = {
        cabecera: { nombre_cliente: cliente, id_vendedor: 'WEB' }, // Ajustar según backend
        totales: { total_venta: document.getElementById('lblTotalVenta').innerText, saldo_pendiente: document.getElementById('lblTotalVenta').innerText },
        evento: { tipo: 'Venta Web', fecha: new Date(), turno: '' },
        entrega: { es_delivery: false },
        detalle: items
    };
    
    // Enviar... (Implementación simplificada, conectar con tu backend real)
    const res = await callAPI('ventas', 'registrarVenta', payload);
    if(res.success) {
        alert("Venta creada");
        bootstrap.Modal.getInstance(document.getElementById('modalNuevaVenta')).hide();
        cargarVentasArzuka();
    }
}
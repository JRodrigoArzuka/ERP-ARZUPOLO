/**
 * js/ventas_arzuka.js
 * Lógica del Módulo de Ventas (Frontend)
 * Versión Final: Dashboard + Gráficos + Formulario + Detalles
 */

// --- VARIABLES GLOBALES ---
let clientesCache = [];     // Almacena lista de clientes para búsqueda rápida
let itemsVenta = [];        // Almacena productos del formulario actual (aunque usamos DOM directo, esto ayuda si se escala)
let chartVentas = null;     // Instancia del gráfico Chart.js para poder destruirlo y recrearlo

// =============================================================================
// 1. SECCIÓN DASHBOARD (KPIs, Tabla y Gráfico)
// =============================================================================

/**
 * Carga los datos del día actual desde el Backend
 */
async function cargarVentasArzuka() {
    // Referencias al DOM
    const tbody = document.getElementById('tablaVentasBody');
    const kpiTotal = document.getElementById('kpiVentasHoy');
    const kpiTickets = document.getElementById('kpiTicketsHoy');
    const kpiPendiente = document.getElementById('kpiPendienteHoy');
    
    // Mostrar estado de carga
    if(tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary"></div><br>Sincronizando datos...</td></tr>';

    try {
        // Llamada al API Handler
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
                // Limpiar gráfico si no hay datos
                if(chartVentas) { chartVentas.destroy(); chartVentas = null; }
            } else {
                // Dibujar Gráfico (Pasamos copia invertida porque la API devuelve de más reciente a más antiguo)
                // y el gráfico necesita cronológico (antiguo -> reciente)
                const ventasCronologicas = [...res.ventas].reverse(); 
                renderizarGrafico(ventasCronologicas);

                // Llenar filas de la tabla
                res.ventas.forEach(venta => {
                    let badgeColor = 'bg-secondary';
                    if (venta.estado === 'Pagado') badgeColor = 'bg-success';
                    if (venta.estado === 'Pendiente') badgeColor = 'bg-warning text-dark';
                    if (venta.estado === 'Anulado') badgeColor = 'bg-danger';

                    const fila = `
                        <tr>
                            <td class="fw-bold text-primary">${venta.ticket}</td>
                            <td class="small">${venta.fecha}</td>
                            <td>${venta.cliente}</td>
                            <td class="fw-bold">S/ ${parseFloat(venta.total).toFixed(2)}</td>
                            <td><span class="badge ${badgeColor}">${venta.estado}</span></td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" onclick="abrirGestionTicket('${venta.ticket}')" title="Ver productos">
                                    <i class="bi bi-eye"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.insertAdjacentHTML('beforeend', fila);
                });
            }
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error del servidor: ${res.error}</td></tr>`;
        }

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Fallo de conexión. Intente nuevamente.</td></tr>';
    }
}

/**
 * Dibuja el gráfico de línea verde usando Chart.js
 */
function renderizarGrafico(datosVentas) {
    const ctx = document.getElementById('graficoVentas');
    if(!ctx) return; // Si no existe el canvas, salir

    // Preparar datos: Extraer hora y montos
    // Nota: Si hay muchas ventas en la misma hora, Chart.js las grafica secuencialmente. 
    // Para un gráfico "Por Hora" real se requeriría agrupar datos antes.
    const etiquetas = datosVentas.map(v => v.fecha.split(' ')[1]); // Solo la hora (HH:mm)
    const valores = datosVentas.map(v => v.total);

    // Destruir gráfico anterior para evitar superposiciones
    if (chartVentas) chartVentas.destroy();

    // Crear nuevo gráfico
    chartVentas = new Chart(ctx, {
        type: 'line',
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Monto Venta (S/)',
                data: valores,
                borderColor: '#28a745', // Verde Arzuka
                backgroundColor: 'rgba(40, 167, 69, 0.1)', // Sombra verde
                borderWidth: 2,
                tension: 0.3, // Curva suave
                fill: true,
                pointRadius: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#28a745'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }, // Ocultar leyenda
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { display: true, borderDash: [5, 5] } 
                },
                x: { 
                    grid: { display: false } 
                }
            }
        }
    });
}

/**
 * Abre el modal secundario para ver qué productos tiene un ticket
 */
// Variable global para almacenar el ticket actual visualizado
let ticketActualData = null;

async function verDetalleTicket(idTicket) {
    const modalEl = document.getElementById('modalDetalleTicket');
    const modal = new bootstrap.Modal(modalEl);
    const tbody = document.getElementById('bodyDetalleTicket');
    const titulo = document.getElementById('lblTituloTicket');
    const btnImprimir = modalEl.querySelector('.modal-footer .btn-primary');
    
    titulo.innerText = `Ticket #${idTicket}`;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando items...</td></tr>';
    
    // Configurar botón de imprimir
    btnImprimir.onclick = () => imprimirTicket(idTicket); // Vinculamos la función
    btnImprimir.disabled = true;

    modal.show();

    // Guardar ID en variable global si se necesita
    ticketActualData = { id: idTicket, items: [] };

    const res = await callAPI('ventas', 'obtenerDetalleTicket', { id_ticket: idTicket });

    if(res.success) {
        tbody.innerHTML = '';
        ticketActualData.items = res.items; // Guardamos items para imprimir
        btnImprimir.disabled = false;

        if(res.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Sin items.</td></tr>';
        }
        
        res.items.forEach(item => {
            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold">${item.producto}</td>
                    <td class="small text-muted">${item.descripcion || ''}</td>
                    <td class="text-center">${item.cantidad}</td>
                    <td class="text-end">${parseFloat(item.precio).toFixed(2)}</td>
                    <td class="text-end fw-bold">${parseFloat(item.subtotal).toFixed(2)}</td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Error: ${res.error}</td></tr>`;
    }
}

/**
 * Genera una ventana emergente para imprimir el ticket térmico
 */
function imprimirTicket(idTicket) {
    if (!ticketActualData || !ticketActualData.items) return;

    // Calcular total
    const total = ticketActualData.items.reduce((sum, item) => sum + item.subtotal, 0);
    const fecha = new Date().toLocaleString();

    // Crear contenido HTML del ticket
    let htmlTicket = `
        <html>
        <head>
            <title>Ticket ${idTicket}</title>
            <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0; padding: 10px; }
                .text-center { text-align: center; }
                .text-end { text-align: right; }
                .fw-bold { font-weight: bold; }
                hr { border: 1px dashed #000; }
                table { width: 100%; border-collapse: collapse; }
                td { vertical-align: top; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="text-center">
                <h3 style="margin:0">ARZUPOLO SAC</h3>
                <p style="margin:5px 0">RUC: 20XXXXXXXXX<br>Av. Principal 123, Lima</p>
                <p>Ticket: <b>${idTicket}</b><br>${fecha}</p>
            </div>
            <hr>
            <table>
                ${ticketActualData.items.map(item => `
                    <tr>
                        <td colspan="3"><b>${item.producto}</b></td>
                    </tr>
                    <tr>
                        <td>${item.cantidad} x ${parseFloat(item.precio).toFixed(2)}</td>
                        <td class="text-end">${parseFloat(item.subtotal).toFixed(2)}</td>
                    </tr>
                    ${item.descripcion ? `<tr><td colspan="2" style="font-size:10px">(${item.descripcion})</td></tr>` : ''}
                `).join('')}
            </table>
            <hr>
            <div class="text-end">
                <h3>TOTAL: S/ ${total.toFixed(2)}</h3>
            </div>
            <div class="text-center" style="margin-top:20px">
                <p>¡Gracias por su compra!</p>
            </div>
        </body>
        </html>
    `;

    // Abrir ventana popup para imprimir
    const ventana = window.open('', 'ImpresionTicket', 'height=600,width=400');
    ventana.document.write(htmlTicket);
    ventana.document.close();
}

// =============================================================================
// 2. SECCIÓN FORMULARIO (Registrar Nueva Venta)
// =============================================================================

/**
 * Prepara y abre el Modal de Nueva Venta
 */
async function abrirModalNuevaVenta() {
    // A. Limpiar formulario
    document.getElementById('formVenta').reset();
    document.getElementById('bodyTablaVentas').innerHTML = '';
    document.getElementById('lblTotalVenta').innerText = '0.00';
    document.getElementById('lblSaldoPendiente').innerText = '0.00';
    document.getElementById('divDelivery').classList.add('d-none');
    
    // Restablecer alerta de saldo
    const lblSaldo = document.getElementById('lblSaldoPendiente');
    lblSaldo.parentElement.className = 'alert alert-warning py-1 mb-0 small text-center fw-bold';

    // B. Fecha por defecto (Hoy)
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('dateEntrega').value = hoy;

    // C. Abrir Modal
    const modal = new bootstrap.Modal(document.getElementById('modalNuevaVenta'));
    modal.show();

    // D. Agregar primera línea vacía para escribir rápido
    agregarLineaProducto();

    // E. Cargar Maestros (Clientes, Config) si es necesario
    try {
        const selectEvento = document.getElementById('selTipoEvento');
        // Si el select tiene pocas opciones, asumimos que no se ha cargado
        if (selectEvento.options.length <= 1) {
            
            const datos = await callAPI('ventas', 'obtenerMaestrosVentas');
            
            if(datos.success) {
                // 1. Llenar Selects
                llenarSelect('selTipoEvento', datos.config.Tipo_Evento);
                llenarSelect('selMetodoPago', datos.config.Metodo_Pago);
                
                // 2. Llenar Autocompletado de Clientes
                clientesCache = datos.clientes; 
                const dataList = document.getElementById('listaClientes');
                dataList.innerHTML = '';
                
                datos.clientes.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.nombre; 
                    // Guardamos ID en atributo data-id
                    opt.setAttribute('data-id', c.id); 
                    // Info extra para ayudar a diferenciar homónimos
                    const infoExtra = c.doc ? `Doc: ${c.doc}` : `Cel: ${c.cel}`;
                    opt.label = infoExtra;
                    dataList.appendChild(opt);
                });

            } else {
                console.warn("Error cargando maestros:", datos.error);
            }
        }
    } catch (e) {
        console.error("Error de red al cargar maestros:", e);
    }
}

/**
 * Helper para llenar selects HTML
 */
function llenarSelect(idSelect, arrayDatos) {
    const sel = document.getElementById(idSelect);
    if(!sel || !arrayDatos) return;
    
    // Limpiamos opciones anteriores (excepto la primera si quisiéramos placeholder)
    sel.innerHTML = ''; 
    
    arrayDatos.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.innerText = item;
        sel.appendChild(opt);
    });
}

/**
 * Muestra/Oculta campos de dirección
 */
function toggleDelivery() {
    const chk = document.getElementById('chkDelivery');
    const div = document.getElementById('divDelivery');
    if(chk.checked) div.classList.remove('d-none');
    else div.classList.add('d-none');
}


// =============================================================================
// 3. LÓGICA DE LA TABLA DE PRODUCTOS (Cálculos en Cliente)
// =============================================================================

function agregarLineaProducto() {
    const tbody = document.getElementById('bodyTablaVentas');
    const index = Date.now(); // Timestamp como ID único temporal

    const rowHTML = `
        <tr id="fila_${index}">
            <td>
                <input type="text" class="form-control form-control-sm desc-prod" placeholder="Descripción del producto">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm text-center cant-prod" value="1" min="1" oninput="calcularFila(${index})">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm text-end precio-prod" placeholder="0.00" oninput="calcularFila(${index})">
            </td>
            <td class="text-end align-middle">
                <span class="fw-bold subtotal-prod">0.00</span>
            </td>
            <td class="text-center align-middle">
                <button type="button" class="btn btn-link text-danger p-0" onclick="eliminarFila(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `;
    
    tbody.insertAdjacentHTML('beforeend', rowHTML);
    
    // Auto-focus en la descripción
    setTimeout(() => {
        const input = document.querySelector(`#fila_${index} .desc-prod`);
        if(input) input.focus();
    }, 50);
}

function eliminarFila(index) {
    const fila = document.getElementById(`fila_${index}`);
    if(fila) fila.remove();
    calcularTotales();
}

function calcularFila(index) {
    const fila = document.getElementById(`fila_${index}`);
    if(!fila) return;

    const cant = parseFloat(fila.querySelector('.cant-prod').value) || 0;
    const precio = parseFloat(fila.querySelector('.precio-prod').value) || 0;
    const subtotal = cant * precio;

    fila.querySelector('.subtotal-prod').innerText = subtotal.toFixed(2);
    
    calcularTotales();
}

function calcularTotales() {
    let totalVenta = 0;
    
    document.querySelectorAll('#bodyTablaVentas tr').forEach(fila => {
        const sub = parseFloat(fila.querySelector('.subtotal-prod').innerText) || 0;
        totalVenta += sub;
    });

    document.getElementById('lblTotalVenta').innerText = totalVenta.toFixed(2);
    
    // Recalcular saldo (Total - A Cuenta)
    calcularSaldo();
}

function calcularSaldo() {
    const total = parseFloat(document.getElementById('lblTotalVenta').innerText) || 0;
    const aCuenta = parseFloat(document.getElementById('txtACuenta').value) || 0;
    let saldo = total - aCuenta;
    
    // Evitar -0.00 visual
    if (saldo < 0) saldo = 0; 
    
    const lblSaldo = document.getElementById('lblSaldoPendiente');
    lblSaldo.innerText = saldo.toFixed(2);
    
    const alertBox = lblSaldo.parentElement;
    if(saldo <= 0.01) {
        // Pagado
        alertBox.className = 'alert alert-success py-1 mb-0 small text-center fw-bold';
        lblSaldo.innerText = "0.00 (PAGADO)";
    } else {
        // Pendiente
        alertBox.className = 'alert alert-warning py-1 mb-0 small text-center fw-bold';
    }
}


// =============================================================================
// 4. GUARDAR VENTA (Envío al Servidor)
// =============================================================================

async function guardarVenta() {
    const btn = document.querySelector('#modalNuevaVenta .modal-footer .btn-success');
    const originalText = btn.innerHTML;

    // --- Validaciones ---
    const clienteNombre = document.getElementById('txtClienteBuscar').value.trim();
    if(!clienteNombre) { alert("⚠️ Debes ingresar un Cliente."); return; }
    
    const total = parseFloat(document.getElementById('lblTotalVenta').innerText);
    if(total <= 0) { alert("⚠️ El total no puede ser 0. Agrega productos."); return; }

    // Recopilar Productos
    const items = [];
    let errorEnItems = false;
    
    document.querySelectorAll('#bodyTablaVentas tr').forEach(fila => {
        const nombre = fila.querySelector('.desc-prod').value.trim();
        const cant = parseFloat(fila.querySelector('.cant-prod').value);
        const precio = parseFloat(fila.querySelector('.precio-prod').value);
        const subtotal = parseFloat(fila.querySelector('.subtotal-prod').innerText);

        // Si la fila está vacía, la ignoramos. Si está a medias, es error.
        if (nombre === "" && (isNaN(precio) || precio === 0)) return; 

        if (!nombre || isNaN(precio)) {
            errorEnItems = true;
            return;
        }

        items.push({
            nombre: nombre,
            cantidad: cant,
            precio_unitario: precio,
            subtotal: subtotal,
            sku: 'MANUAL-' + Date.now() // SKU temporal
        });
    });

    if(errorEnItems || items.length === 0) {
        alert("⚠️ Revisa los productos. Debe haber al menos uno con nombre y precio.");
        return;
    }

    // --- Preparar Datos ---
    
    // Buscar ID de Cliente (Si existe en caché)
    const clienteEncontrado = clientesCache.find(c => c.nombre === clienteNombre);
    const idCliente = clienteEncontrado ? clienteEncontrado.id : 'NUEVO-' + Date.now();

    const payload = {
        cabecera: {
            id_cliente: idCliente,
            nombre_cliente: clienteNombre,
            id_vendedor: 'USER-WEB', // Aquí podrías usar localStorage('usuario').id
            observaciones: document.getElementById('txtObservaciones').value
        },
        totales: {
            total_venta: total,
            a_cuenta: parseFloat(document.getElementById('txtACuenta').value) || 0,
            saldo_pendiente: parseFloat(document.getElementById('lblSaldoPendiente').innerText) || 0
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
            link_maps: '',
            persona_recibe: clienteNombre, // Por defecto recibe el cliente
            celular_contacto: ''
        },
        detalle: items
    };

    // --- Enviar ---
    btn.disabled = true; 
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
    
    try {
        const respuesta = await callAPI('ventas', 'registrarVenta', payload);
        
        if(respuesta.success) {
            alert(`✅ Venta Registrada Exitosamente!\nTicket: ${respuesta.data.id_ticket}`);
            
            // Cerrar modal y recargar dashboard
            bootstrap.Modal.getInstance(document.getElementById('modalNuevaVenta')).hide();
            cargarVentasArzuka(); 
            
        } else {
            alert("❌ Error al guardar: " + respuesta.error);
        }
    } catch (e) {
        alert("Error de conexión: " + e.message);
    } finally {
        btn.disabled = false; 
        btn.innerHTML = originalText;
    }
}
/**
 * Sincroniza ventas con Loyverse
 */
async function sincronizarLoyverse() {
    const btn = document.querySelector('button[onclick="sincronizarLoyverse()"]');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sincronizando...';
    
    try {
        const res = await callAPI('sincronizarLoyverse', 'sincronizarPedidosLoyverse');
        
        if (res.success) {
            alert(res.message);
            cargarVentasArzuka(); // Recargar la tabla para ver lo nuevo
        } else {
            alert("⚠️ " + res.error);
        }
    } catch (e) {
        alert("Error de conexión: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
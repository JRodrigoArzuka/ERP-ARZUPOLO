/**
 * js/clientes.js
 * Lógica del Módulo de Clientes (Frontend).
 * VERSIÓN FINAL: Integración con DNI, Fotos y Estadísticas.
 */

let listaClientesGlobal = [];
let clienteActualId = null; // Para control de pestañas

// =============================================================================
// 1. INICIALIZACIÓN Y LISTADO
// =============================================================================

async function inicializarModuloClientes() {
    const tbody = document.getElementById('tblClientesBody');
    if (!tbody) return;

    // Spinner inicial
    if(tbody.children.length <= 1) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary"></div><br>Cargando directorio...</td></tr>';
    }

    try {
        // Usamos SWR para carga rápida
        const res = await callAPI(
            'clientes', 
            'obtenerListaClientes', 
            {},
            (datosFrescos) => {
                if (datosFrescos.success) {
                    listaClientesGlobal = datosFrescos.clientes;
                    renderizarTablaClientes(listaClientesGlobal);
                }
            }
        );

        if (res && res.success) {
            listaClientesGlobal = res.clientes;
            renderizarTablaClientes(listaClientesGlobal);
        } else if (res) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${res.error}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error de conexión.</td></tr>';
    }
}

function renderizarTablaClientes(lista) {
    const tbody = document.getElementById('tblClientesBody');
    tbody.innerHTML = '';
    
    if (lista.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted fst-italic py-4">No se encontraron clientes.</td></tr>'; 
        return; 
    }
    
    // Limitamos renderizado inicial para rendimiento
    const listaVisible = lista.slice(0, 100); 

    listaVisible.forEach(c => {
        // Avatar pequeño si tiene foto
        const avatar = c.foto 
            ? `<img src="${c.foto}" class="rounded-circle border me-2" style="width:32px;height:32px;object-fit:cover;">`
            : `<div class="rounded-circle bg-light border d-inline-flex align-items-center justify-content-center me-2 text-muted fw-bold" style="width:32px;height:32px;">${c.nombre.charAt(0)}</div>`;

        tbody.innerHTML += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        ${avatar}
                        <div>
                            <div class="fw-bold text-primary">${c.nombre}</div>
                            ${c.nombre_corto ? `<small class="text-muted"><i class="bi bi-whatsapp me-1"></i>${c.nombre_corto}</small>` : ''}
                        </div>
                    </div>
                </td>
                <td><span class="badge bg-light text-dark border">${c.documento || '-'}</span></td>
                <td>${c.celular || '-'}</td>
                <td><small class="text-muted">${c.email || ''}</small></td>
                <td class="text-end pe-3">
                    <button class="btn btn-sm btn-outline-secondary border-0" onclick="abrirModalCliente('${c.id}')" title="Editar / Ver Detalles">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

function filtrarClientesTabla() {
    const texto = document.getElementById('txtBuscarCliente').value.toLowerCase();
    const filtrados = listaClientesGlobal.filter(c => 
        c.nombre.toLowerCase().includes(texto) || 
        String(c.documento).includes(texto) ||
        String(c.celular).includes(texto)
    );
    renderizarTablaClientes(filtrados);
}

// =============================================================================
// 2. GESTIÓN DEL MODAL (CREAR / EDITAR)
// =============================================================================

function abrirModalCliente(id = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalCliente'));
    
    // Resetear formulario y tabs
    document.getElementById('formCliente').reset();
    document.getElementById('imgFotoPreview').src = "https://via.placeholder.com/150?text=Sin+Foto";
    document.getElementById('lblEdadCalculada').innerText = "";
    
    // Volver a la primera pestaña
    const firstTabBtn = document.querySelector('#tabsCliente button[data-bs-target="#tab-datos-cli"]');
    if(firstTabBtn) new bootstrap.Tab(firstTabBtn).show();

    // Resetear Stats
    document.getElementById('statTotalGastado').innerText = "S/ 0.00";
    document.getElementById('statVisitas').innerText = "0";
    document.getElementById('statFechaRegistro').innerText = "---";
    document.getElementById('tblHistorialBody').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Cargando...</td></tr>';

    if (id) {
        // MODO EDICIÓN
        const c = listaClientesGlobal.find(x => x.id === id);
        if(!c) return;
        
        clienteActualId = c.id;
        document.getElementById('hdnIdCliente').value = c.id;
        document.getElementById('lblTituloModalCliente').innerText = "Editar Cliente";
        
        // Llenar campos
        document.getElementById('txtCliNombre').value = c.nombre;
        document.getElementById('txtCliDoc').value = c.documento;
        document.getElementById('txtCliCelular').value = c.celular;
        document.getElementById('txtCliEmail').value = c.email;
        document.getElementById('txtCliDireccion').value = c.direccion;
        document.getElementById('txtCliNombreCorto').value = c.nombre_corto || '';
        document.getElementById('txtCliFotoUrl').value = c.foto || '';
        document.getElementById('txtCliNacimiento').value = c.fecha_nacimiento || '';

        // UI Updates
        actualizarPreviewFoto();
        calcularEdadCliente();
        
        // Cargar Estadísticas en segundo plano
        cargarEstadisticasCliente(c.id);

    } else {
        // MODO CREAR
        clienteActualId = null;
        document.getElementById('hdnIdCliente').value = '';
        document.getElementById('lblTituloModalCliente').innerText = "Nuevo Cliente";
        document.getElementById('tblHistorialBody').innerHTML = '<tr><td colspan="4" class="text-center text-muted fst-italic">Guardar cliente para ver historial.</td></tr>';
    }
    
    modal.show();
}

// =============================================================================
// 3. CONSULTA DNI (PROXY)
// =============================================================================

async function consultarDniDesdeModal() {
    const dni = document.getElementById('txtCliDoc').value.trim();
    const btn = document.querySelector('button[onclick="consultarDniDesdeModal()"]'); // Botón lupa
    const originalHtml = btn.innerHTML;

    if (dni.length < 8) {
        alert("⚠️ Ingresa un DNI válido (8 dígitos).");
        return;
    }

    // UI Loading
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        const res = await callAPI('clientes', 'buscarClienteDNI', { dni: dni });

        if (res.success && res.data) {
            const d = res.data;
            
            // Llenar campos
            document.getElementById('txtCliNombre').value = d.nombre_completo || '';
            document.getElementById('txtCliDireccion').value = d.direccion || '';
            
            if (d.fecha_nacimiento) {
                document.getElementById('txtCliNacimiento').value = d.fecha_nacimiento;
                calcularEdadCliente();
            }

            if (d.foto) {
                document.getElementById('txtCliFotoUrl').value = d.foto;
                actualizarPreviewFoto();
            }

            // Generar Nombre Corto automáticamente (Primer Nombre)
            if (d.nombre_completo) {
                const primerNombre = d.nombre_completo.split(' ')[0];
                document.getElementById('txtCliNombreCorto').value = primerNombre
                    .toLowerCase()
                    .replace(/^\w/, (c) => c.toUpperCase()); // Capitalizar
            }

            // Feedback visual de éxito
            document.getElementById('txtCliNombre').classList.add('is-valid');
            setTimeout(() => document.getElementById('txtCliNombre').classList.remove('is-valid'), 2000);

        } else {
            alert("⚠️ " + (res.error || "DNI no encontrado. Completa los datos manualmente."));
        }

    } catch (e) {
        alert("Error de conexión: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

// =============================================================================
// 4. ESTADÍSTICAS Y GUARDADO
// =============================================================================

async function cargarEstadisticasCliente(id) {
    if (!id) return;
    
    try {
        const res = await callAPI('clientes', 'obtenerHistorialCliente', { id_cliente: id });
        
        if (res.success) {
            // KPIs
            const stats = res.stats || { total_gastado: 0, visitas: 0, fecha_registro: '---' };
            document.getElementById('statTotalGastado').innerText = "S/ " + parseFloat(stats.total_gastado).toFixed(2);
            document.getElementById('statVisitas').innerText = stats.visitas;
            document.getElementById('statFechaRegistro').innerText = stats.fecha_registro;

            // Tabla Historial
            const tbody = document.getElementById('tblHistorialBody');
            tbody.innerHTML = '';
            
            if (res.historial && res.historial.length > 0) {
                res.historial.forEach(h => {
                    // Badge estado
                    let badgeClass = 'bg-secondary';
                    if (h.estado === 'Entregado') badgeClass = 'bg-dark';
                    if (h.estado === 'Pagado') badgeClass = 'bg-success';
                    if (h.estado === 'Anulado') badgeClass = 'bg-danger';

                    tbody.innerHTML += `
                        <tr>
                            <td>${h.fecha}</td>
                            <td class="font-monospace small">${h.ticket}</td>
                            <td><span class="badge ${badgeClass}">${h.estado}</span></td>
                            <td class="text-end fw-bold">S/ ${parseFloat(h.total).toFixed(2)}</td>
                        </tr>`;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin compras registradas.</td></tr>';
            }
        }
    } catch (e) {
        console.error("Error cargando stats", e);
    }
}

async function guardarClienteForm() {
    const btn = document.querySelector('#modalCliente .btn-primary');
    btn.disabled = true; 
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
    
    const payload = {
        id: document.getElementById('hdnIdCliente').value,
        nombre: document.getElementById('txtCliNombre').value,
        tipo_doc: document.getElementById('selCliTipoDoc').value,
        num_doc: document.getElementById('txtCliDoc').value,
        celular: document.getElementById('txtCliCelular').value,
        email: document.getElementById('txtCliEmail').value,
        direccion: document.getElementById('txtCliDireccion').value,
        fecha_nacimiento: document.getElementById('txtCliNacimiento').value,
        nombre_corto: document.getElementById('txtCliNombreCorto').value,
        foto_perfil: document.getElementById('txtCliFotoUrl').value
    };

    if(!payload.nombre || !payload.celular) {
        alert("⚠️ Nombre y Celular son obligatorios");
        btn.disabled = false; btn.innerText = "Guardar Cambios";
        return;
    }

    try {
        const res = await callAPI('clientes', 'guardarCliente', payload);
        if (res.success) {
            // Actualizar lista global localmente para no recargar todo si no es necesario
            // O simplemente recargar el módulo:
            bootstrap.Modal.getInstance(document.getElementById('modalCliente')).hide();
            alert("✅ Cliente guardado correctamente.");
            inicializarModuloClientes(); 
        } else {
            alert("Error: " + res.error);
        }
    } catch(e) { 
        alert("Error de red: " + e.message); 
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = '<i class="bi bi-save me-1"></i> Guardar Cambios';
    }
}

// =============================================================================
// 5. UTILIDADES (FOTO, EDAD)
// =============================================================================

function actualizarPreviewFoto() {
    const url = document.getElementById('txtCliFotoUrl').value;
    const img = document.getElementById('imgFotoPreview');
    if (url && url.length > 10) {
        img.src = url;
        img.onerror = function() { this.src = 'https://via.placeholder.com/150?text=Error+Url'; };
    } else {
        img.src = 'https://via.placeholder.com/150?text=Sin+Foto';
    }
}

function calcularEdadCliente() {
    const fechaStr = document.getElementById('txtCliNacimiento').value;
    const lbl = document.getElementById('lblEdadCalculada');
    
    if (!fechaStr) {
        lbl.innerText = "";
        return;
    }

    const nacimiento = new Date(fechaStr);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
    }

    if (edad >= 0) {
        lbl.innerText = `Edad calculada: ${edad} años`;
        
        // Si es cumpleaños hoy/pronto (Opcional - UX)
        if (nacimiento.getDate() === hoy.getDate() && nacimiento.getMonth() === hoy.getMonth()) {
            lbl.innerHTML += ' <span class="badge bg-warning text-dark ms-2">🎉 ¡Es su cumple!</span>';
        }
    } else {
        lbl.innerText = "Fecha futura inválida";
    }
}
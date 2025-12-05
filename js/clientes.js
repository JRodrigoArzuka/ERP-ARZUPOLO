/**
 * js/clientes.js
 * Lógica del Módulo de Clientes (Frontend).
 * VERSIÓN FINAL CORREGIDA: Fechas, Fotos Google Drive y UI Limpia.
 */

let listaClientesGlobal = [];
let clienteActualId = null; 

// =============================================================================
// 1. INICIALIZACIÓN Y LISTADO
// =============================================================================

async function inicializarModuloClientes() {
    const tbody = document.getElementById('tblClientesBody');
    if (!tbody) return;

    if(tbody.children.length <= 1) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary"></div><br>Cargando directorio...</td></tr>';
    }

    try {
        const res = await callAPI(
            'clientes', 'obtenerListaClientes', {},
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
    
    const listaVisible = lista.slice(0, 100); 

    listaVisible.forEach(c => {
        // Truco de imagen también para la miniatura de la tabla
        let urlImg = _convertirUrlDrive(c.foto);
        const avatar = urlImg 
            ? `<img src="${urlImg}" class="rounded-circle border me-2" style="width:32px;height:32px;object-fit:cover;">`
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
                    <button class="btn btn-sm btn-outline-secondary border-0" onclick="abrirModalCliente('${c.id}')" title="Editar">
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
// 2. GESTIÓN DEL MODAL
// =============================================================================

function abrirModalCliente(id = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalCliente'));
    
    document.getElementById('formCliente').reset();
    document.getElementById('imgFotoPreview').src = "https://via.placeholder.com/150?text=Sin+Foto";
    document.getElementById('txtCliFotoUrl').value = ""; // Limpiar hidden
    document.getElementById('lblEdadCalculada').innerText = "";
    document.getElementById('btnVerOriginal').classList.add('d-none');
    
    const firstTabBtn = document.querySelector('#tabsCliente button[data-bs-target="#tab-datos-cli"]');
    if(firstTabBtn) new bootstrap.Tab(firstTabBtn).show();

    // Reset Stats
    document.getElementById('statTotalGastado').innerText = "S/ 0.00";
    document.getElementById('statVisitas').innerText = "0";
    document.getElementById('statFechaRegistro').innerText = "---";
    document.getElementById('tblHistorialBody').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Cargando...</td></tr>';

    if (id) {
        const c = listaClientesGlobal.find(x => x.id === id);
        if(!c) return;
        
        clienteActualId = c.id;
        document.getElementById('hdnIdCliente').value = c.id;
        document.getElementById('lblTituloModalCliente').innerText = "Editar Cliente";
        
        document.getElementById('txtCliNombre').value = c.nombre;
        document.getElementById('txtCliDoc').value = c.documento;
        document.getElementById('txtCliCelular').value = c.celular;
        document.getElementById('txtCliEmail').value = c.email;
        document.getElementById('txtCliDireccion').value = c.direccion;
        document.getElementById('txtCliNombreCorto').value = c.nombre_corto || '';
        document.getElementById('txtCliFotoUrl').value = c.foto || '';
        
        // CORRECCIÓN FECHA: Asegurar YYYY-MM-DD
        if(c.fecha_nacimiento && c.fecha_nacimiento.length >= 10) {
            document.getElementById('txtCliNacimiento').value = c.fecha_nacimiento.substring(0, 10);
        }

        actualizarPreviewFoto();
        calcularEdadCliente();
        cargarEstadisticasCliente(c.id);

    } else {
        clienteActualId = null;
        document.getElementById('hdnIdCliente').value = '';
        document.getElementById('lblTituloModalCliente').innerText = "Nuevo Cliente";
        document.getElementById('tblHistorialBody').innerHTML = '<tr><td colspan="4" class="text-center text-muted fst-italic">Guardar cliente para ver historial.</td></tr>';
    }
    
    modal.show();
}

// =============================================================================
// 3. CONSULTA DNI Y TRUCOS
// =============================================================================

async function consultarDniDesdeModal() {
    const dni = document.getElementById('txtCliDoc').value.trim();
    const btn = document.querySelector('button[onclick="consultarDniDesdeModal()"]');
    const originalHtml = btn.innerHTML;

    if (dni.length < 8) { alert("⚠️ DNI inválido."); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        const res = await callAPI('clientes', 'buscarClienteDNI', { dni: dni });

        if (res.success && res.data) {
            const d = res.data;
            document.getElementById('txtCliNombre').value = d.nombre_completo || '';
            document.getElementById('txtCliDireccion').value = d.direccion || '';
            
            // CORRECCIÓN FECHA
            if (d.fecha_nacimiento && d.fecha_nacimiento.length >= 10) {
                document.getElementById('txtCliNacimiento').value = d.fecha_nacimiento.substring(0, 10);
                calcularEdadCliente();
            }

            if (d.foto) {
                document.getElementById('txtCliFotoUrl').value = d.foto;
                actualizarPreviewFoto();
            }

            if (d.nombre_completo) {
                const primerNombre = d.nombre_completo.split(' ')[0];
                document.getElementById('txtCliNombreCorto').value = primerNombre.toLowerCase().replace(/^\w/, c => c.toUpperCase());
            }

            document.getElementById('txtCliNombre').classList.add('is-valid');
            setTimeout(() => document.getElementById('txtCliNombre').classList.remove('is-valid'), 2000);
        } else {
            alert("⚠️ " + (res.error || "DNI no encontrado."));
        }
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

// --- TRUCO FOTO DRIVE ---
function _convertirUrlDrive(url) {
    if (!url) return "";
    
    // Detectar enlaces de Drive clásicos
    // Formatos: /file/d/ID/view o id=ID
    let id = "";
    
    const regex1 = /\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match1 = url.match(regex1);
    
    const regex2 = /id=([a-zA-Z0-9_-]+)/;
    const match2 = url.match(regex2);

    if (match1 && match1[1]) id = match1[1];
    else if (match2 && match2[1]) id = match2[1];

    if (id) {
        // Enlace directo de visualización de Google
        return `https://drive.google.com/uc?export=view&id=${id}`;
    }
    
    return url; // Si no es Drive, devolver tal cual
}

function actualizarPreviewFoto() {
    const rawUrl = document.getElementById('txtCliFotoUrl').value;
    const img = document.getElementById('imgFotoPreview');
    const btnVer = document.getElementById('btnVerOriginal');

    if (rawUrl) {
        const urlVisual = _convertirUrlDrive(rawUrl);
        img.src = urlVisual;
        img.onerror = function() { this.src = 'https://via.placeholder.com/150?text=Error+Url'; };
        
        btnVer.classList.remove('d-none');
        btnVer.href = rawUrl;
    } else {
        img.src = 'https://via.placeholder.com/150?text=Sin+Foto';
        btnVer.classList.add('d-none');
    }
}

function cambiarFotoPerfil() {
    const actual = document.getElementById('txtCliFotoUrl').value;
    const nueva = prompt("Pega aquí la URL de la nueva foto (Google Drive o Link directo):", actual);
    
    if (nueva !== null) {
        document.getElementById('txtCliFotoUrl').value = nueva.trim();
        actualizarPreviewFoto();
    }
}

// =============================================================================
// 4. OTROS Y GUARDADO
// =============================================================================

function calcularEdadCliente() {
    const fechaStr = document.getElementById('txtCliNacimiento').value;
    const lbl = document.getElementById('lblEdadCalculada');
    
    if (!fechaStr) { lbl.innerText = ""; return; }

    const nacimiento = new Date(fechaStr);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    if (edad >= 0) lbl.innerText = `Edad: ${edad} años`;
    else lbl.innerText = "Fecha inválida";
}

async function cargarEstadisticasCliente(id) {
    if (!id) return;
    try {
        const res = await callAPI('clientes', 'obtenerHistorialCliente', { id_cliente: id });
        if (res.success) {
            const stats = res.stats || { total_gastado: 0, visitas: 0, fecha_registro: '---' };
            document.getElementById('statTotalGastado').innerText = "S/ " + parseFloat(stats.total_gastado).toFixed(2);
            document.getElementById('statVisitas').innerText = stats.visitas;
            document.getElementById('statFechaRegistro').innerText = stats.fecha_registro;

            const tbody = document.getElementById('tblHistorialBody');
            tbody.innerHTML = '';
            if (res.historial && res.historial.length > 0) {
                res.historial.forEach(h => {
                    let badgeClass = 'bg-secondary';
                    if (h.estado === 'Entregado') badgeClass = 'bg-dark';
                    if (h.estado === 'Pagado') badgeClass = 'bg-success';
                    if (h.estado === 'Anulado') badgeClass = 'bg-danger';

                    tbody.innerHTML += `<tr><td>${h.fecha}</td><td class="font-monospace small">${h.ticket}</td><td><span class="badge ${badgeClass}">${h.estado}</span></td><td class="text-end fw-bold">S/ ${parseFloat(h.total).toFixed(2)}</td></tr>`;
                });
            } else { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin compras.</td></tr>'; }
        }
    } catch (e) { console.error("Error stats", e); }
}

async function guardarClienteForm() {
    const btn = document.querySelector('#modalCliente .btn-primary');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
    
    const payload = {
        id: document.getElementById('hdnIdCliente').value,
        nombre: document.getElementById('txtCliNombre').value,
        tipo_doc: document.getElementById('selCliTipoDoc').value,
        num_doc: document.getElementById('txtCliDoc').value,
        celular: document.getElementById('txtCliCelular').value,
        email: document.getElementById('txtCliEmail').value,
        direccion: document.getElementById('txtCliDireccion').value,
        fecha_nacimiento: document.getElementById('txtCliNacimiento').value, // Ya viene en YYYY-MM-DD del input date
        nombre_corto: document.getElementById('txtCliNombreCorto').value,
        foto_perfil: document.getElementById('txtCliFotoUrl').value
    };

    if(!payload.nombre || !payload.celular) {
        alert("⚠️ Nombre y Celular obligatorios");
        btn.disabled = false; btn.innerText = "Guardar Cambios";
        return;
    }

    try {
        const res = await callAPI('clientes', 'guardarCliente', payload);
        if (res.success) {
            bootstrap.Modal.getInstance(document.getElementById('modalCliente')).hide();
            alert("✅ Guardado.");
            inicializarModuloClientes(); 
        } else { alert("Error: " + res.error); }
    } catch(e) { alert("Red error: " + e.message); } 
    finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-save me-1"></i> Guardar Cambios'; }
}
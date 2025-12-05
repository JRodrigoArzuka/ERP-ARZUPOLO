/**
 * js/clientes.js
 * Lógica del Módulo de Clientes (Frontend).
 * VERSIÓN FINAL: Parser de Fechas Universal (Soporta 'Fri Jan 22...') y Fotos.
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
        const res = await callAPI('clientes', 'obtenerListaClientes', {}, (datosFrescos) => {
            if (datosFrescos.success) {
                listaClientesGlobal = datosFrescos.clientes;
                renderizarTablaClientes(listaClientesGlobal);
            }
        });

        if (res && res.success) {
            listaClientesGlobal = res.clientes;
            renderizarTablaClientes(listaClientesGlobal);
        } else if (res) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${res.error}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error conexión.</td></tr>';
    }
}

function renderizarTablaClientes(lista) {
    const tbody = document.getElementById('tblClientesBody');
    tbody.innerHTML = '';
    
    if (lista.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Sin datos.</td></tr>'; 
        return; 
    }
    
    const listaVisible = lista.slice(0, 100); 

    listaVisible.forEach(c => {
        let urlImg = _convertirUrlDrive(c.foto, 'view');
        const avatar = urlImg 
            ? `<img src="${urlImg}" class="rounded-circle border me-2" style="width:32px;height:32px;object-fit:cover;">`
            : `<div class="rounded-circle bg-light border d-inline-flex align-items-center justify-content-center me-2 text-muted fw-bold" style="width:32px;height:32px;">${c.nombre.charAt(0)}</div>`;

        let ubicacion = '-';
        if (c.distrito || c.provincia) ubicacion = `<small class="d-block text-truncate" style="max-width:150px;">${c.distrito}, ${c.provincia}</small>`;

        tbody.innerHTML += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        ${avatar}
                        <div>
                            <div class="fw-bold text-primary text-truncate" style="max-width:200px;">${c.nombre}</div>
                            ${c.nombre_corto ? `<small class="text-muted"><i class="bi bi-whatsapp me-1"></i>${c.nombre_corto}</small>` : ''}
                        </div>
                    </div>
                </td>
                <td><span class="badge bg-light text-dark border">${c.documento || '-'}</span></td>
                <td>${c.celular || '-'}</td>
                <td>${ubicacion}</td>
                <td class="text-end pe-3">
                    <button class="btn btn-sm btn-outline-secondary border-0" onclick="abrirModalCliente('${c.id}')"><i class="bi bi-pencil-square"></i></button>
                </td>
            </tr>`;
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
// 2. MODAL Y CONSULTA
// =============================================================================

function abrirModalCliente(id = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalCliente'));
    document.getElementById('formCliente').reset();
    document.getElementById('imgFotoPreview').src = "https://via.placeholder.com/150?text=Sin+Foto";
    document.getElementById('txtCliFotoUrl').value = ""; 
    document.getElementById('lblEdadCalculada').innerText = "";
    document.getElementById('btnVerOriginal').classList.add('d-none');
    
    const firstTabBtn = document.querySelector('#tabsCliente button[data-bs-target="#tab-datos-cli"]');
    if(firstTabBtn) new bootstrap.Tab(firstTabBtn).show();
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
        
        document.getElementById('txtCliDpto').value = c.departamento || '';
        document.getElementById('txtCliProv').value = c.provincia || '';
        document.getElementById('txtCliDist').value = c.distrito || '';
        document.getElementById('selCliGenero').value = c.genero || '';
        document.getElementById('txtCliHijos').value = c.hijos !== undefined ? c.hijos : '';

        if(c.fecha_nacimiento) {
            document.getElementById('txtCliNacimiento').value = _formatearFechaParaInput(c.fecha_nacimiento);
            calcularEdadCliente();
        }

        actualizarPreviewFoto();
        cargarEstadisticasCliente(c.id);
    } else {
        clienteActualId = null;
        document.getElementById('hdnIdCliente').value = '';
        document.getElementById('lblTituloModalCliente').innerText = "Nuevo Cliente";
    }
    modal.show();
}

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
            
            // Log para verificar en consola
            console.log("Datos recibidos:", d);

            document.getElementById('txtCliNombre').value = d.nombre_completo || '';
            
            let nombreCorto = '';
            if (d.nombres) nombreCorto = d.nombres.split(' ')[0];
            else if (d.nombre_completo) nombreCorto = d.nombre_completo.split(' ')[0];
            if(nombreCorto) document.getElementById('txtCliNombreCorto').value = nombreCorto.toLowerCase().replace(/^\w/, c => c.toUpperCase());

            document.getElementById('txtCliDireccion').value = d.direccion || '';
            document.getElementById('txtCliDpto').value = d.departamento || '';
            document.getElementById('txtCliProv').value = d.provincia || '';
            document.getElementById('txtCliDist').value = d.distrito || '';

            // Género
            if (d.genero) {
                const g = String(d.genero).toUpperCase().trim();
                // "F" o "FEMENINO"
                if (g.startsWith("F") || g.includes("FEM")) {
                    document.getElementById('selCliGenero').value = 'F';
                } 
                // "M" o "MASCULINO"
                else if (g.startsWith("M")) {
                    document.getElementById('selCliGenero').value = 'M';
                }
            }

            if (d.hijos !== null && d.hijos !== undefined) document.getElementById('txtCliHijos').value = d.hijos;

            // Fecha (AQUÍ ESTÁ LA MAGIA MEJORADA)
            if (d.fecha_nacimiento) {
                const fechaFinal = _formatearFechaParaInput(d.fecha_nacimiento);
                document.getElementById('txtCliNacimiento').value = fechaFinal;
                calcularEdadCliente();
            }

            // Foto
            if (d.foto) {
                document.getElementById('txtCliFotoUrl').value = _convertirUrlDrive(d.foto, 'download');
                actualizarPreviewFoto();
            } else {
                document.getElementById('txtCliFotoUrl').value = "";
                actualizarPreviewFoto();
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

// --- UTILIDADES ---

function _extraerIdDrive(url) {
    if (!url) return "";
    let id = "";
    const regex1 = /\/file\/d\/([a-zA-Z0-9_-]+)/;
    const regex2 = /id=([a-zA-Z0-9_-]+)/;
    const match1 = url.match(regex1);
    const match2 = url.match(regex2);
    if (match1 && match1[1]) id = match1[1];
    else if (match2 && match2[1]) id = match2[1];
    return id;
}

function _convertirUrlDrive(url, tipo) {
    const id = _extraerIdDrive(url);
    if (!id) return url;
    if (tipo === 'view') return `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
    if (tipo === 'download') return `https://drive.google.com/uc?export=download&id=${id}`;
    return url;
}

// *** FUNCIÓN DE FECHA MEJORADA ***
function _formatearFechaParaInput(fechaRaw) {
    if (!fechaRaw) return "";
    
    // 1. Convertir a string
    const f = String(fechaRaw).trim();

    // 2. Si ya es YYYY-MM-DD (ISO)
    if (f.match(/^\d{4}-\d{2}-\d{2}$/)) return f;

    // 3. Intento de parseo nativo JS (Maneja "Fri Jan 22 1993...")
    const fechaObj = new Date(fechaRaw);
    if (!isNaN(fechaObj.getTime())) {
        // Es válida, extraemos partes manualmente para evitar zona horaria
        const y = fechaObj.getFullYear();
        const m = String(fechaObj.getMonth() + 1).padStart(2, '0');
        const d = String(fechaObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // 4. Si es DD/MM/YYYY
    if (f.includes('/')) {
        const partes = f.split('/');
        if(partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }

    return ""; // Falló todo
}

function actualizarPreviewFoto() {
    const rawUrl = document.getElementById('txtCliFotoUrl').value;
    const img = document.getElementById('imgFotoPreview');
    const btnVer = document.getElementById('btnVerOriginal');

    if (rawUrl) {
        const urlVisual = _convertirUrlDrive(rawUrl, 'view');
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
    const nueva = prompt("URL de la nueva foto:", actual);
    if (nueva !== null) {
        document.getElementById('txtCliFotoUrl').value = _convertirUrlDrive(nueva.trim(), 'download');
        actualizarPreviewFoto();
    }
}

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
        fecha_nacimiento: document.getElementById('txtCliNacimiento').value,
        nombre_corto: document.getElementById('txtCliNombreCorto').value,
        foto_perfil: document.getElementById('txtCliFotoUrl').value, 
        departamento: document.getElementById('txtCliDpto').value,
        provincia: document.getElementById('txtCliProv').value,
        distrito: document.getElementById('txtCliDist').value,
        genero: document.getElementById('selCliGenero').value,
        hijos: document.getElementById('txtCliHijos').value
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
            alert("✅ Cliente guardado.");
            inicializarModuloClientes(); 
        } else { alert("Error: " + res.error); }
    } catch(e) { alert("Red error: " + e.message); } 
    finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-save me-1"></i> Guardar Cambios'; }
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
                    tbody.innerHTML += `<tr><td>${h.fecha}</td><td class="font-monospace small">${h.ticket}</td><td><span class="badge ${badgeClass}">${h.estado}</span></td><td class="text-end fw-bold">S/ ${parseFloat(h.total).toFixed(2)}</td></tr>`;
                });
            } else { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin compras.</td></tr>'; }
        }
    } catch (e) { console.error("Error stats", e); }
}
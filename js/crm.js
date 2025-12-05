/**
 * js/crm.js
 * Lógica para el Gestor de Reglas CRM y Automatización.
 * VERSIÓN FINAL: Upload de archivos y Pestañas.
 */

let reglasGlobales = [];
let estadosGlobales = [];

// =============================================================================
// 1. CARGAR LISTA
// =============================================================================

async function cargarCRM() {
    const tbody = document.getElementById('tblCrmBody');
    if(tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>';

    try {
        const res = await callAPI(
            'crm', 
            'obtenerPlantillasCRM', 
            {}, 
            (datosFrescos) => {
                if(datosFrescos.success) procesarDatosCRM(datosFrescos);
            }
        );
        
        if (res && res.success) {
            procesarDatosCRM(res);
        } else if (res) {
            if(tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: ${res.error}</td></tr>`;
        }

    } catch (e) {
        if(tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error de red</td></tr>`;
    }
}

function procesarDatosCRM(datos) {
    reglasGlobales = datos.plantillas;
    estadosGlobales = datos.listaEstados || [];
    
    // Fallback de estados
    if (estadosGlobales.length === 0) {
        estadosGlobales = ["Nuevo Pedido", "Pendiente", "Pagado", "En Produccion", "Entregado", "Anulado"];
    }

    llenarSelectsEstadosCRM();
    renderizarTablaCRM();
}

function llenarSelectsEstadosCRM() {
    // Llenar SELECT de Disparador (Tab 1)
    const selDisparador = document.getElementById('selCrmEstado');
    
    // Llenar SELECT de Acción Automática (Tab 3)
    const selAccion = document.getElementById('selCrmEstadoNuevo');
    
    if(!selDisparador || !selAccion) return;
    
    let html = '<option value="">- Seleccionar -</option>';
    
    estadosGlobales.forEach(item => {
        let nombre = item;
        try { if(typeof item === 'string' && item.startsWith('{')) nombre = JSON.parse(item).nombre; } catch(e){}
        html += `<option value="${nombre}">${nombre}</option>`;
    });
    
    selDisparador.innerHTML = html;
    selAccion.innerHTML = html;
}

function renderizarTablaCRM() {
    const tbody = document.getElementById('tblCrmBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (reglasGlobales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay reglas configuradas.</td></tr>';
        return;
    }

    reglasGlobales.forEach(r => {
        let detalle = '';
        if (r.tipo_disparador === 'Solo por Estado') {
            detalle = `<span class="badge bg-info text-dark">${r.estado}</span>`;
        } else {
            detalle = `<span class="badge bg-warning text-dark">${r.dias} días</span> ${r.tipo_disparador.includes('después') ? 'post' : 'pre'} ${r.fecha_ref}`;
        }

        // Icono de automatización
        let autoIcon = '-';
        if (r.palabra_clave) {
            autoIcon = `<span class="badge bg-success" title="Si responde '${r.palabra_clave}' -> ${r.estado_nuevo}"><i class="bi bi-lightning-charge-fill"></i> Auto</span>`;
        }

        const estadoIcon = r.activo ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-circle text-secondary"></i>';

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 fw-bold font-monospace small">${r.id}</td>
                <td><small>${r.tipo_disparador}</small></td>
                <td>${detalle}</td>
                <td>${autoIcon}</td>
                <td>${estadoIcon}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-light border" onclick="abrirModalCRM('${r.id}')"><i class="bi bi-pencil"></i></button>
                </td>
            </tr>
        `;
    });
}

// =============================================================================
// 2. EDICIÓN Y LÓGICA DE FORMULARIO
// =============================================================================

function toggleCamposCRM() {
    const tipo = document.getElementById('selCrmTipo').value;
    const divDias = document.getElementById('divCrmDias');
    const divFecha = document.getElementById('divCrmFechaRef');
    const divEstado = document.getElementById('divCrmEstado');

    if (tipo === 'Solo por Estado') {
        divDias.classList.add('d-none');
        divFecha.classList.add('d-none');
        divEstado.classList.remove('d-none');
    } else {
        divDias.classList.remove('d-none');
        divFecha.classList.remove('d-none');
        divEstado.classList.remove('d-none'); 
    }
}

function abrirModalCRM(id = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalCRM'));
    const btnEliminar = document.getElementById('btnEliminarCRM');
    
    // Resetear formulario
    document.getElementById('formCRM').reset();
    document.getElementById('txtCrmMensaje').value = '';
    document.getElementById('txtCrmAdjunto').value = '';
    document.getElementById('fileCrmAdjunto').value = '';
    document.getElementById('lblEstadoSubida').innerText = '';
    
    // Resetear Tabs
    const firstTab = document.querySelector('#tabsCRM button[data-bs-target="#tab-crm-config"]');
    if(firstTab) new bootstrap.Tab(firstTab).show();

    if (id) {
        const r = reglasGlobales.find(x => x.id === id);
        if (!r) return;

        // Tab 1: Config
        document.getElementById('txtCrmId').value = r.id;
        document.getElementById('txtCrmId').disabled = true; 
        document.getElementById('selCrmHoja').value = r.hoja_aplicacion;
        document.getElementById('selCrmTipo').value = r.tipo_disparador;
        document.getElementById('selCrmEstado').value = r.estado;
        document.getElementById('numCrmDias').value = r.dias;
        document.getElementById('selCrmFechaRef').value = r.fecha_ref;
        document.getElementById('chkCrmActivo').checked = r.activo;
        
        // Tab 2: Mensaje
        document.getElementById('txtCrmMensaje').value = r.mensaje;
        document.getElementById('txtCrmAdjunto').value = r.adjunto;

        // Tab 3: Automatización (NUEVO)
        document.getElementById('txtCrmPalabraClave').value = r.palabra_clave || '';
        document.getElementById('selCrmEstadoNuevo').value = r.estado_nuevo || '';
        
        btnEliminar.classList.remove('d-none');
        btnEliminar.setAttribute('onclick', `eliminarRegla('${id}')`);
    } else {
        document.getElementById('txtCrmId').disabled = false;
        btnEliminar.classList.add('d-none');
    }

    toggleCamposCRM();
    modal.show();
}

function insertarTag(tag) {
    const area = document.getElementById('txtCrmMensaje');
    if (area.selectionStart || area.selectionStart == '0') {
        const startPos = area.selectionStart;
        const endPos = area.selectionEnd;
        area.value = area.value.substring(0, startPos) + tag + area.value.substring(endPos, area.value.length);
    } else {
        area.value += tag;
    }
}

// =============================================================================
// 3. SUBIDA DE ARCHIVOS (NUEVO)
// =============================================================================

async function subirArchivoAdjunto() {
    const fileInput = document.getElementById('fileCrmAdjunto');
    const lblEstado = document.getElementById('lblEstadoSubida');
    const inputUrl = document.getElementById('txtCrmAdjunto');

    if (fileInput.files.length === 0) {
        alert("Selecciona un archivo primero.");
        return;
    }

    const file = fileInput.files[0];
    if (file.size > 5 * 1024 * 1024) { // 5MB límite
        alert("El archivo es muy grande (Máx 5MB).");
        return;
    }

    // UI Loading
    lblEstado.innerHTML = '<span class="spinner-border spinner-border-sm text-primary"></span> Subiendo a Drive...';
    lblEstado.className = 'text-primary small fw-bold';
    inputUrl.disabled = true;

    // Leer archivo
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = async function() {
        const base64 = reader.result.split(',')[1];
        
        try {
            const res = await callAPI('crm', 'subirAdjuntoCRM', {
                nombre: file.name,
                mimeType: file.type,
                base64: base64
            });

            if (res.success) {
                inputUrl.value = res.url;
                lblEstado.innerHTML = '<i class="bi bi-check-circle-fill"></i> Archivo subido y enlazado.';
                lblEstado.className = 'text-success small fw-bold';
            } else {
                lblEstado.innerText = "Error: " + res.error;
                lblEstado.className = 'text-danger small';
            }
        } catch (e) {
            lblEstado.innerText = "Error de red.";
            lblEstado.className = 'text-danger small';
        } finally {
            inputUrl.disabled = false;
        }
    };
}

// =============================================================================
// 4. GUARDAR Y ELIMINAR
// =============================================================================

async function guardarRegla() {
    const id = document.getElementById('txtCrmId').value.trim();
    if (!id) { alert("El ID es obligatorio"); return; }

    const payload = {
        id: id,
        hoja_aplicacion: document.getElementById('selCrmHoja').value,
        tipo_disparador: document.getElementById('selCrmTipo').value,
        estado: document.getElementById('selCrmEstado').value,
        dias: document.getElementById('numCrmDias').value,
        fecha_ref: document.getElementById('selCrmFechaRef').value,
        mensaje: document.getElementById('txtCrmMensaje').value,
        adjunto: document.getElementById('txtCrmAdjunto').value,
        activo: document.getElementById('chkCrmActivo').checked,
        
        // Campos nuevos
        palabra_clave: document.getElementById('txtCrmPalabraClave').value.toUpperCase().trim(),
        estado_nuevo: document.getElementById('selCrmEstadoNuevo').value
    };

    if(!confirm("¿Guardar regla CRM?")) return;

    const btn = document.querySelector('#modalCRM .btn-primary');
    btn.disabled = true; btn.innerText = "Guardando...";

    try {
        const res = await callAPI('crm', 'guardarPlantillaCRM', payload);
        if(res.success) {
            alert("✅ Guardado.");
            bootstrap.Modal.getInstance(document.getElementById('modalCRM')).hide();
            cargarCRM();
        } else {
            alert("⛔ Error: " + res.error);
        }
    } catch(e) { alert("Error de red"); }
    finally { btn.disabled = false; btn.innerText = "Guardar Regla"; }
}

async function eliminarRegla(id) {
    if(!confirm("¿Eliminar esta regla permanentemente?")) return;
    try {
        const res = await callAPI('crm', 'eliminarPlantillaCRM', { id: id });
        if(res.success) {
            alert("🗑️ Eliminado.");
            bootstrap.Modal.getInstance(document.getElementById('modalCRM')).hide();
            cargarCRM();
        } else {
            alert("Error: " + res.error);
        }
    } catch(e) { alert("Error red"); }
}
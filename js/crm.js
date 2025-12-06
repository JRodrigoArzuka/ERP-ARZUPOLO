/**
 * js/crm.js
 * Lógica del Motor de Flujos CRM (No-Code).
 * VERSIÓN 7.0: Manejo de Reglas Unificadas (Bot + Notificaciones).
 */

let reglasGlobales = [];
let estadosGlobales = [];

// =============================================================================
// 1. CARGA Y RENDERIZADO
// =============================================================================

async function cargarCRM() {
    const tbody = document.getElementById('tblCrmBody');
    if(tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5"><div class="spinner-border text-primary"></div><br>Cargando Motor de Flujos...</td></tr>';

    try {
        const res = await callAPI('crm', 'obtenerPlantillasCRM', {}, (datos) => {
            if(datos.success) procesarDatosCRM(datos);
        });

        if (res && res.success) {
            procesarDatosCRM(res);
        } else if (res) {
            if(tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error: ${res.error}</td></tr>`;
        }
    } catch (e) {
        if(tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error de conexión.</td></tr>`;
    }
}

function procesarDatosCRM(datos) {
    reglasGlobales = datos.plantillas || [];
    estadosGlobales = datos.listaEstados || [];
    
    // Fallback por si la lista viene vacía
    if (estadosGlobales.length === 0) {
        estadosGlobales = ["Nuevo Pedido", "Pendiente", "Pagado", "En Produccion", "Entregado", "Anulado"];
    }

    llenarSelectsCRM();
    renderizarTablaCRM();
}

function llenarSelectsCRM() {
    // 1. Select para disparador de SISTEMA (Cuando el estado cambia a...)
    const selTrigger = document.getElementById('selCrmEstadoTrigger');
    
    // 2. Select para acción de CAMBIO DE ESTADO
    const selAction = document.getElementById('selCrmAccionEstado');
    
    if(!selTrigger || !selAction) return;
    
    let html = '<option value="">- Seleccionar Estado -</option>';
    estadosGlobales.forEach(est => {
        let nombre = est;
        try { if(typeof est === 'string' && est.startsWith('{')) nombre = JSON.parse(est).nombre; } catch(e){}
        html += `<option value="${nombre}">${nombre}</option>`;
    });
    
    selTrigger.innerHTML = html;
    selAction.innerHTML = '<option value="">(No cambiar estado)</option>' + html;
}

function renderizarTablaCRM() {
    const tbody = document.getElementById('tblCrmBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (reglasGlobales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No hay flujos configurados.</td></tr>';
        return;
    }

    reglasGlobales.forEach(r => {
        // Icono Tipo
        let tipoBadge = '';
        let disparadorTexto = r.disparador;

        if (r.origen === 'SISTEMA') {
            tipoBadge = `<span class="badge bg-primary"><i class="bi bi-hdd-rack-fill me-1"></i> Sistema</span>`;
            disparadorTexto = `Cambio a: <b>${r.disparador}</b>`;
        } else {
            tipoBadge = `<span class="badge bg-success"><i class="bi bi-person-fill me-1"></i> Cliente</span>`;
            disparadorTexto = `Dice: <b>"${r.disparador}"</b>`;
        }

        // Acciones
        let acciones = [];
        if (r.mensaje) acciones.push('<i class="bi bi-chat-text" title="Envía Mensaje"></i>');
        if (r.adjunto) acciones.push('<i class="bi bi-paperclip" title="Envía Archivo"></i>');
        if (r.accion_estado) acciones.push(`<span class="badge bg-warning text-dark border"><i class="bi bi-arrow-right"></i> ${r.accion_estado}</span>`);
        if (r.accion_funcion) acciones.push(`<span class="badge bg-info text-dark border"><i class="bi bi-gear"></i> ${r.accion_funcion}</span>`);
        
        // Menú
        const menuIcon = r.menu_mostrar ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<span class="text-muted">-</span>';
        
        // Estado
        const activoIcon = r.activo ? '<span class="text-success fw-bold">ON</span>' : '<span class="text-danger fw-bold">OFF</span>';

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 fw-bold font-monospace small">${r.id}</td>
                <td>${tipoBadge}</td>
                <td>${disparadorTexto}</td>
                <td><div class="d-flex gap-2 align-items-center">${acciones.join('') || '-'}</div></td>
                <td class="text-center">${menuIcon}</td>
                <td>${activoIcon}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-light border" onclick="abrirModalCRM('${r.id}')"><i class="bi bi-pencil"></i></button>
                </td>
            </tr>
        `;
    });
}

// =============================================================================
// 2. LÓGICA DE INTERFAZ (TOGGLES)
// =============================================================================

function toggleCrmMode() {
    const esCliente = document.getElementById('optCliente').checked;
    
    // Paneles
    document.getElementById('panelCrmCliente').classList.toggle('d-none', !esCliente);
    document.getElementById('panelCrmSistema').classList.toggle('d-none', esCliente);
}

function toggleCrmMenu() {
    const mostrar = document.getElementById('chkCrmMenu').checked;
    document.getElementById('divCrmMenuText').classList.toggle('d-none', !mostrar);
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
// 3. GESTIÓN DEL MODAL (ABRIR/EDITAR)
// =============================================================================

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
    const firstTab = document.querySelector('#tabsCRM button[data-bs-target="#tab-crm-logic"]');
    if(firstTab) new bootstrap.Tab(firstTab).show();

    // Default: Modo Cliente
    document.getElementById('optCliente').checked = true;
    toggleCrmMode();
    toggleCrmMenu();

    if (id) {
        const r = reglasGlobales.find(x => x.id === id);
        if (!r) return;

        // Cargar Datos
        document.getElementById('txtCrmId').value = r.id;
        document.getElementById('txtCrmId').disabled = true;
        document.getElementById('chkCrmActivo').checked = r.activo;

        // Determinar Origen
        if (r.origen === 'SISTEMA') {
            document.getElementById('optSistema').checked = true;
            document.getElementById('selCrmEstadoTrigger').value = r.disparador;
        } else {
            document.getElementById('optCliente').checked = true;
            document.getElementById('txtCrmKeyword').value = r.disparador;
            document.getElementById('selCrmMatch').value = r.coincidencia || 'EXACTA';
            document.getElementById('chkCrmMenu').checked = r.menu_mostrar;
            document.getElementById('txtCrmMenuDesc').value = r.menu_texto || '';
        }
        toggleCrmMode();
        toggleCrmMenu();

        // Contenido y Acciones
        document.getElementById('txtCrmMensaje').value = r.mensaje;
        document.getElementById('txtCrmAdjunto').value = r.adjunto;
        document.getElementById('selCrmAccionEstado').value = r.accion_estado;
        document.getElementById('selCrmAccionFuncion').value = r.accion_funcion;

        btnEliminar.classList.remove('d-none');
        btnEliminar.setAttribute('onclick', `eliminarRegla('${id}')`);
    } else {
        // Modo Nuevo
        document.getElementById('txtCrmId').disabled = false;
        btnEliminar.classList.add('d-none');
    }

    modal.show();
}

// =============================================================================
// 4. SUBIDA DE ARCHIVOS
// =============================================================================

async function subirArchivoAdjunto() {
    const fileInput = document.getElementById('fileCrmAdjunto');
    const lblEstado = document.getElementById('lblEstadoSubida');
    const inputUrl = document.getElementById('txtCrmAdjunto');

    if (fileInput.files.length === 0) { alert("Selecciona un archivo."); return; }
    const file = fileInput.files[0];
    if (file.size > 5 * 1024 * 1024) { alert("Máx 5MB."); return; }

    lblEstado.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Subiendo...';
    inputUrl.disabled = true;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async function() {
        const base64 = reader.result.split(',')[1];
        try {
            const res = await callAPI('crm', 'subirAdjuntoCRM', { nombre: file.name, mimeType: file.type, base64: base64 });
            if (res.success) {
                inputUrl.value = res.url;
                lblEstado.innerHTML = '✅ Archivo enlazado.';
                lblEstado.className = 'text-success small fw-bold';
            } else {
                lblEstado.innerText = "Error: " + res.error;
            }
        } catch (e) { lblEstado.innerText = "Error red."; } 
        finally { inputUrl.disabled = false; }
    };
}

// =============================================================================
// 5. GUARDAR Y ELIMINAR
// =============================================================================

async function guardarRegla() {
    const id = document.getElementById('txtCrmId').value.trim();
    if (!id) { alert("El ID es obligatorio"); return; }

    const origen = document.getElementById('optSistema').checked ? 'SISTEMA' : 'CLIENTE';
    
    // Validar Disparador
    let disparador = '';
    if (origen === 'SISTEMA') {
        disparador = document.getElementById('selCrmEstadoTrigger').value;
        if(!disparador) { alert("Selecciona el Estado Disparador"); return; }
    } else {
        disparador = document.getElementById('txtCrmKeyword').value.trim().toUpperCase();
        if(!disparador) { alert("Escribe la Palabra Clave"); return; }
    }

    const payload = {
        id: id,
        origen: origen,
        disparador: disparador,
        coincidencia: document.getElementById('selCrmMatch').value,
        mensaje: document.getElementById('txtCrmMensaje').value,
        adjunto: document.getElementById('txtCrmAdjunto').value,
        accion_estado: document.getElementById('selCrmAccionEstado').value,
        accion_funcion: document.getElementById('selCrmAccionFuncion').value,
        menu_mostrar: document.getElementById('chkCrmMenu').checked,
        menu_texto: document.getElementById('txtCrmMenuDesc').value,
        activo: document.getElementById('chkCrmActivo').checked
    };

    if(!confirm("¿Guardar cambios en el flujo?")) return;

    const btn = document.querySelector('#modalCRM .btn-primary');
    btn.disabled = true; btn.innerText = "Guardando...";

    try {
        const res = await callAPI('crm', 'guardarPlantillaCRM', payload);
        if(res.success) {
            bootstrap.Modal.getInstance(document.getElementById('modalCRM')).hide();
            cargarCRM();
        } else { alert("⛔ Error: " + res.error); }
    } catch(e) { alert("Error red"); }
    finally { btn.disabled = false; btn.innerText = "Guardar Regla"; }
}

async function eliminarRegla(id) {
    if(!confirm("¿Eliminar esta regla permanentemente?")) return;
    try {
        const res = await callAPI('crm', 'eliminarPlantillaCRM', { id: id });
        if(res.success) {
            bootstrap.Modal.getInstance(document.getElementById('modalCRM')).hide();
            cargarCRM();
        } else { alert("Error: " + res.error); }
    } catch(e) { alert("Error red"); }
}
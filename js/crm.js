/**
 * js/crm.js
 * Lógica para el Gestor de Reglas CRM y Notificaciones.
 */

let reglasGlobales = [];

// 1. CARGAR LISTA (Se llama al iniciar la vista)
async function cargarCRM() {
    const tbody = document.getElementById('tblCrmBody');
    // Mostrar spinner mientras carga
    if(tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary"></div><div class="text-muted mt-2">Cargando reglas...</div></td></tr>';

    try {
        // Llamada al Backend
        const res = await callAPI('crm', 'obtenerPlantillasCRM');
        
        if (res.success) {
            reglasGlobales = res.plantillas;
            renderizarTablaCRM();
        } else {
            if(tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger fw-bold py-4">Error del servidor: ${res.error}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
        if(tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error de conexión. Verifique su internet o que el script esté implementado.</td></tr>`;
    }
}

function renderizarTablaCRM() {
    const tbody = document.getElementById('tblCrmBody');
    if(!tbody) return;
    
    tbody.innerHTML = '';

    if (reglasGlobales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4 fst-italic">No hay reglas configuradas aún.</td></tr>';
        return;
    }

    reglasGlobales.forEach(r => {
        let detalle = '';
        if (r.tipo_disparador === 'Solo por Estado') {
            detalle = `<span class="badge bg-info text-dark">${r.estado}</span>`;
        } else {
            detalle = `<span class="badge bg-warning text-dark">${r.dias} días</span> ${r.tipo_disparador.includes('después') ? 'después de' : 'antes de'} ${r.fecha_ref}`;
        }

        const estadoIcon = r.activo ? '<i class="bi bi-check-circle-fill text-success" title="Activa"></i>' : '<i class="bi bi-circle text-secondary" title="Inactiva"></i>';

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 fw-bold font-monospace small text-primary">${r.id}</td>
                <td><small>${r.tipo_disparador}</small></td>
                <td>${detalle}</td>
                <td>${estadoIcon}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-light border" onclick="abrirModalCRM('${r.id}')" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// 2. FORMULARIO DINÁMICO
function toggleCamposCRM() {
    const tipo = document.getElementById('selCrmTipo').value;
    const divDias = document.getElementById('divCrmDias');
    const divFecha = document.getElementById('divCrmFechaRef');
    const divEstado = document.getElementById('divCrmEstado');

    if (tipo === 'Solo por Estado') {
        divDias.classList.add('d-none');
        divFecha.classList.add('d-none');
        divEstado.classList.remove('d-none');
    } else if (tipo === 'En Estado por X Días') {
        divDias.classList.remove('d-none');
        divFecha.classList.remove('d-none'); 
        divEstado.classList.remove('d-none');
    } else {
        // Días antes/después
        divDias.classList.remove('d-none');
        divFecha.classList.remove('d-none');
        divEstado.classList.remove('d-none'); 
    }
}

function abrirModalCRM(id = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalCRM'));
    const btnEliminar = document.getElementById('btnEliminarCRM');
    
    if (id) {
        // MODO EDICIÓN
        const r = reglasGlobales.find(x => x.id === id);
        if (!r) return;

        document.getElementById('txtCrmId').value = r.id;
        document.getElementById('txtCrmId').disabled = true; 
        document.getElementById('selCrmHoja').value = r.hoja_aplicacion;
        document.getElementById('selCrmTipo').value = r.tipo_disparador;
        document.getElementById('selCrmEstado').value = r.estado;
        document.getElementById('numCrmDias').value = r.dias;
        document.getElementById('selCrmFechaRef').value = r.fecha_ref;
        document.getElementById('txtCrmMensaje').value = r.mensaje;
        document.getElementById('txtCrmAdjunto').value = r.adjunto;
        document.getElementById('chkCrmActivo').checked = r.activo;
        
        btnEliminar.classList.remove('d-none');
        btnEliminar.setAttribute('onclick', `eliminarRegla('${id}')`);
    } else {
        // MODO NUEVO
        document.getElementById('formCRM').reset();
        document.getElementById('txtCrmId').disabled = false;
        btnEliminar.classList.add('d-none');
    }

    toggleCamposCRM(); 
    modal.show();
}

function insertarTag(tag) {
    const textarea = document.getElementById('txtCrmMensaje');
    textarea.value += tag;
}

// 3. GUARDAR
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
        activo: document.getElementById('chkCrmActivo').checked
    };

    if(!confirm("¿Confirmar cambios en la regla?")) return;

    try {
        const res = await callAPI('crm', 'guardarPlantillaCRM', payload);
        if(res.success) {
            alert("✅ " + res.message);
            bootstrap.Modal.getInstance(document.getElementById('modalCRM')).hide();
            cargarCRM();
        } else {
            alert("⛔ Error: " + res.error);
        }
    } catch(e) {
        alert("Error de red: " + e.message);
    }
}

async function eliminarRegla(id) {
    if(!confirm("¿Seguro que deseas ELIMINAR esta regla permanentemente?")) return;
    
    try {
        const res = await callAPI('crm', 'eliminarPlantillaCRM', { id: id });
        if(res.success) {
            alert("🗑️ Regla eliminada.");
            bootstrap.Modal.getInstance(document.getElementById('modalCRM')).hide();
            cargarCRM();
        } else {
            alert("Error: " + res.error);
        }
    } catch(e) { alert("Error red: " + e.message); }
}
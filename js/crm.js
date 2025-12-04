/**
 * js/crm.js
 * Lógica para el Gestor de Reglas CRM y Notificaciones.
 * VERSIÓN FINAL: Integración con los 11 Estados del Ciclo de Vida.
 */

let reglasGlobales = [];
let estadosGlobales = [];

// =============================================================================
// 1. CARGAR LISTA
// =============================================================================

async function cargarCRM() {
    const tbody = document.getElementById('tblCrmBody');
    if(tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>';

    try {
        const res = await callAPI(
            'crm', 
            'obtenerPlantillasCRM', 
            {}, 
            (datosFrescos) => {
                if(datosFrescos.success) {
                    procesarDatosCRM(datosFrescos);
                }
            }
        );
        
        if (res && res.success) {
            procesarDatosCRM(res);
        } else if (res) {
            if(tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${res.error}</td></tr>`;
        }

    } catch (e) {
        console.error(e);
        if(tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error de red</td></tr>`;
    }
}

function procesarDatosCRM(datos) {
    reglasGlobales = datos.plantillas;
    estadosGlobales = datos.listaEstados || [];
    
    // Si la lista viene vacía, usamos los defaults
    if (estadosGlobales.length === 0) {
        estadosGlobales = [
            "Nuevo Pedido", "Pendiente de Envio", "Pendiente Aprobación", 
            "Aprobado", "En Producción", "Producto Listo", "Enviado", 
            "Entregado", "Anulado", "Registro de Anulacion", "Pendiente de Pago"
        ];
    }

    llenarSelectEstadosCRM();
    renderizarTablaCRM();
}

function llenarSelectEstadosCRM() {
    const sel = document.getElementById('selCrmEstado');
    if(!sel) return;
    
    const valorPrevio = sel.value;
    sel.innerHTML = '<option value="">Cualquiera</option>';
    
    estadosGlobales.forEach(item => {
        let nombre = item;
        // Soporte para objetos JSON {nombre, color} si vienen así
        try { if(typeof item === 'string' && item.startsWith('{')) nombre = JSON.parse(item).nombre; } catch(e){}
        
        sel.innerHTML += `<option value="${nombre}">${nombre}</option>`;
    });
    
    if(valorPrevio) sel.value = valorPrevio;
}

function renderizarTablaCRM() {
    const tbody = document.getElementById('tblCrmBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (reglasGlobales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No hay reglas configuradas.</td></tr>';
        return;
    }

    reglasGlobales.forEach(r => {
        let detalle = '';
        if (r.tipo_disparador === 'Solo por Estado') {
            detalle = `<span class="badge bg-info text-dark">${r.estado}</span>`;
        } else {
            detalle = `<span class="badge bg-warning text-dark">${r.dias} días</span> ${r.tipo_disparador.includes('después') ? 'después de' : 'antes de'} ${r.fecha_ref}`;
        }

        const estadoIcon = r.activo ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-circle text-secondary"></i>';

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 fw-bold font-monospace small">${r.id}</td>
                <td><small>${r.tipo_disparador}</small></td>
                <td>${detalle}</td>
                <td>${estadoIcon}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-light border" onclick="abrirModalCRM('${r.id}')"><i class="bi bi-pencil"></i></button>
                </td>
            </tr>
        `;
    });
}

// =============================================================================
// 2. EDICIÓN Y GUARDADO
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
    } else if (tipo === 'En Estado por X Días') {
        divDias.classList.remove('d-none');
        divFecha.classList.remove('d-none'); // Fecha referencia sirve como 'Desde cuándo cuento'
        divEstado.classList.remove('d-none');
    } else {
        // Días antes/después de fecha
        divDias.classList.remove('d-none');
        divFecha.classList.remove('d-none');
        divEstado.classList.remove('d-none'); // Opcional, puede filtrar por estado (ej: solo 'Entregado')
    }
}

function abrirModalCRM(id = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalCRM'));
    const btnEliminar = document.getElementById('btnEliminarCRM');
    
    // Asegurar que el select esté lleno antes de abrir
    if (document.getElementById('selCrmEstado').options.length <= 1) {
        llenarSelectEstadosCRM();
    }

    if (id) {
        const r = reglasGlobales.find(x => x.id === id);
        if (!r) return;

        document.getElementById('txtCrmId').value = r.id;
        document.getElementById('txtCrmId').disabled = true; // No editar ID
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
        document.getElementById('formCRM').reset();
        document.getElementById('txtCrmId').disabled = false;
        btnEliminar.classList.add('d-none');
    }

    toggleCamposCRM();
    modal.show();
}

function insertarTag(tag) {
    const area = document.getElementById('txtCrmMensaje');
    // Insertar en la posición del cursor si es posible, sino al final
    if (area.selectionStart || area.selectionStart == '0') {
        const startPos = area.selectionStart;
        const endPos = area.selectionEnd;
        area.value = area.value.substring(0, startPos) + tag + area.value.substring(endPos, area.value.length);
    } else {
        area.value += tag;
    }
}

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

    if(!confirm("¿Guardar regla?")) return;

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
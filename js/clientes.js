/**
 * js/clientes.js
 * Lógica del Módulo de Clientes (Optimizado SWR).
 * VERSIÓN FINAL CORREGIDA.
 */

let listaClientesGlobal = [];

async function inicializarModuloClientes() {
    const tbody = document.getElementById('tblClientesBody');
    if (!tbody) return;

    // Spinner solo si está vacío
    if(tbody.children.length <= 1) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary"></div><br>Cargando directorio...</td></tr>';
    }

    try {
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
    }
}

function renderizarTablaClientes(lista) {
    const tbody = document.getElementById('tblClientesBody');
    tbody.innerHTML = '';
    if (lista.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Sin clientes.</td></tr>'; 
        return; 
    }
    
    const listaVisible = lista.slice(0, 100); 

    listaVisible.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold text-primary">${c.nombre}</td>
                <td>${c.documento || '-'}</td>
                <td>${c.celular || '-'}</td>
                <td><button class="btn btn-sm btn-outline-info border-0" onclick="verHistorial('${c.id}')"><i class="bi bi-clock-history"></i></button></td>
                <td class="text-end"><button class="btn btn-sm btn-light border" onclick="abrirModalCliente('${c.id}')"><i class="bi bi-pencil"></i></button></td>
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

// CREAR / EDITAR
function abrirModalCliente(id = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalCliente'));
    document.getElementById('formCliente').reset();
    
    if (id) {
        const c = listaClientesGlobal.find(x => x.id === id);
        if(!c) return;
        document.getElementById('hdnIdCliente').value = c.id;
        document.getElementById('txtCliNombre').value = c.nombre;
        document.getElementById('txtCliDoc').value = c.documento;
        document.getElementById('txtCliCelular').value = c.celular;
        document.getElementById('txtCliEmail').value = c.email;
        document.getElementById('txtCliDireccion').value = c.direccion;
        document.getElementById('lblTituloModalCliente').innerText = "Editar Cliente";
    } else {
        document.getElementById('hdnIdCliente').value = '';
        document.getElementById('lblTituloModalCliente').innerText = "Nuevo Cliente";
    }
    modal.show();
}

async function guardarClienteForm() {
    const btn = document.querySelector('#modalCliente .btn-primary');
    btn.disabled = true; btn.innerText = "Guardando...";
    
    const payload = {
        id: document.getElementById('hdnIdCliente').value,
        nombre: document.getElementById('txtCliNombre').value,
        num_doc: document.getElementById('txtCliDoc').value,
        celular: document.getElementById('txtCliCelular').value,
        email: document.getElementById('txtCliEmail').value,
        direccion: document.getElementById('txtCliDireccion').value,
        tipo_doc: document.getElementById('selCliTipoDoc').value
    };

    if(!payload.nombre || !payload.celular) {
        alert("Nombre y Celular son obligatorios");
        btn.disabled = false; btn.innerText = "Guardar";
        return;
    }

    try {
        const res = await callAPI('clientes', 'guardarCliente', payload);
        if (res.success) {
            alert("✅ Guardado.");
            bootstrap.Modal.getInstance(document.getElementById('modalCliente')).hide();
            inicializarModuloClientes();
        } else {
            alert("Error: " + res.error);
        }
    } catch(e) { alert("Error red"); }
    finally { btn.disabled = false; btn.innerText = "Guardar"; }
}

async function verHistorial(idCliente) {
    const modal = new bootstrap.Modal(document.getElementById('modalHistorialCliente'));
    const tbody = document.getElementById('tblHistorialBody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';
    modal.show();

    const res = await callAPI('clientes', 'obtenerHistorialCliente', { id_cliente: idCliente });
    
    tbody.innerHTML = '';
    if (res.success && res.historial.length > 0) {
        res.historial.forEach(h => {
            tbody.innerHTML += `<tr><td>${h.ticket}</td><td>${h.fecha}</td><td>${h.estado}</td><td class="text-end">S/ ${parseFloat(h.total).toFixed(2)}</td></tr>`;
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin compras.</td></tr>';
    }
}
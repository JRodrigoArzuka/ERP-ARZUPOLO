/**
 * js/configuracion.js
 * Lógica del Frontend para el Módulo de Configuración.
 */

let globalConfigData = {
    listas: {},
    usuarios: []
};
let categoriaActual = 'Tipo_Evento'; // Categoría por defecto en maestros

// =============================================================================
// 1. CARGA INICIAL
// =============================================================================
async function cargarConfiguracion() {
    // UI: Mostrar cargando en los inputs
    document.getElementById('txtConfigDocId').placeholder = "Cargando...";
    document.getElementById('listaItemsMaestros').innerHTML = '<li class="list-group-item text-center"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando datos...</li>';
    document.getElementById('tblUsuariosBody').innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando usuarios...</td></tr>';

    try {
        const res = await callAPI('configuracion', 'obtenerDataConfiguracion');

        if (res.success) {
            // A. Llenar Claves (Conexiones)
            document.getElementById('txtConfigDocId').value = res.claves.DOC_TEMPLATE_ID || '';
            document.getElementById('txtConfigFolderContratos').value = res.claves.CONTRACTS_FOLDER_ID || '';
            document.getElementById('txtConfigFolderImagenes').value = res.claves.IMAGE_FOLDER_ID || '';
            document.getElementById('txtConfigLoyverse').value = res.claves.LOYVERSE_API_TOKEN || '';
            document.getElementById('txtConfigWasender').value = res.claves.WASENDER_API_KEY || '';

            // B. Guardar datos globales y renderizar
            globalConfigData.listas = res.listas;
            globalConfigData.usuarios = res.usuarios;

            renderizarMaestros();
            renderizarUsuarios();

        } else {
            alert("Error cargando configuración: " + res.error);
        }
    } catch (e) {
        console.error(e);
        alert("Error de conexión al cargar configuración.");
    }
}

// =============================================================================
// 2. PESTAÑA 1: CONEXIONES
// =============================================================================
async function guardarClaves() {
    const btn = document.querySelector('#formClaves button');
    const originalText = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

    const payload = {
        DOC_TEMPLATE_ID: document.getElementById('txtConfigDocId').value,
        CONTRACTS_FOLDER_ID: document.getElementById('txtConfigFolderContratos').value,
        IMAGE_FOLDER_ID: document.getElementById('txtConfigFolderImagenes').value,
        LOYVERSE_API_TOKEN: document.getElementById('txtConfigLoyverse').value,
        WASENDER_API_KEY: document.getElementById('txtConfigWasender').value
    };

    const res = await callAPI('configuracion', 'guardarClavesSistema', payload);
    
    if (res.success) {
        alert("✅ Conexiones guardadas exitosamente.");
    } else {
        alert("❌ Error: " + res.error);
    }
    btn.disabled = false; btn.innerHTML = originalText;
}

// =============================================================================
// 3. PESTAÑA 2: LISTAS MAESTRAS
// =============================================================================
function seleccionarCategoria(cat, btnElement) {
    categoriaActual = cat;
    
    // Actualizar UI activa
    document.querySelectorAll('#listCategoriasMaestras button').forEach(b => b.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
    
    // Actualizar título
    document.getElementById('lblCategoriaSeleccionada').innerText = btnElement ? btnElement.innerText : cat;
    
    renderizarMaestros();
}

function renderizarMaestros() {
    const lista = globalConfigData.listas[categoriaActual] || [];
    const ul = document.getElementById('listaItemsMaestros');
    ul.innerHTML = '';

    if (lista.length === 0) {
        ul.innerHTML = '<li class="list-group-item text-muted text-center fst-italic">No hay items registrados.</li>';
        return;
    }

    lista.forEach(item => {
        ul.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${item}
                <button class="btn btn-sm btn-outline-danger border-0" onclick="eliminarItemMaestro('${item}')" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </li>
        `;
    });
}

async function agregarItemMaestro() {
    const input = document.getElementById('txtNuevoItemMaestro');
    const valor = input.value.trim();
    if (!valor) return;

    // UI Optimista (Agregamos visualmente mientras guarda)
    const ul = document.getElementById('listaItemsMaestros');
    const tempId = 'temp-' + Date.now();
    ul.insertAdjacentHTML('beforeend', `<li id="${tempId}" class="list-group-item text-muted">${valor} <span class="spinner-border spinner-border-sm float-end"></span></li>`);
    input.value = '';

    const res = await callAPI('configuracion', 'gestionarMaestro', {
        accion: 'agregar',
        categoria: categoriaActual,
        valor: valor
    });

    if (res.success) {
        // Actualizar datos locales
        if(!globalConfigData.listas[categoriaActual]) globalConfigData.listas[categoriaActual] = [];
        globalConfigData.listas[categoriaActual].push(valor);
        renderizarMaestros();
    } else {
        alert("Error: " + res.error);
        document.getElementById(tempId).remove();
    }
}

async function eliminarItemMaestro(valor) {
    if (!confirm(`¿Eliminar "${valor}" de la lista?`)) return;

    const res = await callAPI('configuracion', 'gestionarMaestro', {
        accion: 'eliminar',
        categoria: categoriaActual,
        valor: valor
    });

    if (res.success) {
        // Filtrar localmente y redibujar
        globalConfigData.listas[categoriaActual] = globalConfigData.listas[categoriaActual].filter(i => i !== valor);
        renderizarMaestros();
    } else {
        alert("Error eliminando: " + res.error);
    }
}

// =============================================================================
// 4. PESTAÑA 3: USUARIOS
// =============================================================================
function renderizarUsuarios() {
    const tbody = document.getElementById('tblUsuariosBody');
    tbody.innerHTML = '';

    globalConfigData.usuarios.forEach(u => {
        tbody.innerHTML += `
            <tr>
                <td>
                    <div class="fw-bold">${u.nombre}</div>
                    <div class="small text-muted">${u.celular}</div>
                </td>
                <td>${u.usuario}</td>
                <td><span class="badge bg-secondary">${u.rol}</span></td>
                <td>
                    <span class="badge ${u.activo ? 'bg-success' : 'bg-danger'}">${u.activo ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td class="text-end">
                    <button class="btn btn-sm btn-light border" onclick="abrirModalUsuario('${u.id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

function abrirModalUsuario(idUsuario = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalUsuario'));
    
    if (idUsuario) {
        // MODO EDICIÓN
        const u = globalConfigData.usuarios.find(x => x.id === idUsuario);
        if(!u) return;

        document.getElementById('hdnIdUsuario').value = u.id;
        document.getElementById('txtUserNombre').value = u.nombre;
        document.getElementById('txtUserCelular').value = u.celular;
        document.getElementById('selUserRol').value = u.rol;
        document.getElementById('txtUserLogin').value = u.usuario;
        document.getElementById('txtUserPass').value = ''; // No mostrar password
        document.querySelector('#modalUsuario .modal-title').innerText = "Editar Usuario";
    } else {
        // MODO NUEVO
        document.getElementById('formUsuario').reset();
        document.getElementById('hdnIdUsuario').value = '';
        document.querySelector('#modalUsuario .modal-title').innerText = "Nuevo Usuario";
    }
    
    modal.show();
}

async function guardarUsuario() {
    const id = document.getElementById('hdnIdUsuario').value;
    const nombre = document.getElementById('txtUserNombre').value;
    const login = document.getElementById('txtUserLogin').value;
    const pass = document.getElementById('txtUserPass').value;

    if (!nombre || !login) {
        alert("Nombre y Usuario son obligatorios.");
        return;
    }
    if (!id && !pass) {
        alert("Debes asignar una contraseña al crear un usuario.");
        return;
    }

    const btn = document.querySelector('#modalUsuario .modal-footer .btn-primary');
    btn.disabled = true; btn.innerText = "Guardando...";

    const payload = {
        id: id,
        nombre: nombre,
        celular: document.getElementById('txtUserCelular').value,
        rol: document.getElementById('selUserRol').value,
        usuario: login,
        password: pass
    };

    const res = await callAPI('configuracion', 'gestionarUsuario', payload);

    if (res.success) {
        alert("Usuario guardado.");
        bootstrap.Modal.getInstance(document.getElementById('modalUsuario')).hide();
        cargarConfiguracion(); // Recargar todo para ver cambios
    } else {
        alert("Error: " + res.error);
    }
    btn.disabled = false; btn.innerText = "Guardar Usuario";
}
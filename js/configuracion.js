/**
 * js/configuracion.js
 * Lógica del Frontend para el Módulo de Configuración (Con Caché).
 */

let globalConfigData = { listas: {}, usuarios: [] };
let categoriaActual = 'Tipo_Evento';

// 1. CARGA INICIAL
async function cargarConfiguracion() {
    document.getElementById('txtConfigDocId').placeholder = "Cargando...";
    document.getElementById('listaItemsMaestros').innerHTML = '<li class="list-group-item text-center"><div class="spinner-border spinner-border-sm text-primary"></div></li>';

    try {
       const res = await callAPI('crm', 'obtenerPlantillasCRM', {}, (datosFrescos) => {
         if(datosFrescos.success) {
             reglasGlobales = datosFrescos.plantillas;
             estadosGlobales = datosFrescos.listaEstados || [];
             llenarSelectEstadosCRM();
             renderizarTablaCRM();
         }
    });
    
    if (res && res.success) {
        // Renderizado Inicial (Caché)
        reglasGlobales = res.plantillas;
        estadosGlobales = res.listaEstados || [];
        llenarSelectEstadosCRM();
        renderizarTablaCRM();
    }
    } catch (e) { console.error(e); }
}

// 2. ACCIONES SISTEMA
async function toggleCacheSistema() {
    const activo = document.getElementById('chkConfigCache').checked;
    
    // 1. Actualizar Localmente
    CacheSystem.toggle(activo);
    
    // 2. Actualizar Servidor (Para que sea persistente)
    try {
        const res = await callAPI('configuracion', 'guardarEstadoCache', { activo: activo });
        if(res.success) {
            // Notificación visual simple
            const btn = document.querySelector('button[onclick="cargarConfiguracion()"]');
            const orig = btn.innerHTML;
            btn.innerText = res.message; // "Caché ACTIVADO"
            setTimeout(() => btn.innerHTML = orig, 2000);
        }
    } catch(e) { console.error(e); }
}

async function guardarClaves() {
    const btn = document.querySelector('#formClaves button');
    btn.disabled = true; btn.innerText = "Guardando...";

    const payload = {
        DOC_TEMPLATE_ID: document.getElementById('txtConfigDocId').value,
        CONTRACTS_FOLDER_ID: document.getElementById('txtConfigFolderContratos').value,
        IMAGE_FOLDER_ID: document.getElementById('txtConfigFolderImagenes').value,
        LOYVERSE_API_TOKEN: document.getElementById('txtConfigLoyverse').value,
        WASENDER_API_KEY: document.getElementById('txtConfigWasender').value
    };

    const res = await callAPI('configuracion', 'guardarClavesSistema', payload);
    if (res.success) alert("✅ Guardado."); else alert("❌ " + res.error);
    btn.disabled = false; btn.innerText = "Guardar Conexiones";
}

// 3. MAESTROS
function seleccionarCategoria(cat, btn) {
    categoriaActual = cat;
    document.querySelectorAll('#listCategoriasMaestras button').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    document.getElementById('lblCategoriaSeleccionada').innerText = btn ? btn.innerText : cat;
    renderizarMaestros();
}

function renderizarMaestros() {
    const lista = globalConfigData.listas[categoriaActual] || [];
    const ul = document.getElementById('listaItemsMaestros');
    ul.innerHTML = '';
    if (lista.length === 0) { ul.innerHTML = '<li class="list-group-item text-muted text-center fst-italic">Vacío</li>'; return; }
    lista.forEach(item => {
        ul.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">${item}<button class="btn btn-sm text-danger" onclick="eliminarItemMaestro('${item}')"><i class="bi bi-trash"></i></button></li>`;
    });
}

async function agregarItemMaestro() {
    const input = document.getElementById('txtNuevoItemMaestro');
    const valor = input.value.trim();
    if (!valor) return;
    
    input.value = '';
    const res = await callAPI('configuracion', 'gestionarMaestro', { accion: 'agregar', categoria: categoriaActual, valor: valor });
    if (res.success) {
        if(!globalConfigData.listas[categoriaActual]) globalConfigData.listas[categoriaActual] = [];
        globalConfigData.listas[categoriaActual].push(valor);
        renderizarMaestros();
    } else alert(res.error);
}

async function eliminarItemMaestro(valor) {
    if (!confirm("¿Eliminar?")) return;
    const res = await callAPI('configuracion', 'gestionarMaestro', { accion: 'eliminar', categoria: categoriaActual, valor: valor });
    if (res.success) {
        globalConfigData.listas[categoriaActual] = globalConfigData.listas[categoriaActual].filter(i => i !== valor);
        renderizarMaestros();
    } else alert(res.error);
}

// 4. USUARIOS
function renderizarUsuarios() {
    const tbody = document.getElementById('tblUsuariosBody');
    tbody.innerHTML = '';
    globalConfigData.usuarios.forEach(u => {
        tbody.innerHTML += `<tr><td>${u.nombre}</td><td>${u.usuario}</td><td><span class="badge bg-secondary">${u.rol}</span></td><td>${u.activo ? 'Activo' : 'Inactivo'}</td><td class="text-end"><button class="btn btn-sm btn-light border" onclick="abrirModalUsuario('${u.id}')"><i class="bi bi-pencil"></i></button></td></tr>`;
    });
}

function abrirModalUsuario(id = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalUsuario'));
    if (id) {
        const u = globalConfigData.usuarios.find(x => x.id === id);
        document.getElementById('hdnIdUsuario').value = u.id;
        document.getElementById('txtUserNombre').value = u.nombre;
        document.getElementById('txtUserCelular').value = u.celular;
        document.getElementById('selUserRol').value = u.rol;
        document.getElementById('txtUserLogin').value = u.usuario;
    } else {
        document.getElementById('formUsuario').reset();
        document.getElementById('hdnIdUsuario').value = '';
    }
    modal.show();
}

async function guardarUsuario() {
    const id = document.getElementById('hdnIdUsuario').value;
    const payload = {
        id: id,
        nombre: document.getElementById('txtUserNombre').value,
        celular: document.getElementById('txtUserCelular').value,
        rol: document.getElementById('selUserRol').value,
        usuario: document.getElementById('txtUserLogin').value,
        password: document.getElementById('txtUserPass').value
    };
    const res = await callAPI('configuracion', 'gestionarUsuario', payload);
    if (res.success) {
        bootstrap.Modal.getInstance(document.getElementById('modalUsuario')).hide();
        cargarConfiguracion();
    } else alert(res.error);
}
// =============================================================================
// 5. PRUEBAS DE CONEXIÓN
// =============================================================================

async function enviarPruebaWsp() {
    const numero = document.getElementById('txtTestWspNumero').value;
    const mensaje = document.getElementById('txtTestWspMensaje').value;

    if (!numero) {
        alert("Por favor ingresa un número de celular.");
        return;
    }

    const btn = document.querySelector('button[onclick="enviarPruebaWsp()"]');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    const payload = {
        numero: numero,
        mensaje: mensaje
    };

    try {
        // Asegúrate de que 'probandoConexionWhatsApp' esté en tu API_Handler
        const res = await callAPI('configuracion', 'probandoConexionWhatsApp', payload);
        
        if (res.success) {
            alert("✅ " + res.message);
        } else {
            alert("❌ Falló: " + res.error);
        }
    } catch (e) {
        alert("Error de red: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
/**
 * js/configuracion.js
 * Lógica del Frontend para Configuración.
 * VERSIÓN FINAL: Gestión de Estados con Edición de Colores.
 */

let globalConfigData = { listas: {}, usuarios: [] };
let categoriaActual = 'Estado_Pedido'; 

// Los 11 Estados del Ciclo de Vida (Base)
const ESTADOS_DEFAULT = [
    { nombre: "Nuevo Pedido", color: "#0dcaf0" },          
    { nombre: "Pendiente de Envio", color: "#ffc107" },    
    { nombre: "Pendiente Aprobación", color: "#6c757d" },  
    { nombre: "Aprobado", color: "#0d6efd" },              
    { nombre: "En Producción", color: "#fd7e14" },         
    { nombre: "Producto Listo", color: "#198754" },        
    { nombre: "Enviado", color: "#20c997" },               
    { nombre: "Entregado", color: "#212529" },             
    { nombre: "Anulado", color: "#dc3545" },               
    { nombre: "Registro de Anulacion", color: "#6610f2" }, 
    { nombre: "Pendiente de Pago", color: "#d63384" }      
];

// =============================================================================
// 1. CARGA INICIAL
// =============================================================================

async function cargarConfiguracion() {
    document.getElementById('txtConfigDocId').placeholder = "Cargando...";
    document.getElementById('listaItemsMaestros').innerHTML = '<li class="list-group-item text-center"><div class="spinner-border spinner-border-sm text-primary"></div></li>';

    try {
        const res = await callAPI('configuracion', 'obtenerDataConfiguracion', {}, (datosFrescos) => {
            if (datosFrescos.success) procesarDatosConfig(datosFrescos);
        });

        if (res && res.success) procesarDatosConfig(res);
    } catch (e) { console.error(e); }
}

function procesarDatosConfig(datos) {
    globalConfigData = datos;
    
    // Claves
    if (datos.claves) {
        document.getElementById('txtConfigDocId').value = datos.claves.DOC_TEMPLATE_ID || '';
        document.getElementById('txtConfigFolderContratos').value = datos.claves.CONTRACTS_FOLDER_ID || '';
        document.getElementById('txtConfigFolderImagenes').value = datos.claves.IMAGE_FOLDER_ID || '';
        document.getElementById('txtConfigLoyverse').value = datos.claves.LOYVERSE_API_TOKEN || '';
        document.getElementById('txtConfigWasender').value = datos.claves.WASENDER_API_KEY || '';
        document.getElementById('chkConfigCache').checked = datos.claves.CACHE_ENABLED;
    }

    // Renderizado
    seleccionarCategoria(categoriaActual, null); 
    renderizarUsuarios();
}

// =============================================================================
// 2. GESTIÓN DE LISTAS MAESTRAS (COLORES Y EDICIÓN)
// =============================================================================

function seleccionarCategoria(cat, btn) {
    categoriaActual = cat;
    
    if (btn) {
        document.querySelectorAll('#listCategoriasMaestras button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('lblCategoriaSeleccionada').innerText = btn.innerText;
    }

    // UI Específica para Estados (Color Picker)
    const colorInput = document.getElementById('clrNuevoItemMaestro');
    const btnDefault = document.getElementById('btnDefaultsContainer');
    
    if (cat === 'Estado_Pedido') {
        colorInput.style.display = 'block';
        if(btnDefault) btnDefault.classList.remove('d-none');
    } else {
        colorInput.style.display = 'none';
        if(btnDefault) btnDefault.classList.add('d-none');
    }

    // Limpiar inputs al cambiar categoría
    document.getElementById('txtNuevoItemMaestro').value = '';
    
    renderizarMaestros();
}

function renderizarMaestros() {
    const lista = globalConfigData.listas[categoriaActual] || [];
    const ul = document.getElementById('listaItemsMaestros');
    ul.innerHTML = '';

    if (lista.length === 0) { 
        ul.innerHTML = '<li class="list-group-item text-muted text-center fst-italic py-3">Lista vacía.</li>'; 
        return; 
    }

    lista.forEach(item => {
        let nombre = item;
        let color = '#ffffff';
        let esObjeto = false;
        
        // Parsear si es JSON (Estados)
        try {
            if (typeof item === 'string' && item.startsWith('{')) {
                const obj = JSON.parse(item);
                nombre = obj.nombre;
                color = obj.color;
                esObjeto = true;
            }
        } catch(e) {}

        // Badge visual
        const badgeColor = (categoriaActual === 'Estado_Pedido' || esObjeto)
            ? `<span class="badge rounded-circle border me-2 shadow-sm" style="background-color:${color}; width:15px; height:15px; display:inline-block;"> </span>` 
            : '';

        // Valor puro para eliminar/editar (escapado)
        const valorRaw = typeof item === 'object' ? JSON.stringify(item) : item;
        const valorSafe = valorRaw.replace(/'/g, "\\'");
        const nombreSafe = nombre.replace(/'/g, "\\'");
        const colorSafe = color;

        ul.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center text-dark">
                    ${badgeColor} 
                    <span class="fw-medium">${nombre}</span>
                </div>
                <div>
                    <button class="btn btn-sm btn-light border me-1" onclick="prepararEdicion('${nombreSafe}', '${colorSafe}')" title="Editar Color">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm text-danger border-0" onclick="eliminarItemMaestro('${valorSafe}')" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </li>`;
    });
}

// Función para cargar datos en los inputs (Edición)
function prepararEdicion(nombre, color) {
    document.getElementById('txtNuevoItemMaestro').value = nombre;
    const colorInput = document.getElementById('clrNuevoItemMaestro');
    if (color && color !== '#ffffff') {
        colorInput.value = color;
    }
    document.getElementById('txtNuevoItemMaestro').focus();
}

async function agregarItemMaestro() {
    const input = document.getElementById('txtNuevoItemMaestro');
    const colorInput = document.getElementById('clrNuevoItemMaestro');
    const nombre = input.value.trim();
    
    if (!nombre) return;

    let nuevoValor = nombre;
    let esEdicion = false;
    let valorAntiguo = null;

    // Si es estado, construimos el JSON
    if (categoriaActual === 'Estado_Pedido') {
        nuevoValor = JSON.stringify({ nombre: nombre, color: colorInput.value });
        
        // Verificar si ya existe el nombre para ACTUALIZAR (Borrar viejo -> Poner nuevo)
        const listaActual = globalConfigData.listas[categoriaActual] || [];
        const itemExistente = listaActual.find(item => {
            try { return JSON.parse(item).nombre === nombre; } catch(e){ return item === nombre; }
        });

        if (itemExistente) {
            if(!confirm(`El estado "${nombre}" ya existe. ¿Deseas actualizar su color?`)) return;
            esEdicion = true;
            valorAntiguo = itemExistente;
        }
    } else {
        // Listas simples: Ver si existe
        if ((globalConfigData.listas[categoriaActual] || []).includes(nombre)) {
            alert("Este valor ya existe.");
            return;
        }
    }

    input.value = '';
    
    // --- LÓGICA DE ACTUALIZACIÓN ---
    if (esEdicion && valorAntiguo) {
        // 1. Eliminar anterior (UI + Backend)
        globalConfigData.listas[categoriaActual] = globalConfigData.listas[categoriaActual].filter(i => i !== valorAntiguo);
        await callAPI('configuracion', 'gestionarMaestro', { accion: 'eliminar', categoria: categoriaActual, valor: valorAntiguo });
    }

    // 2. Agregar nuevo (UI + Backend)
    if(!globalConfigData.listas[categoriaActual]) globalConfigData.listas[categoriaActual] = [];
    globalConfigData.listas[categoriaActual].push(nuevoValor);
    renderizarMaestros();

    const res = await callAPI('configuracion', 'gestionarMaestro', { 
        accion: 'agregar', 
        categoria: categoriaActual, 
        valor: nuevoValor 
    });

    if (!res.success) {
        alert("Error al guardar: " + res.error);
        cargarConfiguracion(); // Revertir
    }
}

async function eliminarItemMaestro(valor) {
    if (!confirm("¿Eliminar este elemento?")) return;
    
    globalConfigData.listas[categoriaActual] = globalConfigData.listas[categoriaActual].filter(i => i !== valor);
    renderizarMaestros();

    const res = await callAPI('configuracion', 'gestionarMaestro', { 
        accion: 'eliminar', 
        categoria: categoriaActual, 
        valor: valor 
    });

    if (!res.success) cargarConfiguracion();
}

async function cargarEstadosDefault() {
    if(!confirm("Se cargarán los 11 estados por defecto. ¿Continuar?")) return;
    
    for(const est of ESTADOS_DEFAULT) {
        const valStr = JSON.stringify(est);
        const existe = globalConfigData.listas['Estado_Pedido']?.some(x => x.includes(est.nombre));
        if (!existe) {
            await callAPI('configuracion', 'gestionarMaestro', { accion: 'agregar', categoria: 'Estado_Pedido', valor: valStr });
        }
    }
    cargarConfiguracion();
}

// =============================================================================
// 3. GESTIÓN DE USUARIOS
// =============================================================================

function renderizarUsuarios() {
    const tbody = document.getElementById('tblUsuariosBody');
    tbody.innerHTML = '';
    
    (globalConfigData.usuarios || []).forEach(u => {
        const badge = u.rol === 'Admin' ? 'bg-danger' : 'bg-secondary';
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${u.nombre}</td>
                <td>${u.usuario}</td>
                <td><span class="badge ${badge}">${u.rol}</span></td>
                <td>${u.activo ? 'Activo' : 'Inactivo'}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-light border" onclick="abrirModalUsuario('${u.id}')"><i class="bi bi-pencil"></i></button>
                </td>
            </tr>`;
    });
}

function abrirModalUsuario(id = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalUsuario'));
    document.getElementById('formUsuario').reset();
    document.getElementById('hdnIdUsuario').value = id || '';
    
    if (id) {
        const u = globalConfigData.usuarios.find(x => x.id === id);
        if(u) {
            document.getElementById('txtUserNombre').value = u.nombre;
            document.getElementById('txtUserCelular').value = u.celular;
            document.getElementById('selUserRol').value = u.rol;
            document.getElementById('txtUserLogin').value = u.usuario;
        }
    }
    modal.show();
}

async function guardarUsuario() {
    const payload = {
        id: document.getElementById('hdnIdUsuario').value,
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
    } else {
        alert(res.error);
    }
}

// =============================================================================
// 4. OTROS
// =============================================================================

async function toggleCacheSistema() {
    const activo = document.getElementById('chkConfigCache').checked;
    CacheSystem.toggle(activo);
    await callAPI('configuracion', 'guardarEstadoCache', { activo: activo });
}

async function guardarClaves() {
    const payload = {
        DOC_TEMPLATE_ID: document.getElementById('txtConfigDocId').value,
        CONTRACTS_FOLDER_ID: document.getElementById('txtConfigFolderContratos').value,
        IMAGE_FOLDER_ID: document.getElementById('txtConfigFolderImagenes').value,
        LOYVERSE_API_TOKEN: document.getElementById('txtConfigLoyverse').value,
        WASENDER_API_KEY: document.getElementById('txtConfigWasender').value
    };
    const res = await callAPI('configuracion', 'guardarClavesSistema', payload);
    alert(res.success ? "✅ Guardado" : "❌ Error");
}

async function enviarPruebaWsp() {
    const num = document.getElementById('txtTestWspNumero').value;
    const msg = document.getElementById('txtTestWspMensaje').value;
    const res = await callAPI('configuracion', 'probandoConexionWhatsApp', { numero: num, mensaje: msg });
    alert(res.success ? "Enviado" : "Error: " + res.error);
}
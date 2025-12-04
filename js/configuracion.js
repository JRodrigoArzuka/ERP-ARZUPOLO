/**
 * js/configuracion.js
 * Lógica del Frontend para el Módulo de Configuración.
 * ACTUALIZADO: Gestión de Estados con Colores (Ciclo de Vida).
 */

let globalConfigData = { listas: {}, usuarios: [] };
let categoriaActual = 'Estado_Pedido'; // Iniciamos en la más importante

// CONFIGURACIÓN: Los 11 Estados del Ciclo de Vida "Cuenta Abierta"
const ESTADOS_DEFAULT = [
    { nombre: "Nuevo Pedido", color: "#0dcaf0" },          // Cyan (Inicio)
    { nombre: "Pendiente de Envio", color: "#ffc107" },    // Amarillo (Pago parcial/total)
    { nombre: "Pendiente Aprobación", color: "#6c757d" },  // Gris (Espera cliente)
    { nombre: "Aprobado", color: "#0d6efd" },              // Azul (Confirmado)
    { nombre: "En Producción", color: "#fd7e14" },         // Naranja (Cocina)
    { nombre: "Producto Listo", color: "#198754" },        // Verde Fuerte (Terminado)
    { nombre: "Enviado", color: "#20c997" },               // Verde Agua (En ruta)
    { nombre: "Entregado", color: "#212529" },             // Negro (Final Exitoso)
    { nombre: "Anulado", color: "#dc3545" },               // Rojo (Cancelado)
    { nombre: "Registro de Anulacion", color: "#6610f2" }, // Morado (Log)
    { nombre: "Pendiente de Pago", color: "#d63384" }      // Rosa (Alerta)
];

// =============================================================================
// 1. CARGA INICIAL
// =============================================================================

async function cargarConfiguracion() {
    // UI Loading
    document.getElementById('txtConfigDocId').placeholder = "Cargando...";
    document.getElementById('listaItemsMaestros').innerHTML = '<li class="list-group-item text-center"><div class="spinner-border spinner-border-sm text-primary"></div></li>';

    try {
        const res = await callAPI('configuracion', 'obtenerDataConfiguracion', {}, (datosFrescos) => {
            if (datosFrescos.success) {
                procesarDatosConfig(datosFrescos);
            }
        });

        if (res && res.success) {
            procesarDatosConfig(res);
        }
    } catch (e) { 
        console.error(e); 
        alert("Error al cargar configuración.");
    }
}

function procesarDatosConfig(datos) {
    globalConfigData = datos;
    
    // 1. Rellenar Inputs de Claves
    if (datos.claves) {
        document.getElementById('txtConfigDocId').value = datos.claves.DOC_TEMPLATE_ID || '';
        document.getElementById('txtConfigFolderContratos').value = datos.claves.CONTRACTS_FOLDER_ID || '';
        document.getElementById('txtConfigFolderImagenes').value = datos.claves.IMAGE_FOLDER_ID || '';
        document.getElementById('txtConfigLoyverse').value = datos.claves.LOYVERSE_API_TOKEN || '';
        document.getElementById('txtConfigWasender').value = datos.claves.WASENDER_API_KEY || '';
        document.getElementById('chkConfigCache').checked = datos.claves.CACHE_ENABLED;
    }

    // 2. Renderizar Listas y Usuarios
    seleccionarCategoria(categoriaActual, null); // Refresca la lista actual
    renderizarUsuarios();
}

// =============================================================================
// 2. GESTIÓN DE LISTAS MAESTRAS (CON COLORES)
// =============================================================================

function seleccionarCategoria(cat, btn) {
    categoriaActual = cat;
    
    // Actualizar UI Botones
    if (btn) {
        document.querySelectorAll('#listCategoriasMaestras button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('lblCategoriaSeleccionada').innerText = btn.innerText;
    }

    // Mostrar/Ocultar controles específicos de Estados
    const colorInput = document.getElementById('clrNuevoItemMaestro');
    const btnDefault = document.getElementById('btnDefaultsContainer');
    
    if (cat === 'Estado_Pedido') {
        colorInput.style.display = 'block';
        if (btnDefault) btnDefault.classList.remove('d-none');
    } else {
        colorInput.style.display = 'none';
        if (btnDefault) btnDefault.classList.add('d-none');
    }

    renderizarMaestros();
}

function renderizarMaestros() {
    const lista = globalConfigData.listas[categoriaActual] || [];
    const ul = document.getElementById('listaItemsMaestros');
    ul.innerHTML = '';

    if (lista.length === 0) { 
        ul.innerHTML = '<li class="list-group-item text-muted text-center fst-italic py-3">No hay registros en esta lista.</li>'; 
        return; 
    }

    lista.forEach(item => {
        let nombre = item;
        let color = null;
        
        // Detectar si el ítem es un JSON (Estado con color)
        try {
            if (typeof item === 'string' && item.trim().startsWith('{')) {
                const obj = JSON.parse(item);
                nombre = obj.nombre;
                color = obj.color;
            }
        } catch(e) { /* Es texto plano, continuamos */ }

        // Crear badge de color si existe
        const badgeColor = color 
            ? `<span class="badge rounded-circle border me-2 shadow-sm" style="background-color:${color}; width:15px; height:15px; display:inline-block;"> </span>` 
            : '';

        // Preparamos el valor exacto para eliminar (escapando comillas simples para el onclick)
        const valorOriginal = typeof item === 'object' ? JSON.stringify(item) : item;
        const valorSafe = valorOriginal.replace(/'/g, "\\'");

        ul.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center text-dark">
                    ${badgeColor} 
                    <span class="fw-medium">${nombre}</span>
                </div>
                <button class="btn btn-sm text-danger border-0 p-1" onclick="eliminarItemMaestro('${valorSafe}')" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </li>`;
    });
}

async function agregarItemMaestro() {
    const input = document.getElementById('txtNuevoItemMaestro');
    const colorInput = document.getElementById('clrNuevoItemMaestro');
    const valor = input.value.trim();
    
    if (!valor) return;

    let payloadValor = valor;
    
    // Si estamos en Estados, empaquetamos Nombre + Color
    if (categoriaActual === 'Estado_Pedido') {
        const objEstado = { 
            nombre: valor, 
            color: colorInput.value 
        };
        payloadValor = JSON.stringify(objEstado);
    }

    input.value = '';
    
    // Actualización Optimista (UI inmediata)
    if(!globalConfigData.listas[categoriaActual]) globalConfigData.listas[categoriaActual] = [];
    globalConfigData.listas[categoriaActual].push(payloadValor);
    renderizarMaestros();

    // Guardar en Backend
    const res = await callAPI('configuracion', 'gestionarMaestro', { 
        accion: 'agregar', 
        categoria: categoriaActual, 
        valor: payloadValor 
    });

    if (!res.success) {
        alert("Error al guardar: " + res.error);
        cargarConfiguracion(); // Revertir si falló
    }
}

async function eliminarItemMaestro(valor) {
    if (!confirm("¿Eliminar este elemento?")) return;
    
    // Actualización Optimista
    globalConfigData.listas[categoriaActual] = globalConfigData.listas[categoriaActual].filter(i => i !== valor);
    renderizarMaestros();

    const res = await callAPI('configuracion', 'gestionarMaestro', { 
        accion: 'eliminar', 
        categoria: categoriaActual, 
        valor: valor 
    });

    if (!res.success) {
        alert("Error al eliminar: " + res.error);
        cargarConfiguracion();
    }
}

async function cargarEstadosDefault() {
    if(!confirm("⚠️ ¿Estás seguro?\n\nSe agregarán los 11 estados del ciclo de vida del pedido a la lista actual.")) return;
    
    const btn = document.querySelector('#btnDefaultsContainer button');
    const txtOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Cargando...';

    // Agregamos uno por uno (secuencial para no saturar si el backend es simple)
    // Opcional: Podríamos modificar el backend para recibir un array, pero mantendremos la compatibilidad actual.
    for(const est of ESTADOS_DEFAULT) {
        const valStr = JSON.stringify(est);
        // Verificamos si ya existe localmente para no llamar a la API innecesariamente
        const existe = globalConfigData.listas['Estado_Pedido']?.some(x => x.includes(est.nombre));
        
        if (!existe) {
            await callAPI('configuracion', 'gestionarMaestro', { 
                accion: 'agregar', 
                categoria: 'Estado_Pedido', 
                valor: valStr 
            });
        }
    }
    
    btn.disabled = false;
    btn.innerHTML = txtOriginal;
    cargarConfiguracion(); // Recargar todo limpio
    alert("✅ Estados cargados.");
}

// =============================================================================
// 3. GESTIÓN DE USUARIOS
// =============================================================================

function renderizarUsuarios() {
    const tbody = document.getElementById('tblUsuariosBody');
    tbody.innerHTML = '';
    
    if(!globalConfigData.usuarios || globalConfigData.usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay usuarios.</td></tr>';
        return;
    }

    globalConfigData.usuarios.forEach(u => {
        const badgeRol = u.rol === 'Admin' ? 'bg-danger' : 'bg-secondary';
        const estado = u.activo ? '<span class="text-success small">● Activo</span>' : '<span class="text-danger small">● Inactivo</span>';
        
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${u.nombre}</td>
                <td class="font-monospace small">${u.usuario}</td>
                <td><span class="badge ${badgeRol}">${u.rol}</span></td>
                <td>${estado}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-light border" onclick="abrirModalUsuario('${u.id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            </tr>`;
    });
}

function abrirModalUsuario(id = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalUsuario'));
    document.getElementById('formUsuario').reset();
    
    if (id) {
        const u = globalConfigData.usuarios.find(x => x.id === id);
        if(!u) return;
        document.getElementById('hdnIdUsuario').value = u.id;
        document.getElementById('txtUserNombre').value = u.nombre;
        document.getElementById('txtUserCelular').value = u.celular;
        document.getElementById('selUserRol').value = u.rol;
        document.getElementById('txtUserLogin').value = u.usuario;
        document.getElementById('txtUserPass').placeholder = "(Sin cambios)";
    } else {
        document.getElementById('hdnIdUsuario').value = '';
        document.getElementById('txtUserPass').placeholder = "****";
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

    if(!payload.nombre || !payload.usuario) {
        alert("Nombre y Usuario son obligatorios.");
        return;
    }

    const res = await callAPI('configuracion', 'gestionarUsuario', payload);
    if (res.success) {
        bootstrap.Modal.getInstance(document.getElementById('modalUsuario')).hide();
        cargarConfiguracion(); // Recargar lista
    } else {
        alert(res.error);
    }
}

// =============================================================================
// 4. OTROS (Cache y Claves)
// =============================================================================

async function toggleCacheSistema() {
    const activo = document.getElementById('chkConfigCache').checked;
    CacheSystem.toggle(activo); // Local
    await callAPI('configuracion', 'guardarEstadoCache', { activo: activo }); // Remoto
}

async function guardarClaves() {
    const btn = document.querySelector('#formClaves button[type="submit"]');
    btn.disabled = true; btn.innerText = "Guardando...";

    const payload = {
        DOC_TEMPLATE_ID: document.getElementById('txtConfigDocId').value,
        CONTRACTS_FOLDER_ID: document.getElementById('txtConfigFolderContratos').value,
        IMAGE_FOLDER_ID: document.getElementById('txtConfigFolderImagenes').value,
        LOYVERSE_API_TOKEN: document.getElementById('txtConfigLoyverse').value,
        WASENDER_API_KEY: document.getElementById('txtConfigWasender').value
    };

    const res = await callAPI('configuracion', 'guardarClavesSistema', payload);
    alert(res.success ? "✅ Claves actualizadas." : "❌ Error: " + res.error);
    
    btn.disabled = false; btn.innerText = "Guardar Conexiones";
}

// PRUEBA WHATSAPP
async function enviarPruebaWsp() {
    const num = document.getElementById('txtTestWspNumero').value;
    const msg = document.getElementById('txtTestWspMensaje').value;
    if(!num) return alert("Falta número");
    
    const res = await callAPI('configuracion', 'probandoConexionWhatsApp', { numero: num, mensaje: msg });
    alert(res.success ? "✅ Enviado." : "❌ Error: " + res.error);
}
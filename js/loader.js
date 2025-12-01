/**
 * js/loader.js
 * Componente Web Nativo para cargar fragmentos HTML dinámicamente.
 * Permite usar la etiqueta <arzuka-include src="..."></arzuka-include>
 */

class ArzukaInclude extends HTMLElement {
    constructor() {
        super();
    }

    async connectedCallback() {
        const file = this.getAttribute('src');
        if (!file) return;

        try {
            // 1. Petición al archivo HTML
            const response = await fetch(file);
            if (!response.ok) throw new Error(`No se pudo cargar ${file}`);
            
            // 2. Obtener texto
            const html = await response.text();
            
            // 3. Inyectar en el DOM
            this.innerHTML = html;

            // 4. Disparar evento para avisar que ya cargó
            this.dispatchEvent(new CustomEvent('loaded', { 
                detail: { file: file },
                bubbles: true 
            }));

        } catch (e) {
            console.error(e);
            this.innerHTML = `<div class="alert alert-danger p-2">Error cargando componente: ${file}</div>`;
        }
    }
}

// Definir la etiqueta personalizada
customElements.define('arzuka-include', ArzukaInclude);
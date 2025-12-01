/**
 * js/loader.js
 * Componente Web Nativo para cargar fragmentos HTML.
 * CORREGIDO: Despacha evento 'loaded' incluso si hay error para no congelar la app.
 */

class ArzukaInclude extends HTMLElement {
    constructor() {
        super();
    }

    async connectedCallback() {
        const file = this.getAttribute('src');
        if (!file) return;

        try {
            const response = await fetch(file);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const html = await response.text();
            this.innerHTML = html;

        } catch (e) {
            console.error(`Error cargando ${file}:`, e);
            // No mostramos error visual feo en producción, solo en consola
            // this.innerHTML = `<div class="text-danger text-xs">Error ${file}</div>`;
        } finally {
            // IMPORTANTE: Avisar siempre que "terminó" (sea bien o mal)
            // para que app.js pueda iniciar la verificación de conexión.
            this.dispatchEvent(new CustomEvent('loaded', { 
                detail: { file: file },
                bubbles: true 
            }));
        }
    }
}

customElements.define('arzuka-include', ArzukaInclude);
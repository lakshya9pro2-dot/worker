const API_BASE = "https://kineflex-api.workers.dev"; // Update with actual deployed worker URL if testing on Pages, or relative if same origin
// We use relative for now so it works when deployed together, or absolute if needed.
const API = "/api/resolve"; 

const app = {
    async resolveMedia(urlPath) {
        try {
            const res = await fetch(`${API}${urlPath}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            return data;
        } catch (e) {
            console.error(e);
            return { success: false, error: "Network error" };
        }
    },

    async loadMovie() {
        const pathParts = window.location.pathname.split('/');
        // expected: /movie/123
        const id = pathParts[2];
        if (!id) {
            document.getElementById('content').innerHTML = '<h1 class="title">Invalid Movie ID</h1>';
            return;
        }

        const data = await this.resolveMedia(`/movie/${id}`);
        this.renderResult(data);
    },

    async loadTv() {
        const pathParts = window.location.pathname.split('/');
        // expected: /tv/123/1/2
        const id = pathParts[2];
        const s = pathParts[3];
        const e = pathParts[4];
        if (!id || !s || !e) {
            document.getElementById('content').innerHTML = '<h1 class="title">Invalid TV URL</h1>';
            return;
        }

        const data = await this.resolveMedia(`/tv/${id}/${s}/${e}`);
        this.renderResult(data);
    },

    renderResult(data) {
        const content = document.getElementById('content');
        if (data.success && data.play) {
            // Found directly, redirect to player
            window.location.href = `/player.html?playId=${data.play}`;
        } else if (data.resolverRequired && data.requestId) {
            // Not found, go to getting.html with requestId
            window.location.href = `/getting.html?requestId=${data.requestId}`;
        } else {
            content.innerHTML = `
                <h1 class="title">Media Not Found</h1>
                <p class="meta">${data.error || "Could not resolve this media."}</p>
            `;
        }
    }
};
window.app = app;

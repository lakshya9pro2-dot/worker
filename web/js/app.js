// IMPORTANT: Replace this with your actual Cloudflare Worker URL
const API_BASE = "https://worker.kineflex-netflex.workers.dev"; 
const API = `${API_BASE}/api/resolve`; 

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
        if (window.KineflexAuth) {
            if (window.KineflexAuth.ready) await window.KineflexAuth.ready;
            const auth = await window.KineflexAuth.ensureAuthenticated({ returnUrl: window.location.href, autoRedirect: true });
            if (!auth || !auth.ok) return;
        }

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
        if (window.KineflexAuth) {
            if (window.KineflexAuth.ready) await window.KineflexAuth.ready;
            const auth = await window.KineflexAuth.ensureAuthenticated({ returnUrl: window.location.href, autoRedirect: true });
            if (!auth || !auth.ok) return;
        }

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
            // Found directly, redirect to player2
            let qs = `?ttid=${data.play}&id=${data.id}&type=${data.type || ''}`;
            if (data.season) qs += `&s=${data.season}`;
            if (data.episode) qs += `&e=${data.episode}`;
            window.location.href = `/player2.html${qs}`;
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

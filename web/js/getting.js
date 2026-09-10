document.addEventListener('DOMContentLoaded', () => {
    const statusMsg = document.getElementById('statusMessage');
    const errorMsg = document.getElementById('errorMessage');
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get('requestId');

    if (!requestId) {
        statusMsg.innerText = "Error: No request ID";
        return;
    }

    // 1. Tell the extension to resolve it
    // The extension should be listening for a custom event or a postMessage.
    // We can dispatch a custom event to window.
    window.dispatchEvent(new CustomEvent('KINEFLEX_RESOLVE', {
        detail: { requestId }
    }));
    
    // Also notify via postMessage just in case
    window.postMessage({ type: "KINEFLEX_RESOLVE", requestId: requestId }, "*");

    // IMPORTANT: Replace this with your actual Cloudflare Worker URL
    const API_BASE = "https://worker.kineflex-netflex.workers.dev";
    
    // Fetch session immediately to build iframe
    fetch(`${API_BASE}/api/session/${requestId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.session && data.session.meta) {
                const meta = data.session.meta;
                let targetUrl = "";
                if (meta.type === 'movie') {
                    targetUrl = `https://vidfast.vc/movie/${meta.id}`;
                } else if (meta.type === 'tv') {
                    targetUrl = `https://vidfast.vc/tv/${meta.id}/${meta.season}/${meta.episode}`;
                }
                
                if (targetUrl) {
                    const iframe = document.createElement('iframe');
                    iframe.src = targetUrl;
                    iframe.style.width = '100%';
                    iframe.style.height = '400px';
                    iframe.style.border = 'none';
                    iframe.style.marginTop = '20px';
                    document.querySelector('.loading-container').appendChild(iframe);
                }
            }
        });

    // 2. Start polling the backend for session completion
    let attempts = 0;
    const maxAttempts = 30; // ~ 1 minute
    
    const pollInterval = setInterval(async () => {
        attempts++;
        try {
            const res = await fetch(`${API_BASE}/api/session/${requestId}`);
            const data = await res.json();
            
            if (data.success && data.session && data.session.status === 'completed') {
                clearInterval(pollInterval);
                if (data.session.result && data.session.result.success) {
                    statusMsg.innerText = "Video found. Starting player...";
                    setTimeout(() => {
                        window.location.href = `/player.html?requestId=${requestId}`;
                    }, 500);
                } else {
                    statusMsg.innerText = "Unable to resolve video.";
                    errorMsg.innerText = "No playable source found.";
                }
            } else if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                statusMsg.innerText = "Extension timeout or unable to resolve.";
                errorMsg.innerText = "Please ensure the Kineflex extension is installed and active.";
            }
        } catch (e) {
            console.error(e);
        }
    }, 2000);

    // Also listen for immediate extension response just for UI updates
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'KINEFLEX_RESOLVE_RESULT') {
            if (event.data.requestId === requestId) {
                // Extension finished processing
                if (event.data.success) {
                    statusMsg.innerText = "Result received, verifying...";
                } else {
                    statusMsg.innerText = "Resolver failed.";
                    clearInterval(pollInterval);
                }
            }
        }
    });
});

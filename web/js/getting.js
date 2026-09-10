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

    statusMsg.innerText = "Waiting for resolver...";

    // 2. Start polling the backend for session completion
    let attempts = 0;
    const maxAttempts = 30; // ~ 1 minute
    
    const pollInterval = setInterval(async () => {
        attempts++;
        try {
            const res = await fetch(`/api/session/${requestId}`);
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

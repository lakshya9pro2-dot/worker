let activeResolutions = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'KINEFLEX_RESOLVE') {
        const requestId = message.requestId;
        
        // Fetch the session to know what to resolve
        const API = "https://worker.kineflex-netflex.workers.dev"; // Should match deployed worker
        
        fetch(`${API}/api/session/${requestId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.session && data.session.meta) {
                    const meta = data.session.meta;
                    // Example: construct fallback URL
                    let targetUrl = "";
                    if (meta.type === 'movie') {
                        targetUrl = `https://vidfast.vc/movie/${meta.id}`;
                    } else if (meta.type === 'tv') {
                        targetUrl = `https://vidfast.vc/tv/${meta.id}/${meta.season}/${meta.episode}`;
                    }
                    
                    if (!targetUrl) {
                        return sendError(requestId, API, "Unknown media type");
                    }
                    
                    // Start observation using the tab that sent the message
                    if (sender.tab && sender.tab.id) {
                        startResolution(requestId, sender.tab.id, API);
                    } else {
                        sendError(requestId, API, "Could not determine tab ID");
                    }
                    
                    sendResponse({ type: 'KINEFLEX_RESOLVE_RESULT', requestId, success: true, status: "started" });
                } else {
                    sendResponse({ type: 'KINEFLEX_RESOLVE_RESULT', requestId, success: false });
                }
            })
            .catch(err => {
                sendResponse({ type: 'KINEFLEX_RESOLVE_RESULT', requestId, success: false, error: err.message });
            });
            
        return true; // Keep channel open for async response
    }
});

function startResolution(requestId, tabId, API) {
    const listener = (details) => {
        if (details.tabId === tabId && details.url.includes('master.m3u8')) {
            // Found the playback URL!
            const playUrl = details.url;
            
            // Cleanup
            chrome.webRequest.onBeforeRequest.removeListener(listener);
            
            // Send result back to worker
            sendResult(requestId, API, playUrl);
        }
    };
    
    // Listen for the m3u8 request
    chrome.webRequest.onBeforeRequest.addListener(
        listener,
        { urls: ["*://*.peakstorm.top/*", "*://*.keenanchor.top/*"], tabId: tabId }
    );
    
    // Timeout after 30 seconds
    setTimeout(() => {
        if (chrome.webRequest.onBeforeRequest.hasListener(listener)) {
            chrome.webRequest.onBeforeRequest.removeListener(listener);
            sendError(requestId, API, "Timeout waiting for video source");
        }
    }, 30000);
}

function sendResult(requestId, API, playUrl) {
    // We send the raw URL because the extension's declarativeNetRequest rules
    // will automatically handle the Origin/Referer headers in the browser!
    fetch(`${API}/api/session/${requestId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            success: true,
            url: playUrl,
            type: 'hls'
        })
    }).catch(console.error);
}

function sendError(requestId, API, message) {
    fetch(`${API}/api/session/${requestId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            success: false,
            error: message
        })
    }).catch(console.error);
}

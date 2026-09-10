let activeResolutions = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'KINEFLEX_RESOLVE') {
        const requestId = message.requestId;
        
        // Fetch the session to know what to resolve
        const API = "https://kineflex-api.workers.dev"; // Should match deployed worker
        
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
                    
                    // Start observation
                    startResolution(requestId, targetUrl, API);
                    
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

function startResolution(requestId, targetUrl, API) {
    chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
        const tabId = tab.id;
        
        const listener = (details) => {
            if (details.tabId === tabId && details.url.includes('master.m3u8')) {
                // Found the playback URL!
                const playUrl = details.url;
                
                // Cleanup
                chrome.webRequest.onBeforeRequest.removeListener(listener);
                chrome.tabs.remove(tabId);
                
                // Send result back to worker
                sendResult(requestId, API, playUrl);
            }
        };
        
        // Listen for the m3u8 request
        chrome.webRequest.onBeforeRequest.addListener(
            listener,
            { urls: ["*://*.peakstorm.top/*"], tabId: tabId }
        );
        
        // Timeout after 30 seconds
        setTimeout(() => {
            if (chrome.webRequest.onBeforeRequest.hasListener(listener)) {
                chrome.webRequest.onBeforeRequest.removeListener(listener);
                chrome.tabs.remove(tabId).catch(()=>{});
                sendError(requestId, API, "Timeout waiting for video source");
            }
        }, 30000);
    });
}

function sendResult(requestId, API, playUrl) {
    // We proxy it through our worker to handle CORS and Referer headers
    const proxiedUrl = `${API}/api/proxy?url=${encodeURIComponent(playUrl)}`;
    
    fetch(`${API}/api/session/${requestId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            success: true,
            url: proxiedUrl,
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

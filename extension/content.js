// Listen for messages from the web page
window.addEventListener('message', (event) => {
    // Only accept messages from the same window
    if (event.source !== window) return;

    if (event.data && event.data.type === 'KINEFLEX_RESOLVE') {
        const requestId = event.data.requestId;
        
        // Pass to background script
        chrome.runtime.sendMessage({
            type: 'KINEFLEX_RESOLVE',
            requestId: requestId
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Kineflex Extension error:", chrome.runtime.lastError);
                window.postMessage({ type: 'KINEFLEX_RESOLVE_RESULT', requestId, success: false }, "*");
            } else if (response) {
                window.postMessage(response, "*");
            }
        });
    }
});

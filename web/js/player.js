document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get('requestId');
    const playId = params.get('playId');
    const videoElem = document.getElementById('videoPlayer');
    const errorElem = document.getElementById('playerError');
    
    let playUrl = null;

    // IMPORTANT: Replace this with your actual Cloudflare Worker URL
    const API_BASE = "https://worker.kineflex-netflex.workers.dev";

    if (requestId) {
        // Fetch from session
        try {
            const res = await fetch(`${API_BASE}/api/session/${requestId}`);
            const data = await res.json();
            if (data.success && data.session && data.session.result && data.session.result.url) {
                playUrl = data.session.result.url;
            } else {
                showError("Session expired or invalid playback data.");
                return;
            }
        } catch (e) {
            showError("Failed to fetch session.");
            return;
        }
    } else if (playId) {
        // Resolve playId. For now, since we don't have a direct play provider logic built-in to the worker
        // except for the fallback, we'll simulate a provider abstraction as requested in Section 12.
        try {
            const resolved = await resolvePlayId(playId);
            if (resolved && resolved.success) {
                playUrl = resolved.url;
            } else {
                showError("Playback unavailable for this ID.");
                return;
            }
        } catch(e) {
            showError("Error resolving play ID.");
            return;
        }
    } else {
        showError("No video specified.");
        return;
    }

    if (playUrl) {
        initPlayer(playUrl);
    }
    
    function showError(msg) {
        errorElem.style.display = 'block';
        errorElem.innerText = msg;
    }

    function initPlayer(url) {
        // Basic HLS check and player setup
        if (url.includes('.m3u8')) {
            // Need hls.js for proper m3u8 playback on most browsers except Safari
            if (window.Hls && Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(videoElem);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    videoElem.play().catch(e => console.log('Autoplay prevented'));
                });
            } else if (videoElem.canPlayType('application/vnd.apple.mpegurl')) {
                videoElem.src = url;
                videoElem.addEventListener('loadedmetadata', () => {
                    videoElem.play().catch(e => console.log('Autoplay prevented'));
                });
            } else {
                showError("HLS not supported in this browser.");
            }
        } else {
            videoElem.src = url;
            videoElem.play().catch(e => console.log('Autoplay prevented'));
        }
    }

    async function resolvePlayId(id) {
        // Abstraction for playId resolution (Section 12)
        // In a real app, this might call another worker API.
        // For demonstration, if playId is "6a44849891982", mock a response
        if (id) {
            return {
                success: true,
                url: 'https://moon.peakstorm.top/vd/dummy/master.m3u8',
                type: 'hls'
            };
        }
        return { success: false };
    }
});

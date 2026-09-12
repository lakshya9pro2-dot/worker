document.addEventListener('DOMContentLoaded', async () => {
    // Ensure SSO code exchange / auth session check is complete before playback starts
    if (window.KineflexAuth && typeof window.KineflexAuth.init === 'function') {
        try {
            await window.KineflexAuth.init();
        } catch (e) {
            console.warn("KineflexAuth init warning:", e);
        }
    }

    const params = new URLSearchParams(window.location.search);
    const requestId = params.get('requestId');
    const playId = params.get('playId');
    const videoElem = document.getElementById('videoPlayer');
    const errorElem = document.getElementById('playerError');
    
    let playUrl = null;
    let videoMeta = {
        id: params.get('id') || params.get('videoId'),
        type: params.get('type') || 'movies',
        season: params.get('s') || params.get('season') || 0,
        episode: params.get('e') || params.get('episode') || 0
    };

    // IMPORTANT: Replace this with your actual Cloudflare Worker URL
    const API_BASE = "https://worker.kineflex-netflex.workers.dev";

    if (requestId) {
        // Fetch from session
        try {
            const res = await fetch(`${API_BASE}/api/session/${requestId}`);
            const data = await res.json();
            if (data.success && data.session && data.session.result && data.session.result.url) {
                playUrl = data.session.result.url;
                if (data.session.meta) {
                    videoMeta = {
                        id: data.session.meta.id || videoMeta.id,
                        type: data.session.meta.type || videoMeta.type,
                        season: data.session.meta.season || videoMeta.season,
                        episode: data.session.meta.episode || videoMeta.episode
                    };
                }
            } else {
                showError("Session expired or invalid playback data.");
                return;
            }
        } catch (e) {
            showError("Failed to fetch session.");
            return;
        }
    } else if (playId) {
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
    } else if (params.get('url')) {
        playUrl = params.get('url');
    } else {
        showError("No video specified.");
        return;
    }

    // Initialize WatchProgress if video metadata is available
    if (videoMeta.id && window.WatchProgress) {
        window.watchProgress = new WatchProgress({
            videoId: videoMeta.id,
            mediaType: videoMeta.type || 'movies',
            seasonNumber: videoMeta.season,
            episodeNumber: videoMeta.episode,
            getCurrentTime: () => videoElem.currentTime,
            getDuration: () => videoElem.duration,
            seekTo: (time) => { videoElem.currentTime = time; }
        });

        const triggerResume = () => {
            if (window.watchProgress) window.watchProgress.attemptResume();
        };

        videoElem.addEventListener('loadedmetadata', triggerResume);
        videoElem.addEventListener('canplay', triggerResume);
        videoElem.addEventListener('playing', triggerResume);
        videoElem.addEventListener('timeupdate', () => {
            if (window.watchProgress) {
                window.watchProgress.attemptResume();
                window.watchProgress.saveProgress();
            }
        });
        videoElem.addEventListener('pause', () => {
            if (window.watchProgress) window.watchProgress.saveProgress(true);
        });
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

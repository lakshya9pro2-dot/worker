// Reads the Go "watch-progress-api" URL from js/config.js (window.WATCH_API_BASE).
// Falls back to the same default in case config.js wasn't included on a page.
const WATCH_API = window.WATCH_API_BASE || "https://testing-for-api.onrender.com";

class WatchProgress {
    constructor(config) {
        this.videoId = parseInt(config.videoId);
        this.mediaType = config.mediaType === 'tv' ? 'tv' : 'movies'; // 'movies' or 'tv'
        this.seasonNumber = parseInt(config.seasonNumber) || 0;
        this.episodeNumber = parseInt(config.episodeNumber) || 0;
        this.getCurrentTime = config.getCurrentTime;
        this.getDuration = config.getDuration;
        this.seekTo = config.seekTo;

        this.token = localStorage.getItem('watch_token');
        this.userId = localStorage.getItem('watch_user_id');
        this.lastSave = 0;

        if (this.token && !isNaN(this.videoId)) {
            this.init();
            this._bindUnloadFlush();
        } else {
            console.warn("WatchProgress: No watch_token found or invalid video ID. Sign in on /auth.html to save progress.");
        }
    }

    // Make one last, best-effort save when the tab is closed or navigated
    // away from mid-playback, not just on pause/timeupdate.
    _bindUnloadFlush() {
        const flush = () => this.saveProgress(true);
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flush();
        });
    }

    async init() {
        // If we have a token but no user ID, fetch it
        if (!this.userId) {
            try {
                const res = await fetch(`${WATCH_API}/api/auth/user`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (res.ok) {
                    const user = await res.json();
                    this.userId = user.id;
                    localStorage.setItem('watch_user_id', this.userId);
                } else if (res.status === 401) {
                    this._handleExpiredSession();
                    return;
                }
            } catch (e) {
                console.error("WatchProgress: Failed to fetch user ID", e);
            }
        }

        await this.loadProgress();
    }

    async loadProgress() {
        if (!this.userId) return;

        const prefix = this.mediaType === 'movies' ? 'm' : 'tv';
        try {
            const res = await fetch(`${WATCH_API}/api/progress/${this.userId}/${prefix}${this.videoId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (res.ok) {
                const progress = await res.json();
                const timeInSeconds = progress.playback_time_ms / 1000;
                if (timeInSeconds > 0) {
                    console.log(`WatchProgress: Resuming at ${timeInSeconds}s`);
                    this.seekTo(timeInSeconds);
                }
            } else if (res.status === 401) {
                this._handleExpiredSession();
            }
            // 404 just means no saved progress yet — nothing to do.
        } catch (e) {
            console.error("WatchProgress: Could not load progress", e);
        }
    }

    async saveProgress(force = false) {
        if (!this.token) return;

        const now = Date.now();
        // Throttle to every 10 seconds, unless forced (pause / unload / tab hidden)
        if (!force && now - this.lastSave < 10000) return;

        const currentTime = this.getCurrentTime();
        const duration = this.getDuration();

        if (currentTime <= 0 || duration <= 0) return;

        this.lastSave = now;

        const payload = {
            video_id: this.videoId,
            media_type: this.mediaType,
            total_time_ms: Math.floor(duration * 1000),
            playback_time_ms: Math.floor(currentTime * 1000),
            season_number: this.seasonNumber,
            episode_number: this.episodeNumber,
            device_host: "website"
        };

        try {
            const res = await fetch(`${WATCH_API}/api/progress`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload),
                // Lets the request complete even if the page is being
                // unloaded right now (e.g. pagehide flush on tab close).
                keepalive: true
            });
            if (res.status === 401) {
                this._handleExpiredSession();
                return;
            }
            console.log(`WatchProgress: Saved at ${currentTime}s`);
        } catch (e) {
            console.error("WatchProgress: Failed to save progress", e);
        }
    }

    // The Supabase access token expired or was revoked. Clear the stale
    // credentials so the account widget correctly shows "signed out"
    // instead of silently failing to save forever.
    _handleExpiredSession() {
        console.warn("WatchProgress: session expired, please sign in again.");
        localStorage.removeItem('watch_token');
        localStorage.removeItem('watch_user_id');
        localStorage.removeItem('watch_email');
        this.token = null;
        this.userId = null;
    }
}

window.WatchProgress = WatchProgress;

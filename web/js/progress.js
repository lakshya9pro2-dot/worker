// Reads the Go "watch-progress-api" URL from js/config.js (window.WATCH_API_BASE).
// Falls back to the same default in case config.js wasn't included on a page.
const WATCH_API = window.WATCH_API_BASE || "https://testing-for-api.onrender.com";

class WatchProgress {
    constructor(config) {
        // Sanitize video ID (handles numbers, numeric strings, or prefixed IDs like "m550" / "tv330")
        const rawId = String(config.videoId || '').replace(/^[a-z]+/i, '');
        this.videoId = parseInt(rawId, 10);
        this.mediaType = config.mediaType === 'tv' ? 'tv' : 'movies'; // 'movies' or 'tv'
        this.seasonNumber = parseInt(config.seasonNumber, 10) || 0;
        this.episodeNumber = parseInt(config.episodeNumber, 10) || 0;
        this.getCurrentTime = config.getCurrentTime;
        this.getDuration = config.getDuration;
        this.seekTo = config.seekTo;

        this.token = localStorage.getItem('watch_token') || localStorage.getItem('kineflex_access_token');
        this.userId = localStorage.getItem('watch_user_id');
        this.lastSave = 0;
        this.targetResumeTime = 0;
        this.isResumed = false;
        this.hasLoadedProgress = false;
        this.resumeAttemptCount = 0;

        this._start();
    }

    async _start() {
        // Wait for shared auth to finish any in-flight SSO exchange or session check
        if (window.KineflexAuth && typeof window.KineflexAuth.init === 'function') {
            try {
                await window.KineflexAuth.init();
            } catch (e) {
                console.warn("WatchProgress: KineflexAuth init warning", e);
            }
        }

        this.token = localStorage.getItem('watch_token') || localStorage.getItem('kineflex_access_token');
        this.userId = localStorage.getItem('watch_user_id');

        if (!this.token) {
            console.warn("WatchProgress: No auth token found. Sign in on /auth.html or via main site to track & resume progress.");
            this.hasLoadedProgress = true;
            this.isResumed = true;
            return;
        }

        if (isNaN(this.videoId) || this.videoId <= 0) {
            console.warn("WatchProgress: Invalid video ID", { videoId: this.videoId });
            this.hasLoadedProgress = true;
            this.isResumed = true;
            return;
        }

        this._bindUnloadFlush();
        await this.init();
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
        // If we have an access token but no user ID, fetch user profile from Go backend
        if (!this.userId && this.token) {
            try {
                const res = await fetch(`${WATCH_API}/api/auth/user`, {
                    headers: { 'Authorization': `Bearer ${this.token}` },
                    credentials: 'include'
                });
                if (res.ok) {
                    const user = await res.json();
                    this.userId = user.id;
                    localStorage.setItem('watch_user_id', this.userId);
                    if (user.email) localStorage.setItem('watch_email', user.email);
                } else if (res.status === 401 || res.status === 403) {
                    this._handleExpiredSession();
                    return;
                }
            } catch (e) {
                console.error("WatchProgress: Failed to fetch user ID from backend", e);
            }
        }

        await this.loadProgress();
    }

    async loadProgress() {
        if (!this.userId || !this.token || !this.videoId) {
            this.hasLoadedProgress = true;
            this.isResumed = true;
            return;
        }

        const prefix = this.mediaType === 'tv' ? 'tv' : 'm';
        const watchedId = `${prefix}${this.videoId}`;
        const endpoint = `${WATCH_API}/api/progress/${encodeURIComponent(this.userId)}/${watchedId}`;

        console.log(`[WatchProgress] Querying backend for progress: ${endpoint}`);

        try {
            const res = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${this.token}` },
                credentials: 'include'
            });

            this.hasLoadedProgress = true;

            if (res.ok) {
                const progress = await res.json();
                console.log("[WatchProgress] Retrieved saved progress from Go backend:", progress);

                const playedMs = Number(progress.playback_time_ms) || 0;
                const totalMs = Number(progress.total_time_ms) || 0;
                const timeInSeconds = playedMs / 1000;
                const totalInSeconds = totalMs / 1000;

                // Only resume if user has watched > 5 seconds
                // and did not finish the video (> 95% watched)
                const isFinished = totalInSeconds > 0 && (timeInSeconds / totalInSeconds) >= 0.95;

                if (timeInSeconds > 5 && !isFinished) {
                    console.log(`[WatchProgress] Resuming from ${timeInSeconds}s (${Math.floor(timeInSeconds / 60)}m ${Math.floor(timeInSeconds % 60)}s)`);
                    this.targetResumeTime = timeInSeconds;
                    this.isResumed = false;
                    this.attemptResume();
                } else {
                    this.isResumed = true;
                    if (isFinished) {
                        console.log("[WatchProgress] Video was previously completed; starting from beginning.");
                    }
                }
            } else if (res.status === 404) {
                console.log("[WatchProgress] No saved progress found for this media yet.");
                this.isResumed = true;
            } else if (res.status === 401 || res.status === 403) {
                this._handleExpiredSession();
            }
        } catch (e) {
            console.error("[WatchProgress] Could not load progress from backend", e);
            this.hasLoadedProgress = true;
            this.isResumed = true;
        }
    }

    attemptResume() {
        if (this.isResumed || !this.targetResumeTime || this.targetResumeTime <= 0) return;

        let curDuration = 0;
        let curTime = 0;

        try {
            if (typeof this.getDuration === 'function') curDuration = this.getDuration() || 0;
            if (typeof this.getCurrentTime === 'function') curTime = this.getCurrentTime() || 0;
        } catch (e) {}

        // If player already reached target position (within 2s), mark resumed
        if (Math.abs(curTime - this.targetResumeTime) <= 2) {
            this.isResumed = true;
            return;
        }

        this.resumeAttemptCount++;

        // Can seek if duration is loaded or if player has started playing
        if (curDuration > 0 || curTime > 0 || this.resumeAttemptCount > 3) {
            try {
                console.log(`[WatchProgress] Applying seek to ${this.targetResumeTime}s (current: ${curTime}s, dur: ${curDuration}s)`);
                if (typeof this.seekTo === 'function') {
                    this.seekTo(this.targetResumeTime);
                }
                this.isResumed = true;
                this.showResumeToast(this.targetResumeTime);
            } catch (err) {
                console.warn("[WatchProgress] Seek attempt failed; will retry on next playback event", err);
            }
        }
    }

    showResumeToast(seconds) {
        try {
            const oldToast = document.getElementById('kineflex-resume-toast');
            if (oldToast) oldToast.remove();

            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            const formattedTime = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

            const toast = document.createElement('div');
            toast.id = 'kineflex-resume-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 85px;
                left: 24px;
                z-index: 100000;
                background: rgba(15, 17, 26, 0.92);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                border: 1px solid rgba(232, 160, 32, 0.45);
                box-shadow: 0 10px 30px rgba(0,0,0,0.7);
                color: #fff;
                padding: 10px 16px;
                border-radius: 10px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 12px;
                pointer-events: auto;
                user-select: none;
                transition: opacity 0.4s ease, transform 0.4s ease;
            `;

            toast.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:#e8a020; font-size:16px;">▶</span>
                    <span>Resumed from <strong>${formattedTime}</strong></span>
                </div>
                <button id="kineflex-restart-btn" style="
                    background: rgba(255, 255, 255, 0.12);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: #fff;
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                ">Restart</button>
                <span id="kineflex-close-toast" style="
                    cursor: pointer;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 16px;
                    margin-left: 4px;
                    line-height: 1;
                ">&times;</span>
            `;

            document.body.appendChild(toast);

            const restartBtn = document.getElementById('kineflex-restart-btn');
            if (restartBtn) {
                restartBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof this.seekTo === 'function') {
                        this.seekTo(0);
                    }
                    this.saveProgress(true);
                    toast.remove();
                });
            }

            const closeBtn = document.getElementById('kineflex-close-toast');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toast.remove();
                });
            }

            setTimeout(() => {
                if (toast.parentElement) {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateY(10px)';
                    setTimeout(() => toast.remove(), 400);
                }
            }, 5500);
        } catch (e) {
            console.warn("[WatchProgress] Could not render resume banner", e);
        }
    }

    async saveProgress(force = false) {
        if (!this.token || !this.hasLoadedProgress) return;

        // If target resume seek is still pending, don't overwrite with 0s!
        if (!this.isResumed && this.targetResumeTime > 0) {
            let cur = 0;
            try {
                if (typeof this.getCurrentTime === 'function') cur = this.getCurrentTime() || 0;
            } catch (e) {}

            if (cur < this.targetResumeTime - 5) {
                this.attemptResume();
                return;
            } else {
                this.isResumed = true;
            }
        }

        const now = Date.now();
        // Throttle to every 10 seconds, unless forced (pause / unload / tab hidden)
        if (!force && now - this.lastSave < 10000) return;

        let currentTime = 0;
        let duration = 0;

        try {
            if (typeof this.getCurrentTime === 'function') currentTime = this.getCurrentTime() || 0;
            if (typeof this.getDuration === 'function') duration = this.getDuration() || 0;
        } catch (e) {}

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
                credentials: 'include',
                keepalive: true
            });
            if (res.status === 401 || res.status === 403) {
                this._handleExpiredSession();
                return;
            }
            console.log(`[WatchProgress] Saved to Go backend: ${Math.floor(currentTime)}s / ${Math.floor(duration)}s`);
        } catch (e) {
            console.error("[WatchProgress] Failed to save progress", e);
        }
    }

    // The Supabase access token expired or was revoked. Clear the stale
    // credentials so the account widget correctly shows "signed out"
    // instead of silently failing to save forever.
    _handleExpiredSession() {
        console.warn("[WatchProgress] Session expired, please sign in again.");
        localStorage.removeItem('watch_token');
        localStorage.removeItem('watch_user_id');
        localStorage.removeItem('watch_email');
        this.token = null;
        this.userId = null;
    }
}

window.WatchProgress = WatchProgress;

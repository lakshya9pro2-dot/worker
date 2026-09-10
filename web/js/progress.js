const WATCH_API = "https://testing-for-api.onrender.com"; // Should be updated to the actual Go API URL

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
        } else {
            console.warn("WatchProgress: No watch_token found or invalid video ID.");
        }
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
            }
        } catch (e) {
            console.error("WatchProgress: Could not load progress", e);
        }
    }

    async saveProgress(force = false) {
        if (!this.token) return;
        
        const now = Date.now();
        // Throttle to every 10 seconds, unless forced
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
            await fetch(`${WATCH_API}/api/progress`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });
            console.log(`WatchProgress: Saved at ${currentTime}s`);
        } catch (e) {
            console.error("WatchProgress: Failed to save progress", e);
        }
    }
}

window.WatchProgress = WatchProgress;

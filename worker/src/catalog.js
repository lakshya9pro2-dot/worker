export async function getCatalog(env) {
    const url = env.GITHUB_CATALOG_URL || "https://raw.githubusercontent.com/Kineflex/Newflix/refs/heads/main/video.json";
    
    // Check if we have a cached version using fetch cache
    const cache = await caches.open("kineflex-catalog");
    let response = await cache.match(url);
    
    if (!response) {
        const fetchRes = await fetch(url, {
            cf: { cacheTtl: 300 } // Cloudflare specific caching
        });
        
        if (!fetchRes.ok) {
            throw new Error(`Failed to fetch catalog: ${fetchRes.status}`);
        }
        
        // Clone the response because we want to cache it and read it
        response = new Response(fetchRes.body, fetchRes);
        response.headers.set("Cache-Control", "s-maxage=300");
        await cache.put(url, response.clone());
    }
    
    return await response.json();
}

export function findMovie(catalog, id) {
    return catalog.find(item => item.type === 'movie' && item.id === id);
}

export function findTvEpisode(catalog, id, seasonNum, episodeNum) {
    const show = catalog.find(item => item.type === 'tv' && item.id === id);
    if (!show || !show.seasons) return null;
    
    const season = show.seasons.find(s => s.season === seasonNum);
    if (!season || !season.episodes) return null;
    
    return season.episodes.find(e => e.episode === episodeNum);
}

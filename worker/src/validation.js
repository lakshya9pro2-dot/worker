export function isPositiveInteger(value) {
    const num = Number(value);
    return Number.isInteger(num) && num > 0;
}

export function validateMoviePath(parts) {
    // /api/resolve/movie/:id
    if (parts.length < 4) return null;
    const id = parseInt(parts[3], 10);
    if (!isPositiveInteger(id)) return null;
    return { type: 'movie', id };
}

export function validateTvPath(parts) {
    // /api/resolve/tv/:id/:season/:episode
    if (parts.length < 6) return null;
    const id = parseInt(parts[3], 10);
    const season = parseInt(parts[4], 10);
    const episode = parseInt(parts[5], 10);
    
    if (!isPositiveInteger(id) || !isPositiveInteger(season) || !isPositiveInteger(episode)) return null;
    return { type: 'tv', id, season, episode };
}

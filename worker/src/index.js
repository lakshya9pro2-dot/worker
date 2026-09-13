import { handleOptions, createJsonResponse, corsHeaders } from './cors.js';
import { validateMoviePath, validateTvPath } from './validation.js';
import { getCatalog, findMovie, findTvEpisode } from './catalog.js';
import { createSession, getSession, updateSession } from './sessions.js';

const VIDZEE_SERVERS = ['v4:Hindi', 'v4:English', 'dcloud', 'v6:Hindi', 'tik', 'ipcloud'];

async function fetchVidzee(meta) {
    for (const srv of VIDZEE_SERVERS) {
        let url = '';
        if (meta.type === 'movie') {
            url = `https://core.vidzee.wtf/streams/movie/${meta.id}?s=${srv}&e=1`;
        } else if (meta.type === 'tv') {
            url = `https://core.vidzee.wtf/streams/tv/${meta.id}/${meta.season}/${meta.episode}?s=${srv}&e=1`;
        }

        try {
            const res = await fetch(url, {
                headers: {
                    "Origin": "https://player.vidzee.wtf",
                    "Referer": "https://player.vidzee.wtf/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });

            if (res.ok) {
                const data = await res.json();
                if (data && data.c) {
                    return data;
                }
            }
        } catch (e) {
            // Ignore fetch errors and try the next server
        }
    }
    return null;
}

export default {
    async fetch(request, env, ctx) {
        if (request.method === "OPTIONS") {
            return handleOptions(request);
        }

        const url = new URL(request.url);
        const parts = url.pathname.split('/').filter(Boolean);

        try {
            if (url.pathname === '/api/proxy') {
                return await handleProxy(request);
            }

            if (url.pathname.startsWith('/api/resolve/')) {
                let meta = null;
                let foundItem = null;
                let catalog = [];

                try {
                    catalog = await getCatalog(env);
                } catch (e) {
                    console.error("Catalog fetch error:", e);
                }

                if (parts[2] === 'movie') {
                    meta = validateMoviePath(parts);
                    if (meta) foundItem = findMovie(catalog, meta.id);
                } else if (parts[2] === 'tv') {
                    meta = validateTvPath(parts);
                    if (meta) foundItem = findTvEpisode(catalog, meta.id, meta.season, meta.episode);
                }

                if (!meta) {
                    return createJsonResponse({ success: false, error: "Invalid parameters" }, 400);
                }

                // 1. First Priority: JSON Catalog
                if (foundItem && foundItem.play) {
                    return createJsonResponse({
                        success: true,
                        source: "catalog",
                        type: meta.type,
                        id: meta.id,
                        ...(meta.type === 'tv' ? { season: meta.season, episode: meta.episode } : {}),
                        play: foundItem.play,
                        quality: foundItem.quality || "HD"
                    });
                } 
                
                // 2. Second Priority: Vidzee APIs
                const vidzeePayload = await fetchVidzee(meta);
                if (vidzeePayload) {
                    return createJsonResponse({
                        success: true,
                        source: "vidzee",
                        type: meta.type,
                        payload: vidzeePayload.c
                    });
                }

                // 3. Third Priority: Vidfast (Resolver Session)
                const requestId = await createSession(env, meta);
                return createJsonResponse({
                    success: false,
                    source: "vidfast",
                    resolverRequired: true,
                    requestId: requestId
                });
            }

            if (url.pathname === '/api/session/create' && request.method === 'POST') {
                const body = await request.json().catch(() => ({}));
                const requestId = await createSession(env, body.meta || {});
                return createJsonResponse({ requestId });
            }

            if (url.pathname.startsWith('/api/session/') && parts.length === 3) {
                const requestId = parts[2];
                if (request.method === 'GET') {
                    const session = await getSession(env, requestId);
                    if (!session) return createJsonResponse({ success: false, error: "Not found or expired" }, 404);
                    return createJsonResponse({ success: true, session });
                }
            }
            
            if (url.pathname.startsWith('/api/session/') && parts.length === 4 && parts[3] === 'result' && request.method === 'POST') {
                const requestId = parts[2];
                const result = await request.json().catch(() => ({}));
                const updated = await updateSession(env, requestId, result);
                if (!updated) return createJsonResponse({ success: false, error: "Session not found" }, 404);
                return createJsonResponse({ success: true });
            }

            return createJsonResponse({ success: false, error: "Route not found" }, 404);

        } catch (err) {
            return createJsonResponse({ success: false, error: "Internal Server Error" }, 500);
        }
    }
};

async function handleProxy(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
        return createJsonResponse({ error: "Missing url parameter" }, 400);
    }
    
    try {
        const targetUrlObj = new URL(targetUrl);
        const allowedDomains = ['moon.peakstorm.top', 'cdn4.turboviplay.com'];
        if (!allowedDomains.includes(targetUrlObj.hostname)) {
            return createJsonResponse({ error: "Forbidden proxy target" }, 403);
        }

        const headers = new Headers();
        if (targetUrlObj.hostname === 'moon.peakstorm.top') {
            headers.set("Host", "moon.peakstorm.top");
            headers.set("Origin", "https://vidfast.vc");
            headers.set("Referer", "https://vidfast.vc/");
            headers.set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64; rv:151.0) Gecko/20100101 Firefox/151.0");
        } else {
            headers.set("User-Agent", request.headers.get("User-Agent") || "Mozilla/5.0");
        }

        const res = await fetch(targetUrl, { headers });
        let body = null;
        const contentType = res.headers.get("content-type") || "";
        
        if (targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('x-mpegURL')) {
            const text = await res.text();
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                if (line && !line.startsWith('#')) {
                    let absoluteUri = line;
                    if (!line.startsWith('http')) {
                        absoluteUri = new URL(line, targetUrl).href;
                    }
                    const proxyUrl = new URL(request.url);
                    proxyUrl.pathname = '/api/proxy';
                    proxyUrl.searchParams.set('url', absoluteUri);
                    lines[i] = proxyUrl.href;
                }
            }
            body = lines.join('\n');
        } else {
            body = await res.arrayBuffer();
        }

        const responseHeaders = new Headers(res.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        
        return new Response(body, {
            status: res.status,
            headers: responseHeaders
        });

    } catch (e) {
        return createJsonResponse({ error: "Proxy fetch failed" }, 502);
    }
}

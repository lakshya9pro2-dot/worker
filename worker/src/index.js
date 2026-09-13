import { handleOptions, createJsonResponse, corsHeaders } from './cors.js';
import { validateMoviePath, validateTvPath } from './validation.js';
import { getCatalog, findMovie, findTvEpisode } from './catalog.js';
import { createSession, getSession, updateSession } from './sessions.js';

const VIDZEE_SERVERS = ['v4:Hindi', 'v4:English', 'dcloud', 'v6:Hindi', 'tik', 'ipcloud'];
const R = "const R="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////////////////////////////9/D/////////////////////////////////7/////8BAwAAAB8AQZwrC0ogAAAAAADPvEDX///7////////////v///////////////////////A/z///////////////////////////7///9/AP//////AQBBiCwLDP////+/IP//////5wBBqCwLDP////////////8/PwBBxCwLUP8B///////nAAAAAAAAAAD///////////////////////////////8AAAAAAAAAAP//Pz//////Pz//qv///z/////////fX9wfzw//H9wfAEGiLQsGAoAAAP8fAEG0LQsRhPwvPlC9H/LgQwAA/////xgAQeotCzDA////////AwAA//////9///////9//////////////////////x94DAD/////vyAAQbwuCwz//////z8AAP///z8AQdguCz/8////////////////eP////////wHAAAAAGAHAAAAAAAA///////3/wH/////////////AAAAAAAAAAB/APgAQbgvCwj+//8H/v//BwBB1C8LCv////////////8AQeovCwr/////D/////8PAEGEMAsP////////BwD///////8HAEGoMAsI//////////8AQbwwCwj//////////wBB1DALiQH/////////////3///////////32Te/+vv/////////7/n39////97X/z9//////////////////////////////////////////////////////8//////f//9/////f//9/////f//9/////f/////3////9///3DwAAAAAAAP//////////DwBB+jELDP///wP///8D////AwBBlDILgAQHCAkKCwwGBgYGBgYGBgYGDQYGDgYGBgYGBgYGDxAREgYTBgYGBgYGBgYGBhQVBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGFhcGBgYYBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYZBgYGBhoGBgYGBgYGGwYGBgYGBgYGBgYGHAYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYdBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYeBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgBBgzcLFCQrKysrKysrKwEAVFZWVlZWVlZWAEGqNwufAxgAAAArKysrKysrBysrW1ZWVlZWVlZKVlYFMVAxUDFQMVAxUDFQMVAxUCRQeTFQMVAxOFAxUDFQMVAxUDFQMVAxUE4xAk4NDU4DTgAkbgBOMSZuUU4kUE45FIEbHR1TMVAxUA0xUDFQMVAbUyRQMQJce1x7XHtce1x7FHlce1x7XC0rSQNIA3hcexQAlgoBKygGBgAqBioqKwe7tSseACsHKysrASsrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrASsrKysrKysrKysrKysrKysrKysrKysrKisrKysrKysrKysrKyvNRs0rACUrBwEGAVVWVlZWVlVWVgIkgYGBgYEVgYGBAAArALLRstGy0bLRAADNzAEA19fX19eDgYGBgYGBgYGBgaysrKysrKysrKwcAAAAAAAxUDFQMVAxUDFQMQIAADFQMVAxUDFQMVAxUDFQMVAxUE4xUDFQTjFQMVAxUDFQMVAxUDFQMQKHpoemh6aHpoemh6aHpoemKisrKysrKysrKysrKwAAAFRWVlZWVlZWVlZWVlYAQac7CyFUVlZWVlZWVlZWVlZWDAAMKisrKysrKysrKysrKysHKgEAQf07C3cqKysrKysrKysrKysrKysrKysrKysrKysrKytWVmyBFQArKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysHbANBKytWVlZWVlZWVlZWVlZWVixWKysrKysrKysrKysrKysrKysrKysrAQBBnD0LCAxsAAAAAAAGAEHKPQvoAgYlBiUGJQYlBiUGJQYlBiUGJQYlBiUGJQYlBiUGJQYlBiUGJQYlBiUGJQYlBiUGJQYlVnqeJgYlBiUGJQYlBiUGJQYlBiUGJQYlBiUGJQYlBiUGJQYBKytPVlYsK39WVjkrK1VWVisrT1ZWLCt/VlaBN3Vbe1wrK09WVgKsBAAAOSsrVVZWKytPVlYsKytWVjITgVcAb4F+ydd+LYGBDn45f29XAIGBfhUAfgMrKysrKysrKysrKysHKyQrlysrKysrKysrKyorKysrK1ZWVlZWgIGBgYE5uyorKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrAYGBgYGBgYGBgYGBgYGBgcmsrKysrKysrKysrKysrKzQDQBOMQK0wcHX1yRQMVAxUDFQMVAxUDFQMVAxUDFQMVAxUDFQMVAxUDFQMVDX11PBR9TX19cFKysrKysrKysrKysrBwEAAQBBjcEACx9OMVAxUDFQMVAxUDFQMVANAAAAAAAkUDFQMVAxUDFQAEHOwQALVisrKysrKysrKysreVx7XHtPe1x7XHtce1x7XHtce1x7XHtce1wtKyt5FFx7XC15KlwnXHtce1x7pAAKtFx7XHtPA3g4KysrKysrKysrKysrK08tKysBAEG/wgALAUgAQcnCAAsbKisrKysrKysrKysrKysrKysrKysrKysrKysrAEGFwwALFCsrKysrKysrBwBIVlZWVlZWVlYCAEHQwwALGysrKysrKysrKysrKytVVlZWVlZWVlZWVlZWDgBBisQACxokKysrKysrKysrKysHAFZWVlZWVlZWVlZWVgBB0MQACyckKysrKysrKysrKysrKysrKwcAAAAAVlZWVlZWVlZWVlZWVlZWVlYAQbHFAAsWKisrKysrKysrKytWVlZWVlZWVlZWDgBB58UACxYqKysrKysrKysrK1ZWVlZWVlZWVlYOAEGoxgALFysrKysrKysrKysrVVZWVlZWVlZWVlYOAEGBxwALCAgAAFYBAAA5AEGQxwALvAcBIAAAAOD//wC/HQAA5wIAAHkAAAIkAAABAQAAAP///wAAAAABAgAAAP7//wE5//8AGP//AYf//wDU/v8AwwAAAdIAAAHOAAABzQAAAU8AAAHKAAABywAAAc8AAABhAAAB0wAAAdEAAACjAAAB1QAAAIIAAAHWAAAB2gAAAdkAAAHbAAAAOAAAAwAAAACx//8Bn///Acj//wIoJAAAAAAAAQEAAAD///8AM///ACb//wF+//8BKyoAAV3//wEoKgAAPyoAAT3//wFFAAABRwAAAB8qAAAcKgAAHioAAC7//wAy//8ANv//ADX//wBPpQAAS6UAADH//wAopQAARKUAAC///wAt//8A9ykAAEGlAAD9KQAAK///ACr//wDnKQAAQ6UAACqlAAC7//8AJ///ALn//wAl//8AFaUAABKlAAIkTAAAAAAAASAAAADg//8BAQAAAP///wBUAAABdAAAASYAAAElAAABQAAAAT8AAADa//8A2///AOH//wDA//8Awf//AQgAAADC//8Ax///ANH//wDK//8A+P//AKr//wCw//8ABwAAAIz//wHE//8AoP//Afn//wIacAABAQAAAP///wEgAAAA4P//AVAAAAEPAAAA8f//AAAAAAEwAAAA0P//AQEAAAD///8AAAAAAMALAAFgHAAAAAAAAdCXAAEIAAAA+P//AgWKAAAAAAABQPT/AJ7n/wDCiQAA2+f/AJLn/wCT5/8AnOf/AJ3n/wCk5/8AAAAAADiKAAAEigAA5g4AAQEAAAD///8AAAAAAMX//wFB4v8CHY8AAAgAAAH4//8AAAAAAFYAAAGq//8ASgAAAGQAAACAAAAAcAAAAH4AAAAJAAABtv//Aff//wDb4/8BnP//AZD//wGA//8Bgv//AgWsAAAAAAABEAAAAPD//wEcAAABAQAAAaPi/wFB3/8But//AOT//wILsQABAQAAAP///wEwAAAA0P//AAAAAAEJ1v8BGvH/ARnW/wDV1f8A2NX/AeTV/wED1v8B4dX/AeLV/wHB1f8AAAAAAKDj/wAAAAABAQAAAP///wIMvAAAAAAAAQEAAAD///8BvFr/AaADAAH8df8B2Fr/ADAAAAGxWv8BtVr/Ab9a/wHuWv8B1lr/Aeta/wHQ//8BvVr/Ach1/wAAAAAAMGj/AGD8/wAAAAABIAAAAOD//wAAAAABKAAAANj//wAAAAABQAAAAMD//wAAAAABIAAAAOD//wAAAAABIAAAAOD//wAAAAABIgAAAN7//wBBzc4ACwUGJ1FvdwBB3M4ACxJ8AAB/AAAAAAAAAACDjpKXAKoAQfjOAAsCtMQAQfLPAAsGxskAAADbAEHL0AALDt4AAAAA4QAAAAAAAADkAEHk0AALAecAQbrRAAsB6gBBtdIACwHtAEHM0gALkAMwDDENeA5/D4AQgRGGEokTihOOFI8VkBaTE5QXlRiWGZcamhucGZ0cnh2fHqYfqR+uH7EgsiC3Ib8ixSPII8sj3STyI/Yl9yYgLTouPS8+MD8xQDFDMkQzRTRQNVE2UjdTOFQ5WTpbO1w8YT1jPmU/ZkBoQWlCakBrQ2xEb0JxRXJGdUd9SIJJh0qJS4pMi0yMTZJOnU+eUEVXex18HX0df1iGWYhaiVqKWoxbjlyPXKxdrV6uXq9ewl/MYM1hzmHPYtBj0WTVZdZm12fwaPFp8mrza/Rs9W35bv0t/i3/LVBpUWlSaVNpVGlVaVZpV2lYaVlpWmlbaVxpXWleaV9pggCDAIQAhQCGAIcAiACJAMB1z3aAiYGKgouFjIaNcJ1xnXaed554n3mfeqB7oHyhfaGzorqju6O8pL6lw6LMpNqm26blauqn66fsbvOi+Kj5qPqp+6n8pCawKrErsk6zhAhiumO7ZLxlvWa+bb9uwG/BcMJ+w3/Dfc+N0JTRq9Ks063UsNWx1rLXxNjF2cbaAEHc1QALATwAQejVAAsrAgAAACQAAABJAG4AZABlAHgAIABvAHUAdAAgAG8AZgAgAHIAYQBuAGcAZQBBnNYACwEsAEGo1gALIQIAAAAaAAAAfgBsAGkAYgAvAGEAcgByAGEAeQAuAHQAcwBBzNYACwF8AEHY1gALZQIAAABeAAAARQBsAGUAbQBlAG4AdAAgAHQAeQBwAGUAIABtAHUAcwB0ACAAYgBlACAAbgB1AGwAbABhAGIAbABlACAAaQBmACAAYQByAHIAYQB5ACAAaQBzACAAaABvAGwAZQB5AEHM1wALASwAQdjXAAsjAgAAABwAAABJAG4AdgBhAGwAaQBkACAAbABlAG4AZwB0AGgAQfzXAAsBPABBiNgACy0CAAAAJgAAAH4AbABpAGIALwBhAHIAcgBhAHkAYgB1AGYAZgBlAHIALgB0AHMAQbzYAAsBPABByNgACy0CAAAAJgAAAH4AbABpAGIALwBzAHQAYQB0AGkAYwBhAHIAcgBhAHkALgB0AHMAQfzYAAsBPABBiNkACysCAAAAJAAAAH4AbABpAGIALwB0AHkAcABlAGQAYQByAHIAYQB5AC4AdABzAEG82QALATwAQcjZAAsxAgAAACoAAABPAGIAagBlAGMAdAAgAGEAbAByAGUAYQBkAHkAIABwAGkAbgBuAGUAZABBnNoACwE8AEGo2gALLwIAAAAoAAAATwBiAGoAZQBjAHQAIABpAHMAIABuAG8AdAAgAHAAaQBuAG4AZQBkAEGA2wALIQgAAAAgAAAAIAAAACAAAAAAAAAAQgAAAAJBAABBAAAAZA=="";

function decodeBase64(w) {
    const g = atob(w);
    const Y = new ArrayBuffer(g.length);
    const Q = new Uint8Array(Y);
    for (let E = 0; E < g.length; E++) Q[E] = g.charCodeAt(E);
    return Q;
}

async function wasmDecrypt(payloadStr) {
    try {
        const w = decodeBase64(R);
        const Y = {
            env: { abort: function(A, B, C, I) { console.error("WASM abort"); } }
        };
        const instance = await WebAssembly.instantiate(w, Y);
        const exports = instance.instance ? instance.instance.exports : instance.exports;
        const memory = exports.memory;
        const s = new DataView(memory.buffer);
        
        function i(A) {
            if (A == null) return 0;
            const B = A.length;
            const C = exports.__new(B << 1, 2) >>> 0;
            const I = new Uint16Array(memory.buffer);
            for (let G = 0; G < B; ++G) I[(C >>> 1) + G] = A.charCodeAt(G);
            return C;
        }
        
        function F(A, B) {
            return B ? new A(memory.buffer, s.getUint32(B + 4, true), s.getUint32(B + 8, true) / A.BYTES_PER_ELEMENT).slice() : null;
        }
        
        function e(A, B, C, I) {
            if (I == null) return 0;
            const G = I.length;
            const y = exports.__pin(exports.__new(G << C, 1)) >>> 0;
            const D = exports.__new(12, B) >>> 0;
            s.setUint32(D + 0, y, true);
            s.setUint32(D + 4, y, true);
            s.setUint32(D + 8, G << C, true);
            new A(memory.buffer, y, G).set(I);
            exports.__unpin(y);
            return D;
        }

        const A_param = e(Uint8Array, 6, 0, decodeBase64(payloadStr));
        const B_param = i("player.vidzee.wtf");

        const decryptedPtr = exports.decrypt(A_param, B_param);
        const resultBytes = F(Uint8Array, decryptedPtr >>> 0);
        return JSON.parse(new TextDecoder().decode(resultBytes));
    } catch (err) {
        console.error("Worker WASM Error:", err);
        return null;
    }
}

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
                    return data.c;
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
                const vidzeePayloadStr = await fetchVidzee(meta);
                if (vidzeePayloadStr) {
                    const decrypted = await wasmDecrypt(vidzeePayloadStr);
                    if (decrypted && decrypted.url) {
                        return createJsonResponse({
                            success: true,
                            source: "vidzee",
                            type: meta.type,
                            id: meta.id,
                            ...(meta.type === 'tv' ? { season: meta.season, episode: meta.episode } : {}),
                            play: decrypted.url,
                            quality: decrypted.language || "HD"
                        });
                    }
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

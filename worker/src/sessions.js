const memoryCache = new Map();

export async function createSession(env, meta) {
    const requestId = crypto.randomUUID();
    const data = {
        createdAt: Date.now(),
        status: 'pending',
        meta: meta, // Store what we are resolving
        result: null
    };
    
    if (env.SESSIONS) {
        await env.SESSIONS.put(requestId, JSON.stringify(data), { expirationTtl: 300 }); // 5 min
    } else {
        memoryCache.set(requestId, data);
        setTimeout(() => memoryCache.delete(requestId), 300000);
    }
    
    return requestId;
}

export async function getSession(env, requestId) {
    if (env.SESSIONS) {
        const data = await env.SESSIONS.get(requestId);
        return data ? JSON.parse(data) : null;
    } else {
        return memoryCache.get(requestId) || null;
    }
}

export async function updateSession(env, requestId, result) {
    const session = await getSession(env, requestId);
    if (!session) return false;
    
    session.status = 'completed';
    session.result = result;
    
    if (env.SESSIONS) {
        await env.SESSIONS.put(requestId, JSON.stringify(session), { expirationTtl: 300 });
    } else {
        memoryCache.set(requestId, session);
    }
    return true;
}

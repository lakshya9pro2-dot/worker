// ============================================================
// Kineflex – shared auth helper (Player Website)
// ============================================================
// Supports:
// - Cross-site SSO ticket exchange (?sso_code=...)
// - Google / Gmail OAuth redirect flow with exact return_url
// - Token validation against /api/auth/user
// - Full logout synced across domains via /api/auth/logout
// - Local session persistence under keys:
//     watch_token     -> Supabase access_token
//     watch_user_id   -> Supabase user UUID
//     watch_email     -> user's email
(function () {
    const API = window.WATCH_API_BASE || "https://testing-for-api.onrender.com";

    function getToken() { return localStorage.getItem('watch_token'); }
    function getUserId() { return localStorage.getItem('watch_user_id'); }
    function getEmail() { return localStorage.getItem('watch_email'); }
    function isSignedIn() { return !!getToken(); }

    function storeSession(accessToken, user) {
        if (!accessToken) return;
        localStorage.setItem('watch_token', accessToken);
        if (user && user.id) localStorage.setItem('watch_user_id', user.id);
        if (user && user.email) localStorage.setItem('watch_email', user.email);
        window.dispatchEvent(new CustomEvent('kineflex-auth-changed', {
            detail: { signedIn: true, user }
        }));
    }

    function clearLocalSession() {
        localStorage.removeItem('watch_token');
        localStorage.removeItem('watch_user_id');
        localStorage.removeItem('watch_email');
        window.dispatchEvent(new CustomEvent('kineflex-auth-changed', {
            detail: { signedIn: false }
        }));
    }

    async function logout() {
        const token = getToken();
        clearLocalSession();

        try {
            await fetch(`${API}/api/auth/logout`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                credentials: 'include',
                keepalive: true
            });
        } catch (e) {
            console.warn("Logout request failed:", e);
        }
    }

    function signOut() {
        return logout();
    }

    function loginWithGoogle(returnUrl) {
        const dest = returnUrl || window.location.href;
        window.location.href = `${API}/api/auth/google?return_url=${encodeURIComponent(dest)}`;
    }

    function signInWithGoogle(returnUrl) {
        return loginWithGoogle(returnUrl);
    }

    function extractErrorMessage(data, fallback) {
        if (!data) return fallback;
        return data.msg || data.error_description || data.error || data.message || fallback;
    }

    async function signUp(email, password) {
        try {
            const res = await fetch(`${API}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return { ok: false, signedIn: false, message: extractErrorMessage(data, 'Sign up failed.') };
            }
            if (data.access_token && data.user) {
                storeSession(data.access_token, data.user);
                return { ok: true, signedIn: true, message: 'Account created.' };
            }
            return { ok: true, signedIn: false, message: 'Account created. Check your email to confirm it, then sign in.' };
        } catch (e) {
            return { ok: false, signedIn: false, message: 'Network error reaching the API.' };
        }
    }

    async function signIn(email, password) {
        try {
            const res = await fetch(`${API}/api/auth/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.access_token) {
                return { ok: false, message: extractErrorMessage(data, 'Sign in failed.') };
            }
            storeSession(data.access_token, data.user);
            return { ok: true, message: 'Signed in.' };
        } catch (e) {
            return { ok: false, message: 'Network error reaching the API.' };
        }
    }

    async function validateSession() {
        const token = getToken();
        if (!token) return null;

        try {
            const res = await fetch(`${API}/api/auth/user`, {
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include'
            });
            if (res.ok) {
                const user = await res.json();
                if (user && user.id) {
                    localStorage.setItem('watch_user_id', user.id);
                    if (user.email) localStorage.setItem('watch_email', user.email);
                    return user;
                }
            } else if (res.status === 401 || res.status === 403) {
                console.warn("Session revoked or expired. Logging out.");
                clearLocalSession();
                return null;
            }
        } catch (e) {
            console.warn("Could not validate session with API:", e);
        }
        return { id: getUserId(), email: getEmail() };
    }

    async function handleSSOCallback() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const ssoCode = urlParams.get('sso_code');
            if (!ssoCode) return false;

            const res = await fetch(`${API}/api/auth/sso/exchange`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: ssoCode }),
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                if (data.access_token && data.user) {
                    storeSession(data.access_token, data.user);
                }
            } else {
                console.warn("SSO ticket exchange failed");
            }

            // Remove sso_code from address bar cleanly
            urlParams.delete('sso_code');
            const cleanSearch = urlParams.toString() ? '?' + urlParams.toString() : '';
            const cleanUrl = window.location.pathname + cleanSearch + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);

            return isSignedIn();
        } catch (e) {
            console.error("Error during SSO exchange:", e);
            return false;
        }
    }

    async function getSSOTicket(targetUrl) {
        const token = getToken();
        if (!token) return null;

        try {
            const res = await fetch(`${API}/api/auth/sso/ticket`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ return_url: targetUrl }),
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                return data.code || null;
            }
        } catch (e) {
            console.warn("Failed to generate SSO ticket:", e);
        }
        return null;
    }

    async function buildSSOUrl(targetUrl) {
        if (!targetUrl) return targetUrl;
        const code = await getSSOTicket(targetUrl);
        if (!code) return targetUrl;
        const sep = targetUrl.includes('?') ? '&' : '?';
        return `${targetUrl}${sep}sso_code=${encodeURIComponent(code)}`;
    }

    let initPromise = null;
    function init() {
        if (!initPromise) {
            initPromise = (async () => {
                await handleSSOCallback();
                if (isSignedIn()) {
                    await validateSession();
                }
                return isSignedIn();
            })();
        }
        return initPromise;
    }

    function mountAccountWidget(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;

        function render() {
            el.innerHTML = '';
            if (isSignedIn()) {
                const label = document.createElement('span');
                label.textContent = `✓ Synced as ${getEmail() || 'account'}`;
                label.style.color = '#2ecc71';
                label.style.fontWeight = '600';

                const signOutLink = document.createElement('a');
                signOutLink.href = '#';
                signOutLink.textContent = 'Sign out';
                signOutLink.style.marginLeft = '0.6rem';
                signOutLink.style.color = 'rgba(255,255,255,0.7)';
                signOutLink.style.textDecoration = 'underline';
                signOutLink.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await logout();
                    render();
                });
                el.appendChild(label);
                el.appendChild(signOutLink);
            } else {
                const link = document.createElement('a');
                const redirect = encodeURIComponent(window.location.pathname + window.location.search);
                link.href = `/auth.html?redirect=${redirect}`;
                link.textContent = 'Sign in to save progress';
                link.style.textDecoration = 'underline';
                link.style.color = '#e8a020';
                link.style.fontWeight = '600';
                el.appendChild(link);
            }
        }

        render();
        window.addEventListener('kineflex-auth-changed', render);
    }

    // Automatically initialize on load
    init();

    window.KineflexAuth = {
        API,
        init,
        getToken,
        getUserId,
        getEmail,
        isSignedIn,
        signUp,
        signIn,
        loginWithGoogle,
        signInWithGoogle,
        signOut,
        logout,
        validateSession,
        handleSSOCallback,
        getSSOTicket,
        buildSSOUrl,
        mountAccountWidget
    };
})();

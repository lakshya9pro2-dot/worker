// ============================================================
// Kineflex – shared auth helper
// ============================================================
// Talks to the Go "watch-progress-api" backend's
// /api/auth/signup, /api/auth/signin, /api/auth/user,
// /api/auth/google, /api/auth/sso and /api/auth/logout
// endpoints, and keeps the resulting Supabase session in
// localStorage under the same keys progress.js reads:
//   watch_token     -> Supabase access_token
//   watch_user_id   -> Supabase user UUID
//   watch_email     -> user's email (for display only)
(function () {
    const API = window.WATCH_API_BASE || "https://testing-for-api.onrender.com";

    function getToken() { return localStorage.getItem('watch_token'); }
    function getUserId() { return localStorage.getItem('watch_user_id'); }
    function getEmail() { return localStorage.getItem('watch_email'); }
    function isSignedIn() { return !!getToken(); }

    function storeSession(accessToken, user) {
        if (accessToken) localStorage.setItem('watch_token', accessToken);
        if (user && user.id) localStorage.setItem('watch_user_id', user.id);
        if (user && user.email) localStorage.setItem('watch_email', user.email);
        window.dispatchEvent(new CustomEvent('kineflex_auth_changed', { detail: { isSignedIn: true, user } }));
    }

    async function signOut() {
        localStorage.removeItem('watch_token');
        localStorage.removeItem('watch_user_id');
        localStorage.removeItem('watch_email');
        try {
            await fetch(`${API}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e) {
            console.warn("KineflexAuth: Logout network error", e);
        }
        window.dispatchEvent(new CustomEvent('kineflex_auth_changed', { detail: { isSignedIn: false } }));
    }

    function extractErrorMessage(data, fallback) {
        if (!data) return fallback;
        return data.msg || data.error_description || data.error || data.message || fallback;
    }

    // Check URL parameters for single-use SSO authorization code
    async function handleSSOCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const ssoCode = urlParams.get('sso_code');
        if (!ssoCode) return false;

        // Clean the sso_code parameter from the address bar immediately
        urlParams.delete('sso_code');
        const cleanSearch = urlParams.toString() ? ('?' + urlParams.toString()) : '';
        const cleanUrl = window.location.pathname + cleanSearch + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);

        try {
            const res = await fetch(`${API}/api/auth/sso/exchange`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code: ssoCode })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.access_token && data.user) {
                    storeSession(data.access_token, data.user);
                    return true;
                }
            }
        } catch (e) {
            console.error("KineflexAuth: SSO exchange failed", e);
        }
        return false;
    }

    // Validate existing session or initiate cross-site SSO
    async function ensureAuthenticated(options = {}) {
        const autoRedirect = options.autoRedirect !== false;
        const returnUrl = options.returnUrl || window.location.href;

        // 1. If we have a token, verify it server-side
        const token = getToken();
        if (token) {
            try {
                const res = await fetch(`${API}/api/auth/user`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const user = await res.json();
                    storeSession(token, user);
                    return { ok: true, user };
                } else if (res.status === 401) {
                    // Token expired: clear and re-authenticate
                    localStorage.removeItem('watch_token');
                    localStorage.removeItem('watch_user_id');
                    localStorage.removeItem('watch_email');
                }
            } catch (e) {
                console.warn("KineflexAuth: Session check network error", e);
                // Return offline/optimistic if network failed but token exists
                return { ok: true, user: { id: getUserId(), email: getEmail() } };
            }
        }

        // 2. If not authenticated, redirect to central SSO
        if (autoRedirect) {
            const ssoUrl = `${API}/api/auth/sso?return_url=${encodeURIComponent(returnUrl)}`;
            window.location.href = ssoUrl;
            return { ok: false, redirected: true };
        }

        return { ok: false };
    }

    // Google Login redirect preserving return_url
    function signInWithGoogle(returnUrl) {
        const target = returnUrl || window.location.href;
        window.location.href = `${API}/api/auth/google?return_url=${encodeURIComponent(target)}`;
    }

    async function signUp(email, password) {
        try {
            const res = await fetch(`${API}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
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
                credentials: 'include',
                body: JSON.stringify({ email, password })
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

    function mountAccountWidget(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;

        function render() {
            el.innerHTML = '';
            if (isSignedIn()) {
                const label = document.createElement('span');
                label.textContent = `✓ Synced as ${getEmail() || 'account'}`;
                const signOutLink = document.createElement('a');
                signOutLink.href = '#';
                signOutLink.textContent = 'Sign out';
                signOutLink.style.marginLeft = '0.6rem';
                signOutLink.style.textDecoration = 'underline';
                signOutLink.style.color = '#e8a020';
                signOutLink.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await signOut();
                    render();
                });
                el.appendChild(label);
                el.appendChild(signOutLink);
            } else {
                const link = document.createElement('a');
                const redirect = encodeURIComponent(window.location.href);
                link.href = `/auth.html?redirect=${redirect}`;
                link.textContent = 'Sign in to save progress';
                link.style.textDecoration = 'underline';
                link.style.color = '#e8a020';
                el.appendChild(link);
            }
        }

        render();
        window.addEventListener('kineflex_auth_changed', render);
    }

    // Auto-initialize SSO check immediately upon loading
    const ssoPromise = handleSSOCallback();

    window.KineflexAuth = {
        API,
        getToken,
        getUserId,
        getEmail,
        isSignedIn,
        signUp,
        signIn,
        signOut,
        signInWithGoogle,
        ensureAuthenticated,
        mountAccountWidget,
        ready: ssoPromise
    };
})();

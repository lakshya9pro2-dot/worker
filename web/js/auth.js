// ============================================================
// Kineflex – shared auth helper
// ============================================================
// Talks to the Go "watch-progress-api" backend's
// /api/auth/signup, /api/auth/signin and /api/auth/user
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
        localStorage.setItem('watch_token', accessToken);
        if (user && user.id) localStorage.setItem('watch_user_id', user.id);
        if (user && user.email) localStorage.setItem('watch_email', user.email);
    }

    function signOut() {
        localStorage.removeItem('watch_token');
        localStorage.removeItem('watch_user_id');
        localStorage.removeItem('watch_email');
    }

    function extractErrorMessage(data, fallback) {
        if (!data) return fallback;
        return data.msg || data.error_description || data.error || data.message || fallback;
    }

    // Returns { ok, signedIn, message } — signedIn is true only if the
    // response included a usable session (email confirmation, if enabled
    // in Supabase, means sign-up succeeds without a session).
    async function signUp(email, password) {
        try {
            const res = await fetch(`${API}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    // Renders a small "signed in as X / sign in to save progress" widget
    // into the element with the given id. Safe to call on any page; it
    // no-ops if the element isn't present.
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
                signOutLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    signOut();
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
                el.appendChild(link);
            }
        }

        render();
    }

    window.KineflexAuth = {
        API,
        getToken,
        getUserId,
        getEmail,
        isSignedIn,
        signUp,
        signIn,
        signOut,
        mountAccountWidget
    };
})();

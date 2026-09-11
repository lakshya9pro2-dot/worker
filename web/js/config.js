// ============================================================
// Kineflex – shared front-end configuration
// ============================================================
// Base URL of the deployed Go "watch-progress-api" backend
// (the project in testing-for-api--main / render.yaml, where
// the Render service is named "watch-progress-api").
//
// Every page that talks to the API (progress.js, auth.js,
// auth.html) reads this ONE value, so you only ever need to
// change it here if you redeploy the backend elsewhere.
//
// ⚠️ Confirm this matches your actual Render URL — Render names
// services either after the render.yaml "name" field or after
// the GitHub repo, and the two can differ.
window.WATCH_API_BASE = "https://testing-for-api.onrender.com";

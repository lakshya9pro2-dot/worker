# Kineflex

A lightweight video-resolution website with a fallback browser extension and Cloudflare Workers backend.

## Project Structure

- `worker/` - Cloudflare Workers backend API.
- `web/` - Frontend HTML/JS/CSS files.
- `extension/` - Browser extension for fallback source resolution.

## Deployment

### Backend (Cloudflare Workers)
1. Install Wrangler: `npm install -g wrangler`
2. Navigate to `worker/`: `cd worker`
3. Deploy: `wrangler deploy`
4. Update the `API_BASE` in `web/js/app.js` and `extension/background.js` to match your deployed worker URL, or serve the frontend directly from Cloudflare Pages connected to the Worker.

### Frontend
Deploy the contents of the `web/` folder to Cloudflare Pages, Netlify, or GitHub Pages.
- Cloudflare Pages: Create a new Pages project and link to your repository. Ensure `_redirects` is supported (Pages uses `_redirects`).
- Netlify: Create a new site from folder `web/`.

### Extension (Chrome / Edge)
1. Open Chrome and go to `chrome://extensions/`.
2. Enable "Developer mode".
3. Click "Load unpacked".
4. Select the `extension/` directory.

### Extension (Firefox)
1. Navigate to the `extension/` directory.
2. Delete the existing `manifest.json`.
3. Rename `manifest-firefox.json` to `manifest.json`.
4. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
5. Click "Load Temporary Add-on..." and select the `manifest.json` file.
6. **Important for Firefox**: Ensure you grant the extension permissions when prompted, or right-click the extension icon and select "Always allow on this site" if needed.

## Testing

Visit your frontend URL:
- `/movie/1653208` (resolves via GitHub catalog)
- `/movie/550` (triggers fallback and extension resolution)
- `/tv/1628448/1/2` (resolves via GitHub catalog)

Ensure the extension is active for fallback to work.

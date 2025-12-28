const apiBase = import.meta.env.VITE_API_URL;
if (!apiBase && import.meta.env.PROD) {
  throw new Error('Missing VITE_API_URL in production build');
}

export const BUILD = {
  sha: import.meta.env.VITE_BUILD_SHA || 'dev',
  api: apiBase || '(missing)',
};

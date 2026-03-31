/**
 * Central API base URL for frontend requests.
 *
 * In local development, prefer the Vite proxy so the app talks to the
 * local FastAPI server on http://localhost:8000 via /api.
 * In production, fall back to the deployed API unless explicitly overridden.
 */

const API_BASE = import.meta.env.VITE_API_BASE
  || (import.meta.env.DEV ? '/api' : 'https://alget.onrender.com/api')

export default API_BASE

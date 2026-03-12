/**
 * API Configuration - Central API base URL for all frontend components
 */

// Use environment variable or default to Render URL in production
const API_BASE = import.meta.env.VITE_API_BASE || 'https://alget.onrender.com/api'

// For local development, use '/api' which hits the Vite proxy
// For production, use the full Render URL
export default API_BASE

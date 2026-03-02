const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.REACT_APP_API_URL) {
  console.error('[config] REACT_APP_API_URL is not set. API calls will fail. Set it in the Vercel dashboard to your backend URL (e.g. https://your-backend.onrender.com/api) or /api for same-origin deployments.');
}

// Use relative "/api" when the frontend and backend share the same Vercel domain.
// Override with a full URL (e.g. https://api.example.com/api) for split deployments.
export const API_URL = process.env.REACT_APP_API_URL || (isProd ? '/api' : 'http://localhost:3000/api');
export const APP_ENV = process.env.NODE_ENV || 'development';

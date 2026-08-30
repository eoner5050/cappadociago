// Backward-compatible endpoint. The actual handler is secured and lives in /api/admin/tours.
export { POST } from './admin/tours';
export const prerender = false;

import { handleAPI } from '../../../../lib/server-api';
export const dynamic = 'force-dynamic';
// Vercel: room for source retrieval plus Sarvam synthesis in background runs.
export const maxDuration = 60;
export const GET = handleAPI;
export const POST = handleAPI;
export const DELETE = handleAPI;

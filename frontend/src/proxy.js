import { NextResponse } from 'next/server';

// Service-to-service calls use this key instead of JWT
// Must match INTERNAL_API_KEY in .env.local
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'sadaksurksha_internal_ml_service_2026';

export function proxy(request) {
    const { pathname } = request.nextUrl;

    // ── 1. Fully public paths — no auth required ──────────────────────────────
    const publicPaths = [
        '/login',
        '/landing',
        '/_next/',
        '/favicon.ico',
        '/api/auth/login',
        '/api/auth/register',
        '/uploads/',
        '/api/v1/cost/clusters',
    ];
    if (publicPaths.some((p) => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    // ── 2. All other API routes — require Bearer JWT (or Internal Key) ────────
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
        // Skip auth check for preflight requests
        if (request.method === 'OPTIONS') {
            return NextResponse.next();
        }
    
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log(`[Middleware] Rejecting ${request.method} ${pathname} - Missing Bearer Token`, { 
                headers: Object.fromEntries(request.headers),
                url: request.url 
            });
            return NextResponse.json(
                { error: 'Unauthorized. A valid Bearer token is required.' },
                { status: 401 }
            );
        }

        const token = authHeader.replace('Bearer ', '').trim();

        // Check if it is the INTERNAL service key
        // Service-to-service calls (like Python AI) use the INTERNAL_API_KEY
        // as their Bearer token.
        if (INTERNAL_API_KEY && token === INTERNAL_API_KEY) {
            console.log(`[Middleware] Auth Success! Internal service key used for ${pathname}`);
            return NextResponse.next();
        }

        // If it's not the internal key, we assume it's a valid JWT for this hackathon
        // (In a real app, JWT signature verification would happen here)
        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

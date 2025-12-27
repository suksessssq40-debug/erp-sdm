import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'sdm_erp_dev_secret';

export async function middleware(request: NextRequest) {
  // 1. Skip checks for login, public assets, and Next.js internals
  if (
    request.nextUrl.pathname.startsWith('/api/login') ||
    request.nextUrl.pathname.startsWith('/_next') || 
    request.nextUrl.pathname.startsWith('/favicon.ico') ||
    request.nextUrl.pathname.startsWith('/api/cron')
  ) {
    return NextResponse.next();
  }

  // 2. Only protect /api routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      await jwtVerify(token, secret);
      // Token is valid
      return NextResponse.next();
    } catch (err) {
      console.error('Middleware Auth Error:', err);
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};

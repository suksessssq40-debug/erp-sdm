
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function HEAD() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Date': new Date().toUTCString(),
        },
    });
}

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        timestamp: Date.now(),
        serverTime: new Date().toISOString()
    });
}

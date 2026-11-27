import { NextResponse } from 'next/server';
import { checkApiKey, listMessages } from 'lib/whatsapp';

export const dynamic = 'force-dynamic';

// GET recent incoming messages. Header: Authorization: Bearer <WHATSAPP_API_KEY>
export async function GET(request) {
    if (!checkApiKey(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const limit = Math.min(Number(new URL(request.url).searchParams.get('limit')) || 50, 200);
    try {
        return NextResponse.json({ messages: await listMessages(limit) });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { checkApiKey, sendTemplate, sendText } from 'lib/whatsapp';

export const dynamic = 'force-dynamic';

// POST { to: "9725XXXXXXXX", text: "שלום" }
// or   { to: "9725XXXXXXXX", template: "hello_world", language: "en_US" }
// Header: Authorization: Bearer <WHATSAPP_API_KEY>
export async function POST(request) {
    if (!checkApiKey(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
    }
    const to = String(body?.to || '').replace(/\D/g, '');
    if (!to) return NextResponse.json({ error: '"to" is required (international format, digits only)' }, { status: 400 });

    try {
        let result;
        if (body.template) {
            result = await sendTemplate(to, body.template, body.language || 'he', body.components);
        } else if (body.text) {
            result = await sendText(to, String(body.text));
        } else {
            return NextResponse.json({ error: 'Provide "text" or "template"' }, { status: 400 });
        }
        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ error: e.message, details: e.details }, { status: e.status || 500 });
    }
}

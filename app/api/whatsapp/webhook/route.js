import { NextResponse } from 'next/server';
import { markAsRead, parseWebhook, saveMessage, sendText, verifySignature, whatsappConfig } from 'lib/whatsapp';

export const dynamic = 'force-dynamic';

// Meta calls this once when you register the webhook URL.
export async function GET(request) {
    const params = new URL(request.url).searchParams;
    const { verifyToken } = whatsappConfig();
    if (verifyToken && params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === verifyToken) {
        return new Response(params.get('hub.challenge') || '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
}

// Incoming messages and delivery statuses.
export async function POST(request) {
    const rawBody = await request.text();
    const { appSecret, autoReply } = whatsappConfig();

    if (!verifySignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) {
        return new Response('Invalid signature', { status: 401 });
    }

    let payload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return new Response('Bad JSON', { status: 400 });
    }

    const { messages, statuses } = parseWebhook(payload);

    for (const msg of messages) {
        console.log(`WhatsApp message from ${msg.from} (${msg.name || 'unknown'}): ${msg.text ?? `[${msg.type}]`}`);
        await saveMessage(msg);
        try {
            await markAsRead(msg.id);
            if (autoReply) await sendText(msg.from, autoReply);
        } catch (e) {
            console.error('WhatsApp reply failed:', e.message);
        }
    }
    for (const s of statuses) {
        console.log(`WhatsApp status ${s.status} for message ${s.id} to ${s.recipient_id}`);
    }

    // Always ack quickly with 200, otherwise Meta retries.
    return NextResponse.json({ received: true });
}

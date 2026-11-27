import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';

export function whatsappConfig() {
    return {
        token: process.env.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
        appSecret: process.env.WHATSAPP_APP_SECRET,
        apiKey: process.env.WHATSAPP_API_KEY,
        autoReply: process.env.WHATSAPP_AUTO_REPLY
    };
}

/** Verify Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifySignature(rawBody, signatureHeader, appSecret) {
    if (!appSecret) return true; // signature check disabled when no secret is configured
    if (!signatureHeader?.startsWith('sha256=')) return false;
    const expected = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
    const received = signatureHeader.slice('sha256='.length);
    if (received.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
}

/** Constant-time comparison for the internal API key. */
export function checkApiKey(request) {
    const { apiKey } = whatsappConfig();
    if (!apiKey) return false;
    const header = request.headers.get('authorization') || '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
    const a = Buffer.from(provided);
    const b = Buffer.from(apiKey);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function graphPost(body) {
    const { token, phoneNumberId } = whatsappConfig();
    if (!token || !phoneNumberId) {
        throw new Error('WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be set');
    }
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...body })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data?.error?.message || `WhatsApp API error ${res.status}`);
        err.status = res.status;
        err.details = data;
        throw err;
    }
    return data;
}

/** Send a free-form text message (only allowed within 24h of the user's last message). */
export function sendText(to, text) {
    return graphPost({ recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: text } });
}

/** Send a pre-approved template message (required to start a conversation). */
export function sendTemplate(to, name, languageCode = 'he', components) {
    return graphPost({
        to,
        type: 'template',
        template: { name, language: { code: languageCode }, ...(components ? { components } : {}) }
    });
}

export function markAsRead(messageId) {
    return graphPost({ status: 'read', message_id: messageId });
}

function store() {
    return getStore({ name: 'whatsapp-messages', consistency: 'strong' });
}

export async function saveMessage(message) {
    try {
        const key = `${message.timestamp || Date.now()}-${message.id}`;
        await store().setJSON(key, message);
    } catch (e) {
        console.error('Failed to store WhatsApp message (Netlify Blobs unavailable?)', e.message);
    }
}

export async function listMessages(limit = 50) {
    const { blobs } = await store().list();
    const keys = blobs.map((b) => b.key).sort().reverse().slice(0, limit);
    return Promise.all(keys.map((key) => store().get(key, { type: 'json' })));
}

/** Flatten a webhook payload into a list of incoming messages and status updates. */
export function parseWebhook(payload) {
    const messages = [];
    const statuses = [];
    for (const entry of payload?.entry || []) {
        for (const change of entry.changes || []) {
            const value = change.value || {};
            const contacts = value.contacts || [];
            for (const m of value.messages || []) {
                const contact = contacts.find((c) => c.wa_id === m.from);
                messages.push({
                    id: m.id,
                    from: m.from,
                    name: contact?.profile?.name,
                    timestamp: m.timestamp,
                    type: m.type,
                    text: m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null,
                    raw: m
                });
            }
            for (const s of value.statuses || []) statuses.push(s);
        }
    }
    return { messages, statuses };
}

# חיבור ל-WhatsApp Business Cloud API

האתר כולל שלושה endpoints:

| נתיב | שיטה | תפקיד |
|---|---|---|
| `/api/whatsapp/webhook` | GET | אימות ה-webhook מול Meta |
| `/api/whatsapp/webhook` | POST | קבלת הודעות נכנסות וסטטוסים (נשמרות ב-Netlify Blobs) |
| `/api/whatsapp/send` | POST | שליחת הודעה (מוגן ב-`WHATSAPP_API_KEY`) |
| `/api/whatsapp/messages` | GET | צפייה בהודעות שהתקבלו (מוגן ב-`WHATSAPP_API_KEY`) |

## שלב 1 — הקמה ב-Meta
1. היכנס/י ל-https://developers.facebook.com → **My Apps** → **Create App** → סוג **Business**.
2. הוסף/י לאפליקציה את המוצר **WhatsApp** ובחר/י (או צור/י) חשבון Meta Business.
3. בעמוד **WhatsApp → API Setup** תקבל/י:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Temporary access token** (תקף 24 שעות; לטווח ארוך צור/י System User token ב-Business Settings עם ההרשאות `whatsapp_business_messaging`, `whatsapp_business_management`) → `WHATSAPP_ACCESS_TOKEN`
4. הוסף/י את מספר הטלפון שלך כנמען בדיקה ב-"To".
5. **App settings → Basic → App secret** → `WHATSAPP_APP_SECRET`.

## שלב 2 — משתני סביבה ב-Netlify
Site configuration → Environment variables, הגדר/י את כל המשתנים מ-`.env.example`.
ל-`WHATSAPP_VERIFY_TOKEN` ול-`WHATSAPP_API_KEY` המציאו מחרוזות אקראיות, לדוגמה:
```
openssl rand -hex 24
```
פרסמו מחדש (Deploy) אחרי ההגדרה.

## שלב 3 — רישום ה-Webhook
ב-**WhatsApp → Configuration → Webhook → Edit**:
- Callback URL: `https://<האתר-שלך>.netlify.app/api/whatsapp/webhook`
- Verify token: הערך של `WHATSAPP_VERIFY_TOKEN`
- לחץ/י **Verify and save**, ואז ב-Webhook fields סמנו **messages** → Subscribe.

## שלב 4 — בדיקה
שליחת הודעת תבנית (חובה לפתיחת שיחה חדשה):
```bash
curl -X POST https://<האתר-שלך>.netlify.app/api/whatsapp/send \
  -H "Authorization: Bearer $WHATSAPP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to":"9725XXXXXXXX","template":"hello_world","language":"en_US"}'
```
אחרי שהנמען ענה, אפשר לשלוח טקסט חופשי במשך 24 שעות:
```bash
curl -X POST https://<האתר-שלך>.netlify.app/api/whatsapp/send \
  -H "Authorization: Bearer $WHATSAPP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to":"9725XXXXXXXX","text":"שלום!"}'
```
צפייה בהודעות שהתקבלו:
```bash
curl https://<האתר-שלך>.netlify.app/api/whatsapp/messages \
  -H "Authorization: Bearer $WHATSAPP_API_KEY"
```
מספרים בפורמט בינלאומי, ספרות בלבד (972 במקום 0).

אופציונלי: `WHATSAPP_AUTO_REPLY` — טקסט שיישלח אוטומטית כתשובה לכל הודעה נכנסת.

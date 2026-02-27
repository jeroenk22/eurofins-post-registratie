# eurofins-post-registratie

Mobile-first PWA voor het registreren van post bij de stelling. Medewerkers scannen een QR-code en krijgen een formulier in de Eurofins/Miedema huisstijl.

## Stack
- React 18 + TypeScript
- Vite 5 + vite-plugin-pwa
- Tailwind CSS 3 (utility-first, geen losse CSS bestanden)

## Snel starten
```bash
npm install
npm run dev -- --host
```

## Bouwen
```bash
npm run build
# deploy dist/ naar Netlify
```

## Huisstijlkleuren (tailwind.config.js)
| Token            | Kleur     | Gebruik          |
|------------------|-----------|------------------|
| `ef-blue`        | #003883   | Eurofins donkerblauw |
| `ef-orange`      | #ff7b27   | Eurofins oranje / spoed |
| `mi-green`       | #1a5c2a   | Miedema groen    |
| `mi-yellow`      | #f5c800   | Miedema geel     |

## Webhook payload
```json
{
  "submitted_at": "2026-02-25T14:30:00.000Z",
  "datetime_nl": "25-2-2026 15:30:00",
  "shelf": "Schap 3",
  "sender_name": "Sophie Jansen",
  "sender_phone": "06 12345678",
  "sender_email": "sophie@eurofins.com",
  "total_entries": 1,
  "entries": [{
    "entry_number": 1,
    "recipient": "Acme B.V.",
    "colli": 3,
    "spoed": true,
    "photo_count": 1,
    "photos": [{ "filename": "foto.jpg", "base64": "data:image/jpeg;base64,..." }]
  }]
}
```

## Make.com — e-mailbevestiging aan invoerder
Voeg in je scenario een **Email** module toe (na de webhook trigger):
- **To**: `{{sender_email}}` (check eerst op leeg met een filter)
- **Subject**: `Bevestiging post registratie - Schap {{shelf}}`
- **Body**: lijst de entries op, voeg foto's als bijlage toe via Google Drive links

## Logos
Zet in `public/`:
- `eurofins_agro.svg` ✓ (meegeleverd)
- `miedema_logo.png` ✓ (meegeleverd)
- `pwa-192x192.png` en `pwa-512x512.png` — zelf genereren via pwabuilder.com

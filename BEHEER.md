# Beheer: Post aanmelden (Eurofins / Miedema)

Voor wie deze app technisch overneemt. Hier staat waar alles draait, welke geheimen er zijn, wat periodiek onderhoud vraagt en waar je kijkt als iets niet werkt. De handleiding voor de beheerder van de toegangs-sheet (een leek) komt apart.

> **Stand:** 5 oktober 2026. De IP-guard staat op `meten`: hij registreert netwerken, maar blokkeert nog niets. Zie [Toegang tot de app](#toegang-tot-de-app).

---

## In één oogopslag

- **App:** https://post-aanmelden.netlify.app. Een React-PWA waarmee het lab post aanmeldt: ontvanger kiezen, colli, foto's, labels printen.
- **Na verzenden:**
  1. `forward-webhook` maakt de orders in **Mendrix**, via de zusterrepo `eurofins-post-registratie-create-mendrix-order`.
  2. `naar-make` geeft de aanmelding door aan **Make**.
  3. Make zet de foto's in Google Drive, plaatst een bericht in Slack, schrijft een regel in het orderlog (Google Sheet) en stuurt de bevestigingsmail.
- **Namenlijst** (monsternemers, AP06, mestklanten): komt uit een **privé** Google Sheet, gelezen via een service account.
- **Printlinks en foto's in mails en Slack:** gaan via de app (`?s=<code>` en `?fotos=<code>`). Er staan geen persoonsgegevens in de link. De gegevens blijven **30 dagen** op de server staan.

---

## Accounts en eigenaars

Zet de inloggegevens van elk account, **inclusief tweestapsverificatie en back-upcodes**, in de wachtwoordkluis van de organisatie. Zorg dat bij elk platform minstens **twee** mensen beheerder zijn.

| Wat | Waar | Eigenaar / login | Let op |
|---|---|---|---|
| Hosting, functies, opslag (Blobs) | Netlify, project **post-aanmelden**, team *Miedema Ophaaldienst B.V.* | Nu jeroenkrajenbrink@gmail.com | Voeg een tweede teamlid als Owner toe |
| Code | GitHub **jeroenk22/eurofins-post-registratie** | Persoonlijk account jeroenk22 | Overdragen aan een organisatie, of een collega als admin toevoegen. Netlify deployt vanaf deze repo |
| Namenlijst | Google Sheet "Monsternemers en mestklanten Eurofins" | miedema.eurofins.01@gmail.com | Algemene toegang **Beperkt**. Service account = **Kijker** |
| Toegangslijst | Google Sheet **"Post-app toegang"**, tabblad `Netwerken` | miedema.eurofins.01@gmail.com | Service account = **Bewerker** |
| Orderlog | Google Sheet "Postaanmeldingen Eurofins log" (map *Eurofins post aanmelden app*) | miedema.eurofins.01@gmail.com | Make schrijft hier |
| Foto-archief | Drive: *Eurofins / Post aanmeldingen Wageningen* (+ `DEVELOPMENT`) | miedema.eurofins.01@gmail.com | **Beperkt**. Collega's zijn met naam toegevoegd als Kijker (zonder mail) |
| Service account | Google Cloud-project **post-app-510410** | `post-app-sheets@post-app-510410.iam.gserviceaccount.com` | De sleutel verloopt niet. Het JSON-bestand hoort in de wachtwoordkluis |
| Automatisering | Make, org *Miedema Ophaaldienst B.V.*, team *Automatisering* (eu2) | — | Scenario's: zie hieronder |
| Meldingen | Slack, kanaal `eurofins-post-aanmeldingen` | — | |
| Google-account van de organisatie | miedema.eurofins.01@gmail.com | — | Gewone Gmail, **geen** Workspace. Herstelmail: automatisering@ophaaldienstmiedema.nl |

---

## Geheimen en instellingen (Netlify → Environment variables)

Alles met een slotje is een *secret*: na het opslaan kun je de waarde niet meer teruglezen. Bewaar daarom ook een kopie in de wachtwoordkluis. **Een wijziging werkt pas na een nieuwe deploy** (Deploys → Trigger deploy).

| Variabele | Waarvoor | Hoe vervangen |
|---|---|---|
| `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY` 🔒 | Service account voor de sheets | In Google Cloud een nieuwe JSON-sleutel maken, de `client_email` en `private_key` hier plakken (letterlijke `\n` mag), deployen, en daarna de oude sleutel verwijderen in Cloud |
| `GOOGLE_SHEETS_ID` | ID van de namen-sheet | — |
| `GOOGLE_TOEGANG_SHEET_ID` | ID van "Post-app toegang" | — |
| `MAKE_WEBHOOK_URL` 🔒 | Make-webhook "Eurofins post aanmeldingen - PRODUCTION v2" | Zie [Make-webhook vervangen](#make-webhook-vervangen) |
| `MAKE_WEBHOOK_KEY` 🔒 | API-sleutel op die webhook (header `x-make-apikey`) | Eerst hier zetten en deployen, daarna in Make |
| `DAGOVERZICHT_WEBHOOK_URL`, `DAGOVERZICHT_WEBHOOK_KEY` 🔒 | Make-scenario "Eurofins Post dagoverzicht" | Op dezelfde manier |
| `NETLIFY_WEBHOOK_URL`, `NETLIFY_WEBHOOK_SECRET` 🔒 | `forward-webhook` → create-order (Mendrix), HMAC-ondertekend | Het secret moet gelijk zijn aan dat in de zusterrepo |
| `VITE_APP_URL` | Basis-URL voor de QR-code naar de telefoon | Wordt in `netlify.toml` gezet |

Lokaal draaien: gebruik **`netlify dev`** (poort 8888), niet `npm run dev`. Anders werken de functies niet. `netlify dev` haalt de variabelen van de context *Local development* zelf op.

---

## Wat verloopt (agenda!)

| Wat | Wanneer | Gevolg als het verloopt | Herstellen |
|---|---|---|---|
| Make-koppeling **Gmail** "miedema.eurofins.01@gmail.com email" | Elke 6 maanden. Volgende keer **24-03-2027** | Bevestigingsmail en dagoverzicht stoppen, **zonder melding** | Make → Credentials → Connections → Reauthorize → inloggen als miedema.eurofins.01 → Verify |
| Make-koppeling **Drive** "Eurofins Drive" (Google Restricted) | Elke ~6 maanden. Volgende keer rond **02-04-2027** | Foto's komen niet meer in Drive. De app toont ze nog wel 30 dagen | Op dezelfde manier |

Dit verloopt omdat Google gewone @gmail.com-accounts maar 6 maanden toegang geeft. De blijvende oplossing is mailen vanaf een Microsoft 365-mailbox van ophaaldienstmiedema.nl. Daarvoor is een mailbox en toestemming van de systeembeheerder nodig; dat is aangevraagd. Het service account en de API-sleutels verlopen **niet**.

---

## Toegang tot de app

De edge function `netlify/edge-functions/ip-guard.ts` draait voor elke request. De stand staat in `netlify/allowed-ips.ts` → `FILTER_MODE`:

| Stand | Gedrag |
|---|---|
| `uit` | Niets registreren, niets blokkeren |
| `meten` (**huidig**) | Registreert per dag het netwerk (IPv4, of IPv6 als /64) dat een beschermd eindpunt aanroept. Blokkeert niets |
| `aan` | Registreert, en geeft **403** op beschermde eindpunten voor netwerken die niet zijn toegestaan |

- **Beschermde eindpunten** (`netlify/beschermde-paden.ts`): `sheets`, `forward-webhook`, `dagoverzicht`, `naar-make` en `aanmelding`.
- **Altijd open:** de app zelf, de telefoonflow (`?mobile=` + `session`), `order-ids`, `time` en de logo's in de mail.

**Toegestane netwerken**
- De beheerder zet in de sheet **"Post-app toegang"** bij een netwerk **"ja"** in de kolom Toegestaan.
- `sync-toegang` draait elke 10 minuten en doet drie dingen:
  - nieuwe netwerken als rij in de sheet zetten;
  - de kolom **Herkomst** invullen (RDAP via rdap.arin.net);
  - de "ja"-lijst naar Netlify Blobs schrijven, waar ip-guard hem leest (60 s cache).
- `ALLOWED_IPS` in `allowed-ips.ts` is een vast vangnet dat **altijd** toegang heeft. Nu is dat alleen de RDP-server van Miedema (195.222.119.185).

**Bekende patronen**
- **Amazon-adressen (VS)** zijn de screenshot-robot van Netlify: één per deploy. Die krijgen **nooit** "ja".
- **Zscaler (147.161.x.x)** zijn Eurofins-laptops achter een bedrijfsproxy. Het adres wisselt en wordt gedeeld met andere Zscaler-klanten. Een "ja" bij zo'n adres geeft dus ook andere bedrijven toegang. Hoe we daarmee omgaan, wordt besloten na de meting (oktober 2026): filter aan, en/of een login met code via de werkmail.

---

## Make

| Scenario | Trigger | Doet |
|---|---|---|
| **Eurofins Post aanmeldingen** (productie) | Webhook "PRODUCTION v2", met API-sleutel | Drive-mappen en uploads, Slack per zending, orderlog, bevestigingsmail |
| Eurofins Post aanmeldingen - DEVELOPMENT | Eigen webhook | Testversie. Wijkt af van productie: geen logmodules |
| Eurofins Post dagoverzicht | Eigen webhook, met sleutel | Verstuurt de dagoverzicht-mail. De HTML maakt de functie `dagoverzicht` |

**Valkuilen**
- **Na "Import Blueprint" zet Make de planning soms om naar een schema.** Aanmeldingen blijven dan in de wachtrij staan. Zet daarna altijd **Run scenario → Immediately as data arrives** en klik **Save**.
- **Deploy-previews gebruiken hetzelfde productiescenario.** Een test op een preview maakt dus echte orders in Mendrix, en ook mails, Slack-berichten en logregels.
- **Exports van de blueprints** staan in `blueprints/` (niet gecommit). Maak vóór elke wijziging in Make een export als back-up.
- **De orderlog-kolommen met tekst** krijgen een `'` vooraan, zodat Sheets ze nooit als formule uitvoert. Colli niet: dat is altijd een getal, en de server dwingt dat af.

### Make-webhook vervangen
Doe dit als het adres uitgelekt is of als de sleutel vervangen moet:
1. Make → **Webhooks → Add** (Custom webhook, zonder data structure en zonder IP-restrictie) en kopieer het adres.
2. Netlify: zet `MAKE_WEBHOOK_URL` (en eventueel `MAKE_WEBHOOK_KEY`) op de nieuwe waarde in **alle** contexts → **Trigger deploy**.
3. Make: kies de nieuwe webhook in de eerste module van het scenario → **Save**. Wat intussen binnenkwam, wordt dan uit de wachtrij verwerkt.
4. Zet de API-sleutel op de nieuwe webhook (dezelfde waarde als `MAKE_WEBHOOK_KEY`), test één aanmelding, en zet daarna de oude webhook uit of verwijder hem.

---

## Gegevens en bewaartermijnen (AVG)

| Opslag (Netlify Blobs) | Inhoud | Termijn | Opgeruimd door |
|---|---|---|---|
| `mobile-sessions` | Telefoonsessie: namen + foto's | 2 dagen na laatste wijziging | `opruimen` (dagelijks) |
| `order-ids` | Mendrix order-ID's per aanmelding | 30 dagen | `opruimen` |
| `aanmeldingen` | Labels (printlink) en foto's per zending | 30 dagen | `opruimen` |
| `netwerken` | Registraties van netwerken (wachtrij) | Tot de volgende sync | `sync-toegang` |
| `toegang` | De "ja"-lijst | Doorlopend | `sync-toegang` |

In de toegangs-sheet worden rijen **zonder "ja"** na 60 dagen niet-gezien verwijderd. Rijen met "ja" blijven staan.

Nog te regelen met de privacy officer (FG) van Eurofins:
- de opname in het verwerkingsregister;
- de verwerkersovereenkomsten (Netlify, Make, Google);
- de grondslag.

---

## Als iets niet werkt

| Klacht | Kijk eerst |
|---|---|
| Geen bevestigingsmail | Make → scenario → **History**. Rood: open de run. Staat er niets: de wachtrij ("Show queue") en de planning (*Immediately*?). Daarna de Gmail-koppeling (verlopen?) |
| "Verzenden naar Make mislukt (HTTP …)" | Netlify → Logs → Functions → `naar-make`. **401/403:** de API-sleutel in Make en `MAKE_WEBHOOK_KEY` verschillen. **503:** `MAKE_WEBHOOK_URL` ontbreekt. De orders bestaan dan al; de app biedt "opnieuw proberen" |
| Geen namen in het ontvangersveld | Logs van `sheets`. Is de namen-sheet nog gedeeld met het service account? Zijn `GOOGLE_SA_*` gezet? |
| "Deze link werkt alleen vanaf een goedgekeurd netwerk" | Alleen in stand `aan`. Het netwerk staat in "Post-app toegang"; de beheerder zet er "ja" bij, en binnen 10 minuten werkt het |
| Label zonder QR-code | De order is niet aangemaakt in Mendrix. Kijk in de logs van `forward-webhook` en in de zusterrepo |
| Foto's niet in Drive | De Drive-koppeling in Make (verlopen?) en de History van het scenario |
| Toegangs-sheet wordt niet bijgewerkt | Logs van `sync-toegang`. Is de sheet nog gedeeld met het service account als Bewerker? Bestaat het tabblad `Netwerken` nog met die exacte naam? |

Controleren vanaf de terminal (Netlify CLI, ingelogd):
```bash
npx netlify blobs:list netwerken        # registraties die nog verwerkt moeten worden
npx netlify blobs:get toegang lijst     # de huidige "ja"-lijst
npx netlify env:list --context production
```

---

## Werkwijze bij wijzigingen

- Werk op een branch en open een PR. Netlify maakt een **deploy-preview** (`deploy-preview-<nr>--post-aanmelden.netlify.app`); het lab test daar.
- `npm test`, `npx tsc -b`, `npx vite build`. ESLint is niet ingericht.
- Elk `.ts`-bestand in `netlify/edge-functions/` wordt een edge function. Zet helpers daarom in `netlify/`.
- Geplande functies (`opruimen`, `sync-toegang`) draaien **alleen op productie**, niet op previews.

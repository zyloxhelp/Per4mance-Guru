# Lead capture — setup

Every form on the site now routes through [`/assets/lead-capture.js`](assets/lead-capture.js).
Both destinations are configured in the `CONFIG` block at the top of that **one** file.

Until the two placeholders below are replaced, those destinations are skipped — the
script detects `__PLACEHOLDER__` values and treats them as "not live".

---

## Step 1 — Web3Forms (email to two inboxes)

Leads go to **both** `hello@per4mance.guru` (primary, business inbox) and
`zyloxhelp@gmail.com` (backup). A Web3Forms access key is tied to a single verified
destination, so each inbox needs its own key. The script submits to both and treats
the email as delivered if *either* one accepts it — one spam filter cannot swallow a
lead on its own.

`zyloxhelp@gmail.com` is already configured. To add the business inbox:

1. Go to <https://web3forms.com>.
2. Enter **hello@per4mance.guru** and press *Create Access Key*.
3. Open that mailbox in Zoho and click the verification link. **Skipping this is the
   #1 reason these services "don't work" — nothing is delivered until the address is
   verified.**
4. Copy the access key (looks like `a1b2c3d4-e5f6-...`).
5. In [`assets/lead-capture.js`](assets/lead-capture.js), replace
   `'__WEB3FORMS_KEY_HELLO__'` with it:

   ```js
   WEB3FORMS_KEYS: [
     'your-new-key-here',                    // hello@per4mance.guru (Zoho) — primary
     '20e24e23-ced6-4c8d-bb2f-7c8c998662d0'  // zyloxhelp@gmail.com — backup
   ],
   ```

Until that placeholder is replaced, only the Gmail inbox receives leads — the script
skips any key still holding a `__PLACEHOLDER__` value.

These are *public submission* keys and are safe in client-side code: a key only lets a
sender deliver mail to its own verified address, and reveals nothing about the inbox.
That is why Web3Forms was chosen over FormSubmit — FormSubmit's basic endpoint puts the
raw destination address in the HTML. (`hello@per4mance.guru` is already published in
1,748 `mailto:` links across 902 pages, but `zyloxhelp@gmail.com` appears nowhere, and
it stays that way.)

### Allowlist it in Zoho *before* testing
Zoho filters aggressively on mail that arrives from a third-party server carrying your
own domain in the reply-to — exactly this pattern. Do this first, or your first test
will "fail" for the wrong reason:

**Zoho Mail → Settings → Anti-Spam → Allowed list → add `web3forms.com`.**

For the Gmail backup, open the first mail, mark **Not spam**, then add a filter:
`from:(web3forms.com)` → *Never send to Spam*, label **Leads**, *Mark as important*.

---

## Step 2 — Google Sheet backup

The Sheet is what makes this safe: email can bounce or get filtered, but the Sheet
always holds the lead.

**Which Google account to use.** Apps Script needs a Google account, and
`hello@per4mance.guru` is a Zoho mailbox, not a Google account — it cannot own a Sheet
or deploy a script by itself. So: deploy under **any Google account that authorises
successfully**, then share the Sheet with `hello@per4mance.guru` so the business
address can read the leads (Step 2b). The site posts to the `/exec` URL anonymously and
never authenticates, so which account owns the script is invisible to visitors and has
no effect on how it works.

1. Create a new Google Sheet (any name) at <https://sheets.new>.
2. **Extensions → Apps Script**.
3. Delete the placeholder code and paste the script from
   [Appendix A](#appendix-a--apps-script) below.
4. **Deploy → New deployment → gear icon → Web app**
   - *Description*: `lead capture`
   - *Execute as*: **Me**
   - *Who has access*: **Anyone** ← required; "Anyone with Google account" will fail
5. Press *Deploy*, authorise when prompted (choose *Advanced → Go to project* if
   Google warns the app is unverified — it's your own script).
6. Copy the **Web app URL** (ends in `/exec`).
7. In [`assets/lead-capture.js`](assets/lead-capture.js), replace:

   ```js
   SHEET_ENDPOINT: '__SHEET_ENDPOINT__',
   ```

> Re-deploying after any script edit: use **Deploy → Manage deployments → edit →
> Version: New version**. Creating a brand-new deployment changes the URL.

---

## Step 2b — share the Sheet with the business address

1. Open the Sheet → **Share** (top right).
2. Add **hello@per4mance.guru** → role **Editor** → *Send*.

Google will warn that this address isn't a Google account. That's expected and fine —
sharing to a non-Google address still works; Zoho receives a link that opens the Sheet.
If you'd rather not deal with the prompt, use **Share → Copy link → "Anyone with the
link"** set to *Viewer* and keep that link private instead.

Two things this does **not** do, worth knowing:

- It shares the **Sheet**, not the **Apps Script project**. Editing the script later
  still requires signing in as the owning account.
- Ownership stays with the deploying account. If that account is ever lost, the lead
  archive goes with it. To move ownership later: **Share → the account → Transfer
  ownership** (only works between accounts in the same Workspace domain, so a permanent
  fix means recreating the Sheet under a company-owned Google account).

---

## Step 3 — publish

```bash
git add assets/lead-capture.js
git commit -m "Route lead forms to email + sheet"
git push
```

GitHub Pages redeploys in about a minute. Hard-refresh (`Ctrl+F5`) before testing,
since the old inline script may still be cached.

---

## What changed in the pages

- **836 audit-form pages** — the inline handler that posted straight to GoHighLevel was
  replaced by a one-line `window.PG_LEAD_SOURCE = '<page-slug>'` plus a shared script
  tag. The per-page source label is preserved, so you still see which locality a lead
  came from.
- **contact.html** — had *two* submit handlers bound to the same form, so it fired
  twice and two different success panels fought each other. Now one handler.
- **index.html** — the popup used `.finally()`, showing "You're all set!" even when the
  request failed outright.
- **performance-marketing-agency-{delhi,ludhiana,mumbai}.html** — used
  `fetch(..., {mode:'no-cors'})`. That silently downgrades `Content-Type` to
  `text/plain`, so GoHighLevel very likely never parsed those payloads, and the opaque
  response made the failure invisible. The comment claiming GHL sends no CORS headers
  was wrong — it returns `Access-Control-Allow-Origin: *`.

Each form keeps the CRM destination it always had — audit forms still post to
GoHighLevel, contact.html still posts to Make.com — so if those accounts are alive
nothing is lost. They just no longer decide whether the visitor sees a success screen.

---

## Still outstanding

**1. Neither Web3Forms key is verified from my end.** Cloudflare's bot challenge blocks
scripted requests to `api.web3forms.com`, so the key could only be wired in, not
proven. A real browser passes that challenge normally. Confirm it yourself with the
browser test below — if the key or the address verification is wrong, you'll now see
the WhatsApp error instead of a false success, which is the point.

**2. contact.html still has a dead script block.** Lines ~1200-1330 contain raw CSS
(`@keyframes spin { … }`) *inside* a `<script>` tag — a syntax error that kills the
whole block at parse time. Dead as a result: the custom cursor, the navbar scroll
effect, and the budget-slider value display. This predates these changes and is
untouched, because reviving it would re-activate a second `.chip` click binding and
break the service chips (each click would toggle twice). Fixing it properly means
moving the keyframes into a `<style>` tag *and* deleting the duplicate chip binding —
say the word and it's a two-minute job.

---

## Testing it in a browser

```powershell
python -m http.server 8000 --directory d:\Per4manceGuruPage
```

Open <http://localhost:8000/cities/digital-marketing-agency-adyar.html>, press F12 for
the console, scroll to the audit form and submit it.

- **"You're in."** → the lead was genuinely stored. Check zyloxhelp@gmail.com,
  including Spam.
- **Red WhatsApp error** → nothing was stored. The console Network tab shows which
  destination refused: a `401`/`success:false` from `api.web3forms.com` means the key
  is wrong or the address was never verified.

The old code could only ever show the first outcome, which is exactly why the failure
went unnoticed.

---

## Appendix A — Apps Script

```javascript
/**
 * Per4mance Guru — lead capture backup.
 * Appends every submission to the sheet.
 *
 * Deliberately does NOT send email. MailApp.sendEmail requires the
 * script.send_mail scope, which Google treats as sensitive and blocks
 * ("This app is blocked") on managed/restricted accounts. Email is
 * Web3Forms' job; this script only needs to touch its own spreadsheet.
 */

const SHEET_NAME = 'Leads';

function doPost(e) {
  // Serialise writes so two submissions in the same second can't clobber a row.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const sheet = getSheet_();

    // Header row grows automatically when a form sends a new field.
    let headers = sheet.getLastColumn()
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].filter(String)
      : [];

    if (!headers.length) {
      headers = ['received_at'];
      sheet.getRange(1, 1, 1, 1).setValues([headers]);
    }

    Object.keys(data).forEach(function (key) {
      if (headers.indexOf(key) === -1) {
        headers.push(key);
        sheet.getRange(1, headers.length).setValue(key);
      }
    });

    const row = headers.map(function (h) {
      if (h === 'received_at') return new Date();
      return data[h] !== undefined ? data[h] : '';
    });
    sheet.appendRow(row);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

// Lets you confirm the deployment in a browser: opening the /exec URL shows this.
function doGet() {
  return json_({ ok: true, message: 'Per4mance Guru lead endpoint is live.' });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Force the narrow scope

To be certain Google only ever asks for access to *this one sheet*, pin the scope
explicitly:

1. In the Apps Script editor: **⚙️ Project Settings** → tick
   **"Show 'appsscript.json' manifest file in editor"**.
2. Go back to **Editor**, open `appsscript.json`, and add the `oauthScopes` line:

```json
{
  "timeZone": "Asia/Kolkata",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": ["https://www.googleapis.com/auth/spreadsheets.currentonly"]
}
```

`spreadsheets.currentonly` grants access to the container spreadsheet and nothing
else — no Drive, no Gmail, no other files. It is not a sensitive scope, so the
"This app is blocked" screen does not apply to it.

Save, then **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** and
authorise again.

---

## Troubleshooting authorisation

**"This app is blocked — This app tried to access sensitive info in your Google Account"**

Google refused a *sensitive scope*. The only sensitive scope this script ever needed
was `script.send_mail` from `MailApp`, which is why it has been removed above. If you
already pasted the older version, replace it with the current one and redeploy.

If it still appears:

- **Check which account you're authorising.** The consent screen shows the account at
  the top. Work, school, or Workspace accounts frequently have an admin policy that
  blocks unverified apps entirely. Sign out of the others and use the personal
  `zyloxhelp@gmail.com` — a plain consumer Gmail account has no such policy.
- **Supervised (Family Link) accounts** cannot authorise Apps Script at all.
- **Advanced Protection Program** blocks it too — check
  <https://myaccount.google.com/security>.

**"Google hasn't verified this app"** is a *different*, harmless screen — that one you
clear with **Advanced → Go to (project) (unsafe) → Allow**. It appears for every
personal Apps Script project and does not mean anything is wrong.

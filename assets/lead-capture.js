/* ==========================================================================
   Per4mance Guru — lead capture
   --------------------------------------------------------------------------
   Every audit/contact form on the site routes through this one file.
   Change a destination here and all ~836 pages pick it up.

   A lead is sent to three places:
     1. Email       -> Web3Forms  (primary notification)
     2. Google Sheet-> Apps Script (permanent record, survives spam filters)
     3. Legacy CRM  -> GoHighLevel / Make webhooks (fire-and-forget)

   Success is shown ONLY when the lead is actually stored somewhere.
   If email AND sheet both fail, the visitor sees an error with the
   WhatsApp number instead of a fake "You're in." screen.
   ========================================================================== */
(function (w, d) {
  'use strict';

  /* ---- CONFIG — the only two values you need to fill in ---------------- */
  var CONFIG = {
    /* Email. A Web3Forms access key is tied to ONE destination address, so
       there is one key per inbox. Every lead is sent to all of them, and the
       email counts as delivered if any single one succeeds — two independent
       inboxes means one spam filter can't swallow a lead on its own. */
    WEB3FORMS_KEYS: [
      'befa2fd5-391d-4532-902f-5aeb9c1700b0',              // hello@per4mance.guru (Zoho) — primary
      '20e24e23-ced6-4c8d-bb2f-7c8c998662d0'  // zyloxhelp@gmail.com — backup
    ],

    // Apps Script -> Deploy -> Web app -> copy the /exec URL
    SHEET_ENDPOINT: '__SHEET_ENDPOINT__',

    // Existing CRM hooks. Kept alive; never gate the success screen on them.
    LEGACY: [
      'https://services.leadconnectorhq.com/hooks/rTvy0ecU0xKjIm16OJbL/webhook-trigger/4f8583ca-eb8d-410d-b5c3-4412cf96d059'
    ],

    SUBJECT: 'New Lead — Per4mance Guru',
    WHATSAPP_TEXT: '+91 98110 96907',
    WHATSAPP_URL: 'https://wa.me/919811096907',
    TIMEOUT_MS: 12000
  };

  var UNSET = /^__.*__$/; // placeholder still in place -> destination not live

  /* ---- helpers --------------------------------------------------------- */

  // Reject after N ms so a hanging request can't leave the button on "Sending…"
  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('timeout')); }, ms);
      promise.then(
        function (v) { clearTimeout(timer); resolve(v); },
        function (e) { clearTimeout(timer); reject(e); }
      );
    });
  }

  /* One Web3Forms submission. Resolves true only on a real success response. */
  function sendEmailTo(key, data) {
    var payload = {
      access_key: key,
      subject: CONFIG.SUBJECT + ' — ' + (data.brand || data.name || data.source || 'website'),
      from_name: 'Per4mance Guru Website',
      replyto: data.email || ''
    };
    for (var k in data) {
      if (Object.prototype.hasOwnProperty.call(data, k)) payload[k] = data[k];
    }
    return withTimeout(
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json().catch(function () { return {}; }); })
        .then(function (json) { return json.success === true; }),
      CONFIG.TIMEOUT_MS
    ).catch(function () { return false; });
  }

  /* Email every configured inbox. True if at least one accepted the lead. */
  function sendEmail(data) {
    var keys = (CONFIG.WEB3FORMS_KEYS || []).filter(function (k) {
      return k && !UNSET.test(k);
    });
    if (!keys.length) return Promise.resolve(false);
    return Promise.all(keys.map(function (k) { return sendEmailTo(k, data); }))
      .then(function (oks) {
        return oks.indexOf(true) !== -1;
      });
  }

  /* Google Sheet via Apps Script.
     Sent as text/plain on purpose: that keeps it a "simple" request, so the
     browser skips the CORS preflight that Apps Script web apps don't answer.
     Apps Script reads the raw body with e.postData.contents. */
  function sendSheet(data) {
    if (!CONFIG.SHEET_ENDPOINT || UNSET.test(CONFIG.SHEET_ENDPOINT)) {
      return Promise.resolve(false);
    }
    return withTimeout(
      fetch(CONFIG.SHEET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data)
      }).then(function (res) { return res.ok; }),
      CONFIG.TIMEOUT_MS
    ).catch(function () { return false; });
  }

  /* Legacy CRM hooks — best effort, result ignored.
     `urls` lets a form keep the destination it always posted to (the audit
     forms went to GoHighLevel, contact.html to Make) instead of every lead
     being duplicated into both systems. */
  function sendLegacy(data, urls) {
    (urls || CONFIG.LEGACY).forEach(function (url) {
      try {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).catch(function () { /* never blocks the visitor */ });
      } catch (e) { /* ignore */ }
    });
  }

  /* Send one lead everywhere. Resolves {ok, email, sheet}.
     ok = stored in at least one durable place.
     opts.legacy: override the CRM hooks for this form. */
  function send(data, opts) {
    data.page = data.page || w.location.href;
    data.submitted_at = new Date().toISOString();
    sendLegacy(data, opts && opts.legacy);
    return Promise.all([sendEmail(data), sendSheet(data)]).then(function (r) {
      return { email: r[0], sheet: r[1], ok: r[0] || r[1] };
    });
  }

  /* ---- UI -------------------------------------------------------------- */

  function errorBox(form) {
    var el = d.getElementById('pgLeadError');
    if (el) return el;
    el = d.createElement('div');
    el.id = 'pgLeadError';
    el.setAttribute('role', 'alert');
    el.style.cssText =
      'display:none;margin-top:.85rem;padding:.8rem .9rem;border-radius:6px;' +
      'background:rgba(232,84,58,.12);border:1px solid rgba(232,84,58,.45);' +
      'color:#ffb4a2;font-size:.82rem;line-height:1.55;';
    el.innerHTML =
      "We couldn't submit that — please WhatsApp us at " +
      '<a href="' + CONFIG.WHATSAPP_URL + '" target="_blank" rel="noopener" ' +
      'style="color:#fff;font-weight:700;text-decoration:underline;">' +
      CONFIG.WHATSAPP_TEXT + '</a> and we\'ll pick it up right away.';
    form.appendChild(el);
    return el;
  }

  // Bot trap: real people never fill a hidden field.
  function addHoneypot(form) {
    if (form.querySelector('[name="_pg_hp"]')) return;
    var hp = d.createElement('input');
    hp.type = 'text';
    hp.name = '_pg_hp';
    hp.tabIndex = -1;
    hp.autocomplete = 'off';
    hp.setAttribute('aria-hidden', 'true');
    hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;';
    form.appendChild(hp);
  }

  /* Wire a form up. opts: {btn, success, source, label} */
  function bind(form, opts) {
    if (!form || form.dataset.pgBound) return;
    form.dataset.pgBound = '1';
    opts = opts || {};

    var btn = opts.btn || d.getElementById('formBtn') || form.querySelector('[type="submit"]');
    var success = opts.success || d.getElementById('formSuccess');
    var label = opts.label || (btn && btn.textContent) || 'Submit';
    var busy = false;

    addHoneypot(form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;

      // Respect the browser's own required-field validation.
      if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
        if (typeof form.reportValidity === 'function') form.reportValidity();
        return;
      }

      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });

      if (data._pg_hp) return;   // bot — pretend nothing happened
      delete data._pg_hp;

      data.source = opts.source || w.PG_LEAD_SOURCE || d.title || 'website';

      busy = true;
      errorBox(form).style.display = 'none';
      if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }

      send(data, { legacy: opts.legacy }).then(function (res) {
        busy = false;
        if (res.ok) {
          form.style.display = 'none';
          if (success) success.style.display = 'block';
        } else {
          // Nothing stored anywhere — tell the truth, offer WhatsApp.
          if (btn) { btn.textContent = label; btn.disabled = false; }
          errorBox(form).style.display = 'block';
        }
      });
    });
  }

  /* Auto-wire the standard audit form once the DOM is ready. */
  function autoBind() {
    var form = d.getElementById('auditForm');
    if (form) {
      bind(form, {
        btn: d.getElementById('formBtn'),
        success: d.getElementById('formSuccess'),
        source: w.PG_LEAD_SOURCE,
        label: '📅 Get My Free Audit'
      });
    }
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', autoBind);
  } else {
    autoBind();
  }

  w.PGLead = { send: send, bind: bind, config: CONFIG };
})(window, document);

// ===== Cookie Consent Banner =====
// GDPR / ePrivacy-friendly consent manager. Four categories matching the
// Privacy Policy: Strictly necessary (always on), Preferences, Analytics,
// Marketing. Consent is persisted to localStorage; a "cookieConsentUpdate"
// event is dispatched so downstream scripts can react.

(function () {
  const STORAGE_KEY = "hb-cookie-consent";
  const STORAGE_VERSION = 1;

  const DEFAULT_OPTIONAL = {
    preferences: false,
    analytics: false,
    marketing: false,
  };

  const ALL_OPTIONAL = {
    preferences: true,
    analytics: true,
    marketing: true,
  };

  function readStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.version !== STORAGE_VERSION) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function writeStored(choices) {
    const value = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      choices,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (_) {
      // ignore quota / private-mode errors
    }
    window.dispatchEvent(
      new CustomEvent("cookieConsentUpdate", {
        detail: { essential: true, ...choices },
      })
    );
  }

  // Current draft preferences while the modal is open.
  let draft = { ...DEFAULT_OPTIONAL };

  function loadDraftFromStore() {
    const stored = readStored();
    draft = stored ? { ...stored.choices } : { ...DEFAULT_OPTIONAL };
  }

  function buildHTML() {
    return (
      "<div class=\"cookie-banner\" id=\"cookieBanner\" role=\"dialog\" aria-live=\"polite\" aria-label=\"Cookie consent\">" +
      "  <div class=\"cookie-banner-content\">" +
      "    <div class=\"cookie-banner-text\">" +
      "      <strong>We respect your privacy</strong>" +
      "      <p>We use cookies and similar technologies to make this site work and &mdash; if you agree &mdash; to measure usage and improve the experience. You can accept all, reject all non-essential cookies, or customize your choices by category. You can change your mind at any time via \"Cookie settings\" in the footer. <a href=\"privacy.html\">Learn more in our Privacy Policy</a>.</p>" +
      "    </div>" +
      "    <div class=\"cookie-banner-actions\">" +
      "      <button type=\"button\" class=\"cookie-btn cookie-btn-primary\" id=\"cookieAccept\">Accept all</button>" +
      "      <button type=\"button\" class=\"cookie-btn cookie-btn-primary\" id=\"cookieReject\">Reject all</button>" +
      "      <button type=\"button\" class=\"cookie-btn cookie-btn-outline\" id=\"cookieCustomize\">Customize</button>" +
      "    </div>" +
      "  </div>" +
      "</div>" +
      "<div class=\"cookie-modal-backdrop\" id=\"cookieModalBackdrop\" aria-hidden=\"true\"></div>" +
      "<div class=\"cookie-modal\" id=\"cookieModal\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"cookieModalTitle\" aria-hidden=\"true\">" +
      "  <div class=\"cookie-modal-content\">" +
      "    <div class=\"cookie-modal-header\">" +
      "      <h2 id=\"cookieModalTitle\">Cookie preferences</h2>" +
      "      <button type=\"button\" class=\"cookie-modal-close\" id=\"cookieModalClose\" aria-label=\"Close cookie preferences\">&times;</button>" +
      "    </div>" +
      "    <p class=\"cookie-modal-intro\">We use different kinds of cookies and similar technologies to operate this website. Strictly necessary cookies are always on because the site cannot function without them. Everything else is opt-in &mdash; we will not set these unless you agree. <a href=\"privacy.html\">Read the full Privacy Policy</a>.</p>" +
      "    <div class=\"cookie-category\">" +
      "      <div class=\"cookie-category-header\">" +
      "        <div>" +
      "          <strong>Strictly necessary</strong>" +
      "          <p>Required for the site to work, including remembering your cookie choices and basic security. These cannot be switched off.</p>" +
      "        </div>" +
      "        <label class=\"cookie-toggle disabled\" aria-label=\"Strictly necessary (always on)\">" +
      "          <input type=\"checkbox\" checked disabled>" +
      "          <span class=\"cookie-toggle-slider\"></span>" +
      "        </label>" +
      "      </div>" +
      "    </div>" +
      "    <div class=\"cookie-category\">" +
      "      <div class=\"cookie-category-header\">" +
      "        <div>" +
      "          <strong>Preferences</strong>" +
      "          <p>Remember non-essential choices you make on the site, such as UI preferences. We do not currently set any preference cookies.</p>" +
      "        </div>" +
      "        <label class=\"cookie-toggle\" aria-label=\"Toggle preference cookies\">" +
      "          <input type=\"checkbox\" id=\"cookiePreferences\">" +
      "          <span class=\"cookie-toggle-slider\"></span>" +
      "        </label>" +
      "      </div>" +
      "    </div>" +
      "    <div class=\"cookie-category\">" +
      "      <div class=\"cookie-category-header\">" +
      "        <div>" +
      "          <strong>Analytics</strong>" +
      "          <p>Help us understand how visitors use the site (pages viewed, buttons clicked) so we can improve it. We do not currently set any analytics cookies.</p>" +
      "        </div>" +
      "        <label class=\"cookie-toggle\" aria-label=\"Toggle analytics cookies\">" +
      "          <input type=\"checkbox\" id=\"cookieAnalytics\">" +
      "          <span class=\"cookie-toggle-slider\"></span>" +
      "        </label>" +
      "      </div>" +
      "    </div>" +
      "    <div class=\"cookie-category\">" +
      "      <div class=\"cookie-category-header\">" +
      "        <div>" +
      "          <strong>Marketing</strong>" +
      "          <p>Used to measure advertising effectiveness and show relevant ads on other sites. We do not currently set any marketing cookies.</p>" +
      "        </div>" +
      "        <label class=\"cookie-toggle\" aria-label=\"Toggle marketing cookies\">" +
      "          <input type=\"checkbox\" id=\"cookieMarketing\">" +
      "          <span class=\"cookie-toggle-slider\"></span>" +
      "        </label>" +
      "      </div>" +
      "    </div>" +
      "    <div class=\"cookie-modal-footer\">" +
      "      <button type=\"button\" class=\"cookie-btn cookie-btn-primary\" id=\"cookieRejectAllModal\">Reject all</button>" +
      "      <button type=\"button\" class=\"cookie-btn cookie-btn-outline\" id=\"cookieSave\">Save my choices</button>" +
      "      <button type=\"button\" class=\"cookie-btn cookie-btn-primary\" id=\"cookieAcceptAllModal\">Accept all</button>" +
      "    </div>" +
      "  </div>" +
      "</div>"
    );
  }

  function mount() {
    if (document.getElementById("cookieBanner")) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = buildHTML();
    while (wrapper.firstChild) document.body.appendChild(wrapper.firstChild);
    wireEvents();
  }

  function showBanner() {
    const banner = document.getElementById("cookieBanner");
    if (banner) banner.classList.add("visible");
  }

  function hideBanner() {
    const banner = document.getElementById("cookieBanner");
    if (banner) banner.classList.remove("visible");
  }

  function syncTogglesFromDraft() {
    const p = document.getElementById("cookiePreferences");
    const a = document.getElementById("cookieAnalytics");
    const m = document.getElementById("cookieMarketing");
    if (p) p.checked = !!draft.preferences;
    if (a) a.checked = !!draft.analytics;
    if (m) m.checked = !!draft.marketing;
  }

  function readDraftFromToggles() {
    const p = document.getElementById("cookiePreferences");
    const a = document.getElementById("cookieAnalytics");
    const m = document.getElementById("cookieMarketing");
    draft = {
      preferences: !!(p && p.checked),
      analytics: !!(a && a.checked),
      marketing: !!(m && m.checked),
    };
  }

  function openModal() {
    const modal = document.getElementById("cookieModal");
    const backdrop = document.getElementById("cookieModalBackdrop");
    if (!modal || !backdrop) return;
    loadDraftFromStore();
    syncTogglesFromDraft();
    modal.classList.add("visible");
    modal.setAttribute("aria-hidden", "false");
    backdrop.classList.add("visible");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    const modal = document.getElementById("cookieModal");
    const backdrop = document.getElementById("cookieModalBackdrop");
    if (!modal || !backdrop) return;
    modal.classList.remove("visible");
    modal.setAttribute("aria-hidden", "true");
    backdrop.classList.remove("visible");
    document.body.style.overflow = "";
  }

  function acceptAll() {
    writeStored(ALL_OPTIONAL);
    hideBanner();
    closeModal();
  }

  function rejectAll() {
    writeStored(DEFAULT_OPTIONAL);
    hideBanner();
    closeModal();
  }

  function savePreferences() {
    readDraftFromToggles();
    writeStored(draft);
    hideBanner();
    closeModal();
  }

  function wireEvents() {
    document.getElementById("cookieAccept").addEventListener("click", acceptAll);
    document.getElementById("cookieReject").addEventListener("click", rejectAll);
    document.getElementById("cookieCustomize").addEventListener("click", openModal);
    document.getElementById("cookieAcceptAllModal").addEventListener("click", acceptAll);
    document.getElementById("cookieRejectAllModal").addEventListener("click", rejectAll);
    document.getElementById("cookieSave").addEventListener("click", savePreferences);
    document.getElementById("cookieModalClose").addEventListener("click", closeModal);
    document.getElementById("cookieModalBackdrop").addEventListener("click", closeModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });
  }

  // Exposed so the footer "Cookie settings" link can re-open preferences.
  window.openCookiePreferences = function () {
    mount();
    openModal();
  };

  document.addEventListener("DOMContentLoaded", function () {
    mount();
    const stored = readStored();
    if (!stored) {
      setTimeout(showBanner, 400);
    }
  });
})();

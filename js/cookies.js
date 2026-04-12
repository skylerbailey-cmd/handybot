// ===== Cookie Consent Banner =====
// GDPR / CCPA compliant cookie consent with granular preferences.
// Stores consent in localStorage under the key "handybot_cookie_consent".

(function () {
  const STORAGE_KEY = 'handybot_cookie_consent';
  const CONSENT_VERSION = 1;

  // Default consent state: necessary cookies are always on.
  const defaultConsent = {
    version: CONSENT_VERSION,
    timestamp: null,
    necessary: true,
    analytics: false,
    marketing: false,
  };

  function loadConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.version !== CONSENT_VERSION) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function saveConsent(consent) {
    const toSave = {
      ...consent,
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (_) {
      // Storage blocked — fall back to session memory only.
    }
    // Dispatch a custom event so analytics/marketing scripts can subscribe.
    window.dispatchEvent(new CustomEvent('cookieConsentUpdate', { detail: toSave }));
  }

  function buildBannerHTML() {
    return `
      <div class="cookie-banner" id="cookieBanner" role="dialog" aria-live="polite" aria-label="Cookie consent">
        <div class="cookie-banner-content">
          <div class="cookie-banner-text">
            <strong>We value your privacy</strong>
            <p>We use cookies to make HandyBot work, improve your experience, and understand how the site is used. You can accept all, reject non-essential, or customize your preferences. Read our <a href="privacy.html">Privacy Policy</a>.</p>
          </div>
          <div class="cookie-banner-actions">
            <button type="button" class="cookie-btn cookie-btn-ghost" id="cookieCustomize">Customize</button>
            <button type="button" class="cookie-btn cookie-btn-outline" id="cookieReject">Reject All</button>
            <button type="button" class="cookie-btn cookie-btn-primary" id="cookieAccept">Accept All</button>
          </div>
        </div>
      </div>

      <div class="cookie-modal-backdrop" id="cookieModalBackdrop" aria-hidden="true"></div>
      <div class="cookie-modal" id="cookieModal" role="dialog" aria-modal="true" aria-labelledby="cookieModalTitle" aria-hidden="true">
        <div class="cookie-modal-content">
          <div class="cookie-modal-header">
            <h2 id="cookieModalTitle">Cookie Preferences</h2>
            <button type="button" class="cookie-modal-close" id="cookieModalClose" aria-label="Close">&times;</button>
          </div>
          <p class="cookie-modal-intro">Choose which categories of cookies you consent to. You can change your preferences at any time.</p>

          <div class="cookie-category">
            <div class="cookie-category-header">
              <div>
                <strong>Strictly Necessary</strong>
                <p>Required for the site to function &mdash; things like remembering your consent choice. Always on.</p>
              </div>
              <label class="cookie-toggle disabled" aria-label="Strictly necessary (always on)">
                <input type="checkbox" checked disabled>
                <span class="cookie-toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="cookie-category">
            <div class="cookie-category-header">
              <div>
                <strong>Analytics</strong>
                <p>Help us understand how visitors use HandyBot so we can improve it. Aggregated and anonymized where possible.</p>
              </div>
              <label class="cookie-toggle" aria-label="Toggle analytics cookies">
                <input type="checkbox" id="cookieAnalytics">
                <span class="cookie-toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="cookie-category">
            <div class="cookie-category-header">
              <div>
                <strong>Marketing</strong>
                <p>Used to measure the effectiveness of our outreach and to show relevant content. We do not sell your data.</p>
              </div>
              <label class="cookie-toggle" aria-label="Toggle marketing cookies">
                <input type="checkbox" id="cookieMarketing">
                <span class="cookie-toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="cookie-modal-footer">
            <button type="button" class="cookie-btn cookie-btn-outline" id="cookieRejectAllModal">Reject All</button>
            <button type="button" class="cookie-btn cookie-btn-primary" id="cookieSave">Save Preferences</button>
          </div>
        </div>
      </div>
    `;
  }

  function mountBanner() {
    if (document.getElementById('cookieBanner')) return; // Already mounted
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildBannerHTML();
    while (wrapper.firstChild) {
      document.body.appendChild(wrapper.firstChild);
    }
    wireEvents();
  }

  function showBanner() {
    const banner = document.getElementById('cookieBanner');
    if (banner) banner.classList.add('visible');
  }

  function hideBanner() {
    const banner = document.getElementById('cookieBanner');
    if (banner) banner.classList.remove('visible');
  }

  function openModal() {
    const modal = document.getElementById('cookieModal');
    const backdrop = document.getElementById('cookieModalBackdrop');
    if (!modal || !backdrop) return;

    // Hydrate toggles from saved consent if any.
    const saved = loadConsent();
    const analyticsInput = document.getElementById('cookieAnalytics');
    const marketingInput = document.getElementById('cookieMarketing');
    if (analyticsInput) analyticsInput.checked = saved ? !!saved.analytics : false;
    if (marketingInput) marketingInput.checked = saved ? !!saved.marketing : false;

    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = document.getElementById('cookieModal');
    const backdrop = document.getElementById('cookieModalBackdrop');
    if (!modal || !backdrop) return;
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('visible');
    document.body.style.overflow = '';
  }

  function wireEvents() {
    const acceptBtn = document.getElementById('cookieAccept');
    const rejectBtn = document.getElementById('cookieReject');
    const customizeBtn = document.getElementById('cookieCustomize');
    const saveBtn = document.getElementById('cookieSave');
    const rejectAllModalBtn = document.getElementById('cookieRejectAllModal');
    const closeBtn = document.getElementById('cookieModalClose');
    const backdrop = document.getElementById('cookieModalBackdrop');

    if (acceptBtn) acceptBtn.addEventListener('click', () => {
      saveConsent({ ...defaultConsent, analytics: true, marketing: true });
      hideBanner();
    });

    if (rejectBtn) rejectBtn.addEventListener('click', () => {
      saveConsent({ ...defaultConsent });
      hideBanner();
    });

    if (customizeBtn) customizeBtn.addEventListener('click', () => {
      openModal();
    });

    if (saveBtn) saveBtn.addEventListener('click', () => {
      const analytics = !!document.getElementById('cookieAnalytics').checked;
      const marketing = !!document.getElementById('cookieMarketing').checked;
      saveConsent({ ...defaultConsent, analytics, marketing });
      closeModal();
      hideBanner();
    });

    if (rejectAllModalBtn) rejectAllModalBtn.addEventListener('click', () => {
      saveConsent({ ...defaultConsent });
      closeModal();
      hideBanner();
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  // Expose a global so users can re-open preferences from a footer link.
  window.openCookiePreferences = function () {
    mountBanner();
    openModal();
  };

  // Boot
  document.addEventListener('DOMContentLoaded', () => {
    mountBanner();
    const existing = loadConsent();
    if (!existing) {
      // Give the page a moment to paint before showing the banner.
      setTimeout(showBanner, 400);
    }
  });
})();

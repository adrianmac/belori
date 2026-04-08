(function () {
  var script = document.currentScript || document.querySelector('script[data-boutique-id]');
  var boutiqueId = script && script.getAttribute('data-boutique-id');
  var buttonText = (script && script.getAttribute('data-button-text')) || '💍 Book a consultation';
  if (!boutiqueId) return;

  // ── Inject styles ────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#belori-btn{position:fixed;bottom:24px;right:24px;z-index:999998;background:#C9697A;color:#fff;border:none;border-radius:28px;padding:14px 20px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(201,105,122,0.4);font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif;transition:transform 0.15s,box-shadow 0.15s;display:flex;align-items:center;gap:8px;}',
    '#belori-btn:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(201,105,122,0.5);}',
    '#belori-overlay{display:none;position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;padding:20px;}',
    '#belori-overlay.open{display:flex;}',
    '#belori-modal{background:#fff;border-radius:20px;width:100%;max-width:480px;max-height:90vh;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.3);display:flex;flex-direction:column;}',
    '#belori-modal-header{padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #E5E7EB;flex-shrink:0;}',
    '#belori-modal-title{font-size:16px;font-weight:600;color:#1C1012;font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif;}',
    '#belori-close{width:32px;height:32px;border-radius:8px;border:1px solid #E5E7EB;background:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6B7280;line-height:1;padding:0;}',
    '#belori-close:hover{background:#FDF2F4;border-color:#C9697A;color:#C9697A;}',
    '#belori-iframe{flex:1;border:none;min-height:520px;width:100%;}',
    '@media(max-width:500px){',
    '  #belori-btn{bottom:16px;right:16px;padding:12px 16px;font-size:14px;}',
    '  #belori-overlay{padding:0;align-items:flex-end;}',
    '  #belori-modal{border-radius:20px 20px 0 0;max-height:85vh;}',
    '}',
  ].join('');
  document.head.appendChild(style);

  // ── Build DOM ────────────────────────────────────────────────────────────────
  var btn = document.createElement('button');
  btn.id = 'belori-btn';
  btn.setAttribute('aria-label', 'Open booking consultation form');
  btn.textContent = buttonText;

  var overlay = document.createElement('div');
  overlay.id = 'belori-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Book a consultation');

  var modal = document.createElement('div');
  modal.id = 'belori-modal';

  var header = document.createElement('div');
  header.id = 'belori-modal-header';

  var title = document.createElement('span');
  title.id = 'belori-modal-title';
  title.textContent = 'Book a consultation';

  var closeBtn = document.createElement('button');
  closeBtn.id = 'belori-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u00d7'; // ×

  header.appendChild(title);
  header.appendChild(closeBtn);

  var iframe = document.createElement('iframe');
  iframe.id = 'belori-iframe';
  iframe.src = 'about:blank';
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('title', 'Book a consultation');
  iframe.setAttribute('allowtransparency', 'true');

  modal.appendChild(header);
  modal.appendChild(iframe);
  overlay.appendChild(modal);

  document.body.appendChild(btn);
  document.body.appendChild(overlay);

  // ── State + helpers ──────────────────────────────────────────────────────────
  var loaded = false;
  var closeTimer = null;

  function openModal() {
    if (!loaded) {
      iframe.src = 'https://novela-olive.vercel.app/lead/' + boutiqueId;
      loaded = true;
    }
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  }

  // ── Events ───────────────────────────────────────────────────────────────────
  btn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  // Listen for successful form submission from the iframe
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'belori:lead_submitted') {
      // Close after 2s to let the success screen show
      closeTimer = setTimeout(closeModal, 2000);
    }
  });
})();

(function () {
  'use strict';

  // === CONFIGURATION ===
  var API_URL = 'https://rf-crm.onrender.com/api/v1';
  var PROJECT_SLUG = 'floresta-campestre'; // slug del proyecto en el CRM
  var PRICE_PER_SQM = 1000; // precio por m²

  // === DOM READY ===
  function init() {
    addStyles();
    addButtonsToLots();
    setupForm();
  }

  // === STYLES ===
  function addStyles() {
    var style = document.createElement('style');
    style.textContent =
      '.rf-btn {' +
        'display: inline-block;' +
        'background: linear-gradient(135deg, #1a3c2a, #2d5a3e);' +
        'color: #fff !important;' +
        'border: none;' +
        'padding: 8px 20px;' +
        'border-radius: 8px;' +
        'font-size: 13px;' +
        'font-weight: 600;' +
        'cursor: pointer;' +
        'transition: all 0.3s ease;' +
        'box-shadow: 0 2px 8px rgba(26,60,42,0.3);' +
        'margin-top: 6px;' +
        'width: 100%;' +
      '}' +
      '.rf-btn:hover {' +
        'transform: translateY(-1px);' +
        'box-shadow: 0 4px 14px rgba(26,60,42,0.4);' +
      '}' +
      '.rf-btn:active { transform: scale(0.97); }' +
      '.rf-btn--reserved {' +
        'background: #9ca3af;' +
        'cursor: not-allowed;' +
        'box-shadow: none;' +
      '}' +
      '.rf-btn--sold {' +
        'background: #6b7280;' +
        'cursor: not-allowed;' +
        'box-shadow: none;' +
      '}' +
      '/* Modal */' +
      '.rf-modal-overlay {' +
        'position: fixed; inset: 0; z-index: 9999;' +
        'background: rgba(0,0,0,0.6);' +
        'backdrop-filter: blur(4px);' +
        'display: flex; align-items: center; justify-content: center;' +
        'padding: 20px;' +
        'animation: rfFadeIn 0.3s ease;' +
      '}' +
      '.rf-modal {' +
        'background: #fff;' +
        'border-radius: 16px;' +
        'padding: 32px;' +
        'max-width: 420px;' +
        'width: 100%;' +
        'box-shadow: 0 20px 60px rgba(0,0,0,0.3);' +
        'animation: rfSlideUp 0.3s ease;' +
      '}' +
      '.rf-modal h3 {' +
        'font-size: 20px; font-weight: 700;' +
        'color: #1a1a1a; margin: 0 0 4px;' +
      '}' +
      '.rf-modal .rf-lot-info {' +
        'font-size: 14px; color: #6b7280; margin-bottom: 20px;' +
      '}' +
      '.rf-modal input {' +
        'width: 100%; padding: 10px 14px;' +
        'border: 1px solid #e5e7eb; border-radius: 10px;' +
        'font-size: 14px; box-sizing: border-box;' +
        'transition: border-color 0.2s;' +
        'margin-bottom: 12px;' +
      '}' +
      '.rf-modal input:focus {' +
        'outline: none;' +
        'border-color: #2d5a3e;' +
        'box-shadow: 0 0 0 3px rgba(45,90,62,0.1);' +
      '}' +
      '.rf-modal .rf-btn-submit {' +
        'width: 100%; padding: 12px;' +
        'background: linear-gradient(135deg, #1a3c2a, #2d5a3e);' +
        'color: #fff; border: none; border-radius: 10px;' +
        'font-size: 15px; font-weight: 600; cursor: pointer;' +
        'transition: all 0.3s;' +
        'margin-top: 4px;' +
      '}' +
      '.rf-modal .rf-btn-submit:hover {' +
        'transform: translateY(-1px);' +
        'box-shadow: 0 4px 14px rgba(26,60,42,0.4);' +
      '}' +
      '.rf-modal .rf-btn-cancel {' +
        'width: 100%; padding: 10px;' +
        'background: none; color: #6b7280; border: 1px solid #e5e7eb; border-radius: 10px;' +
        'font-size: 14px; cursor: pointer; margin-top: 8px;' +
        'transition: all 0.2s;' +
      '}' +
      '.rf-modal .rf-btn-cancel:hover { background: #f9fafb; }' +
      '.rf-success {' +
        'text-align: center; padding: 20px 0;' +
      '}' +
      '.rf-success .rf-icon {' +
        'width: 56px; height: 56px;' +
        'background: #d1fae5; border-radius: 50%;' +
        'display: flex; align-items: center; justify-content: center;' +
        'margin: 0 auto 16px;' +
        'font-size: 28px;' +
      '}' +
      '.rf-success h4 {' +
        'font-size: 18px; font-weight: 700; color: #065f46; margin: 0 0 8px;' +
      '}' +
      '.rf-success p {' +
        'font-size: 14px; color: #6b7280; line-height: 1.5; margin: 0;' +
      '}' +
      '.rf-error {' +
        'background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;' +
        'padding: 12px; border-radius: 10px; font-size: 13px; text-align: center;' +
        'margin-bottom: 12px;' +
      '}' +
      '.rf-loading {' +
        'display: inline-block; width: 16px; height: 16px;' +
        'border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;' +
        'border-radius: 50%; animation: rfSpin 0.6s linear infinite;' +
        'vertical-align: middle; margin-right: 6px;' +
      '}' +
      '@keyframes rfFadeIn { from { opacity: 0; } to { opacity: 1; } }' +
      '@keyframes rfSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }' +
      '@keyframes rfSpin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  // === FIND LOT CONTAINERS ===
  function findLotCards() {
    var cards = [];
    // Busca en la sección de lotes del HTML
    var lotSections = document.querySelectorAll('.lot-card, [class*="lote"], [class*="solares"]');
    if (lotSections.length === 0) {
      // Fallback: busca elementos que contengan "Lote " en su texto
      var allElements = document.querySelectorAll('p, div, span, li');
      allElements.forEach(function (el) {
        var text = el.textContent || '';
        var match = text.match(/Lote\s*(\d+)[:\s]*([\d,.]+)\s*m²/i);
        if (match && el.children.length < 3) {
          cards.push({
            element: el,
            lotNumber: parseInt(match[1]),
            areaSqm: parseFloat(match[2].replace(/,/g, '')),
          });
        }
      });
    } else {
      lotSections.forEach(function (section) {
        var text = section.textContent || '';
        var match = text.match(/Lote\s*(\d+)[:\s]*([\d,.]+)\s*m²/i);
        if (match) {
          cards.push({
            element: section,
            lotNumber: parseInt(match[1]),
            areaSqm: parseFloat(match[2].replace(/,/g, '')),
          });
        }
      });
    }
    return cards;
  }

  // === ADD BUTTONS TO LOTS ===
  var modalState = {
    lotId: null,
    lotNumber: null,
    areaSqm: null,
  };

  function addButtonsToLots() {
    var lots = findLotCards();
    lots.forEach(function (lot) {
      var btn = document.createElement('button');
      btn.className = 'rf-btn';
      btn.textContent = 'Adquirir';
      btn.dataset.lotNumber = lot.lotNumber;
      btn.dataset.areaSqm = lot.areaSqm;
      btn.addEventListener('click', function () {
        openModal(lot.lotNumber, lot.areaSqm);
      });
      // Insert after the lot text
      lot.element.parentNode.insertBefore(btn, lot.element.nextSibling);
    });
  }

  // === MODAL ===
  function openModal(lotNumber, areaSqm) {
    var overlay = document.createElement('div');
    overlay.className = 'rf-modal-overlay';
    var totalPrice = (areaSqm * PRICE_PER_SQM).toLocaleString('es-MX');

    overlay.innerHTML =
      '<div class="rf-modal">' +
        '<h3>Apartar Lote #' + lotNumber + '</h3>' +
        '<div class="rf-lot-info">' +
          areaSqm + ' m² · $' + totalPrice +
        '</div>' +
        '<div id="rf-error-msg" style="display:none"></div>' +
        '<form id="rf-form">' +
          '<input type="text" id="rf-name" placeholder="Tu nombre completo" required>' +
          '<input type="email" id="rf-email" placeholder="Correo electrónico">' +
          '<input type="tel" id="rf-phone" placeholder="Teléfono (ej: 6623401527)">' +
          '<p style="font-size:11px;color:#9ca3af;margin:-6px 0 12px;">Correo o teléfono requerido</p>' +
          '<button type="submit" class="rf-btn-submit" id="rf-submit-btn">' +
            'Apartar Lote' +
          '</button>' +
        '</form>' +
        '<button class="rf-btn-cancel" id="rf-cancel-btn">Cancelar</button>' +
      '</div>';

    document.body.appendChild(overlay);

    modalState.lotNumber = lotNumber;
    modalState.areaSqm = areaSqm;

    // Close handlers
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal(overlay);
    });
    overlay.querySelector('#rf-cancel-btn').addEventListener('click', function () {
      closeModal(overlay);
    });
    overlay.querySelector('#rf-form').addEventListener('submit', function (e) {
      e.preventDefault();
      handleSubmit(overlay, lotNumber, areaSqm);
    });
    // Focus first input
    setTimeout(function () { overlay.querySelector('#rf-name').focus(); }, 100);
  }

  function closeModal(overlay) {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  function showError(overlay, msg) {
    var el = overlay.querySelector('#rf-error-msg');
    el.textContent = msg;
    el.style.display = 'block';
    el.className = 'rf-error';
  }

  function showSuccess(overlay, lotNumber) {
    overlay.querySelector('#rf-form').innerHTML =
      '<div class="rf-success">' +
        '<div class="rf-icon">✅</div>' +
        '<h4>¡Lote #' + lotNumber + ' apartado!</h4>' +
        '<p>Te hemos enviado los detalles. Un asesor se pondrá en contacto contigo.<br><br>' +
        '<strong>Tienes 15 días</strong> para formalizar tu compra.</p>' +
        '<button class="rf-btn-cancel" id="rf-close-btn" style="margin-top:16px;">Cerrar</button>' +
      '</div>';
    overlay.querySelector('#rf-close-btn').addEventListener('click', function () {
      closeModal(overlay);
    });
  }

  // === SUBMIT ===
  function handleSubmit(overlay, lotNumber, areaSqm) {
    var name = overlay.querySelector('#rf-name').value.trim();
    var email = overlay.querySelector('#rf-email').value.trim();
    var phone = overlay.querySelector('#rf-phone').value.trim();
    var submitBtn = overlay.querySelector('#rf-submit-btn');

    if (!name) { showError(overlay, 'Ingresa tu nombre'); return; }
    if (!email && !phone) { showError(overlay, 'Ingresa al menos correo o teléfono'); return; }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="rf-loading"></span> Apartando...';

    // Find the CRM lot ID via API
    // First get project, then find lot by number
    var crmUrl = API_URL + '/projects';

    function reserveLot(lotId) {
      fetch(API_URL + '/public/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: lotId,
          full_name: name,
          email: email || null,
          phone: phone || null,
        }),
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          showSuccess(overlay, lotNumber);
          // Mark the button as reserved
          var buttons = document.querySelectorAll('.rf-btn');
          buttons.forEach(function (b) {
            if (parseInt(b.dataset.lotNumber) === lotNumber) {
              b.textContent = 'Apartado';
              b.className = 'rf-btn rf-btn--reserved';
              b.disabled = true;
            }
          });
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Apartar Lote';
          showError(overlay, data.message || 'No se pudo apartar el lote');
        }
      })
      .catch(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Apartar Lote';
        showError(overlay, 'Error de conexión. Intenta de nuevo.');
      });
    }

    // Fetch projects to find Floresta Campestre
    fetch(crmUrl)
      .then(function (r) { return r.json(); })
      .then(function (projects) {
        var project = null;
        for (var i = 0; i < projects.length; i++) {
          if (projects[i].slug === PROJECT_SLUG || projects[i].name.toLowerCase().indexOf('floresta') !== -1) {
            project = projects[i];
            break;
          }
        }
        if (!project) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Apartar Lote';
          showError(overlay, 'Error: proyecto no encontrado en CRM');
          return;
        }
        // Fetch lots for the project
        return fetch(API_URL + '/projects/' + project.id + '/lots');
      })
      .then(function (r) {
        if (!r) return;
        return r.json();
      })
      .then(function (lots) {
        if (!lots) return;
        var found = null;
        for (var i = 0; i < lots.length; i++) {
          if (lots[i].lot_number === lotNumber) {
            found = lots[i];
            break;
          }
        }
        if (!found) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Apartar Lote';
          showError(overlay, 'Error: lote #' + lotNumber + ' no encontrado en el sistema');
          return;
        }
        if (found.status !== 'available') {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Apartar Lote';
          showError(overlay, 'Este lote ya ' + (found.status === 'reserved' ? 'está apartado' : 'no está disponible'));
          return;
        }
        reserveLot(found.id);
      })
      .catch(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Apartar Lote';
        showError(overlay, 'Error de conexión. Intenta de nuevo.');
      });
  }

  // Setup initial state for lot statuses from CRM
  function setupForm() {
    // Check if there's a project already in the URL
    fetch(API_URL + '/projects')
      .then(function (r) { return r.json(); })
      .then(function (projects) {
        var project = null;
        for (var i = 0; i < projects.length; i++) {
          if (projects[i].slug === PROJECT_SLUG || projects[i].name.toLowerCase().indexOf('floresta') !== -1) {
            project = projects[i];
            break;
          }
        }
        if (!project) return;
        return fetch(API_URL + '/projects/' + project.id + '/lots');
      })
      .then(function (r) {
        if (!r) return;
        return r.json();
      })
      .then(function (lots) {
        if (!lots) return;
        var taken = {};
        lots.forEach(function (lot) {
          if (lot.status !== 'available') {
            taken[lot.lot_number] = lot.status;
          }
        });
        var buttons = document.querySelectorAll('.rf-btn');
        buttons.forEach(function (btn) {
          var num = parseInt(btn.dataset.lotNumber);
          if (taken[num] === 'reserved') {
            btn.textContent = 'Apartado';
            btn.className = 'rf-btn rf-btn--reserved';
            btn.disabled = true;
          } else if (taken[num] === 'sold') {
            btn.textContent = 'Vendido';
            btn.className = 'rf-btn rf-btn--sold';
            btn.disabled = true;
          }
        });
      })
      .catch(function () {});
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

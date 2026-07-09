// ==UserScript==
// @name         TikTok Colecciones Exporter
// @namespace    https://douglasvelez.dev
// @version      2.0.0
// @description  Captura título + enlace de cada video, agrupado por colección, mientras navegas tus Colecciones en TikTok.
// @author       Douglas Velez
// @match        https://www.tiktok.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const store = new Map();            // videoId -> item (incluye a qué colección pertenece)
  let currentCollectionName = 'Sin clasificar';

  // --- Detección del nombre de colección activa (heurística: TikTok cambia clases seguido) ---
  function refreshCollectionName() {
    const candidates = [
      '[data-e2e="collection-title"]',
      '[data-e2e="user-title"]',
      'h1',
      'h2',
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        currentCollectionName = el.textContent.trim();
        return;
      }
    }
    const m = location.pathname.match(/\/collection\/([^/]+)/i);
    if (m) currentCollectionName = decodeURIComponent(m[1]).replace(/-\d+$/, '').replace(/-/g, ' ');
  }

  // TikTok es un SPA: no recarga la página al abrir una colección, hay que interceptar la navegación
  function onRouteChange() {
    setTimeout(refreshCollectionName, 400); // deja que el DOM se pinte
  }
  const _pushState = history.pushState;
  history.pushState = function (...a) { _pushState.apply(this, a); onRouteChange(); };
  const _replaceState = history.replaceState;
  history.replaceState = function (...a) { _replaceState.apply(this, a); onRouteChange(); };
  window.addEventListener('popstate', onRouteChange);
  onRouteChange();

  // --- Auto-scroll: hace el trabajo de "scrollear" por ti dentro de una colección ---
  let autoScrolling = false;
  function autoScroll() {
    if (autoScrolling) { autoScrolling = false; return; }
    autoScrolling = true;
    let lastCount = -1;
    let stableRounds = 0;
    const tick = () => {
      if (!autoScrolling) return;
      window.scrollTo(0, document.body.scrollHeight);
      setTimeout(() => {
        if (!autoScrolling) return;
        if (store.size === lastCount) {
          stableRounds++;
        } else {
          stableRounds = 0;
          lastCount = store.size;
        }
        // Si tras 4 rondas (~6s) no llegan videos nuevos, asumimos que llegamos al final
        if (stableRounds >= 4) {
          autoScrolling = false;
          updateBadge();
          return;
        }
        tick();
      }, 1500);
    };
    tick();
  }

  function addItem(raw) {
    if (!raw || !raw.id || !raw.author || !raw.author.uniqueId) return;
    const id = String(raw.id);
    const item = {
      id,
      title: (raw.desc || '').trim() || '(sin descripción)',
      url: `https://www.tiktok.com/@${raw.author.uniqueId}/video/${id}`,
      author: raw.author.uniqueId,
      cover: (raw.video && (raw.video.cover || raw.video.originCover)) || '',
      collection: currentCollectionName,
      capturedAt: new Date().toISOString(),
    };
    // Si el mismo video ya existe bajo otra colección, se conserva como registro aparte
    // (clave compuesta) porque puede estar guardado en varias colecciones a la vez.
    const key = `${item.collection}::${id}`;
    if (store.has(key)) return;
    store.set(key, item);
    updateBadge();
  }

  function parseAndStore(text) {
    try {
      const data = JSON.parse(text);
      const list = data.itemList || data.collectionItemList || data.aweme_list || [];
      list.forEach(addItem);
    } catch (e) {
      /* no toda respuesta es JSON de colección, se ignora */
    }
  }

  // --- Interceptar fetch ---
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    return origFetch.apply(this, args).then((res) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
      if (/item_list|collection|favorite/i.test(url)) {
        res.clone().text().then(parseAndStore).catch(() => {});
      }
      return res;
    });
  };

  // --- Interceptar XHR (fallback) ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._ttUrl = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      if (this._ttUrl && /item_list|collection|favorite/i.test(this._ttUrl)) {
        parseAndStore(this.responseText);
      }
    });
    return origSend.apply(this, arguments);
  };

  // --- UI flotante ---
  function injectUI() {
    if (document.getElementById('tt-exporter-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'tt-exporter-badge';
    badge.style.cssText = `
      position:fixed; bottom:20px; right:20px; z-index:999999;
      background:#161823; color:#fff; font:13px -apple-system,BlinkMacSystemFont,sans-serif;
      padding:10px 14px; border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,.4);
      display:flex; flex-direction:column; gap:6px; min-width:200px;
    `;
    badge.innerHTML = `
      <span id="tt-count">0 videos · 0 colecciones</span>
      <span id="tt-current" style="color:#25f4ee;font-size:11px;">Colección activa: —</span>
      <button id="tt-autoscroll-btn" style="background:#25f4ee;border:none;color:#111;padding:6px 10px;border-radius:6px;cursor:pointer;font-weight:600;">▶ Auto-scroll esta colección</button>
      <button id="tt-export-btn" style="background:#fe2c55;border:none;color:#fff;padding:6px 10px;border-radius:6px;cursor:pointer;font-weight:600;">Exportar JSON</button>
    `;
    document.body.appendChild(badge);
    document.getElementById('tt-export-btn').onclick = exportJSON;
    document.getElementById('tt-autoscroll-btn').onclick = (e) => {
      autoScroll();
      e.target.textContent = autoScrolling ? '■ Detener auto-scroll' : '▶ Auto-scroll esta colección';
    };
  }

  function updateBadge() {
    const countEl = document.getElementById('tt-count');
    const currEl = document.getElementById('tt-current');
    if (!countEl) return;
    const collections = new Set(Array.from(store.values()).map((i) => i.collection));
    countEl.textContent = `${store.size} videos · ${collections.size} colecciones`;
    if (currEl) currEl.textContent = `Colección activa: ${currentCollectionName}`;
  }

  function exportJSON() {
    if (!store.size) {
      alert('Aún no hay datos. Entra a tu perfil > Colecciones, abre cada colección y haz scroll lento para que TikTok cargue los videos.');
      return;
    }
    // Agrupa por colección para exportar en la estructura que necesitas
    const grouped = {};
    store.forEach((item) => {
      if (!grouped[item.collection]) grouped[item.collection] = [];
      grouped[item.collection].push({
        id: item.id,
        title: item.title,
        url: item.url,
        author: item.author,
        cover: item.cover,
      });
    });

    const payload = {
      exportedAt: new Date().toISOString(),
      sourceAccount: location.pathname.split('/')[1] || null,
      totalVideos: store.size,
      totalCollections: Object.keys(grouped).length,
      collections: grouped,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tiktok-colecciones-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const readyCheck = setInterval(() => {
    if (document.body) {
      injectUI();
      clearInterval(readyCheck);
    }
  }, 300);

  setInterval(updateBadge, 1000); // refresca el nombre de colección activa en vivo
})();

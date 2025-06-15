// js/index.js

document.addEventListener('DOMContentLoaded', () => {
  const tipContainer    = document.getElementById('tip-container');
  const msgContainer    = document.getElementById('message-container');
  const statusContainer = document.getElementById('status-container');

  let tips       = [];
  let currentTip = 0;
  let settings   = { interval: 20, duration: 8, msgMode: 'sync', showTips: true };
  let message    = { text: '', visible: true };
  let status     = {
    room1: { label: '', number: 0, visible: false },
    room2: { label: '', number: 0, visible: false }
  };

  async function init() {
    try { tips     = await fetchJSON('data/tips.json'); }     catch (e) { console.error('tips.json:', e); }
    try { settings = await fetchJSON('data/settings.json'); } catch (e) { console.error('settings.json:', e); }
    try { message  = await fetchJSON('data/message.json'); }  catch (e) { console.warn('message.json:', e); }
    try { status   = await fetchJSON('data/status.json'); }   catch (e) { console.warn('status.json:', e); }

    // 初回ロード時、常時表示モードならすぐにメッセージ表示
    if (settings.msgMode === 'always' && message.visible) {
      msgContainer.innerHTML = `<p>${message.text}</p>`;
      msgContainer.classList.add('show');
    }

    renderStatus();
    showTip();
    setInterval(showTip, settings.interval * 1000);

    setInterval(async () => {
      // 毎サイクルで最新設定・データを取得
      try { settings = await fetchJSON('data/settings.json'); } catch (_) {}
      try { message  = await fetchJSON('data/message.json'); }  catch (_) {}
      try { status   = await fetchJSON('data/status.json'); }   catch (_) {}

      renderStatus();

      if (settings.msgMode === 'always' && message.visible) {
        // 常時表示
        msgContainer.innerHTML = `<p>${message.text}</p>`;
        msgContainer.classList.add('show');
      } else if (settings.msgMode === 'sync' && message.visible) {
        // TIPS同期表示
        showMessage();
      }
    }, settings.interval * 1000);
  }

  function showTip() {
    if (!settings.showTips) return;
    const t = tips[currentTip] || { icon: '', title: '', text: '' };
    const num = currentTip + 1;
    tipContainer.innerHTML = `<h2>コツ${num}: ${t.icon} ${t.title}</h2><p>${t.text}</p>`;
    tipContainer.classList.add('show');
    setTimeout(() => {
      tipContainer.classList.remove('show');
    }, settings.duration * 1000);
    currentTip = (currentTip + 1) % tips.length;
  }

  function showMessage() {
    if (!message.visible || !message.text) return;
    msgContainer.innerHTML = `<p>${message.text}</p>`;
    msgContainer.classList.add('show');
    setTimeout(() => {
      msgContainer.classList.remove('show');
    }, settings.duration * 1000);
  }

  function renderStatus() {
    const r1 = status.room1, r2 = status.room2;
    statusContainer.innerHTML = `
      <h4>🩺 診察順のご案内</h4>
      ${r1.visible ? `<p>${r1.label}：${r1.number}番</p>` : ''}
      ${r2.visible ? `<p>${r2.label}：${r2.number}番</p>` : ''}
    `;
  }

  init();
});

document.addEventListener('DOMContentLoaded', () => {
  // 要素取得
  const room1Label  = document.getElementById('room1Label');
  const room1Num    = document.getElementById('room1Number');
  const room1Vis    = document.getElementById('room1Visible');
  const room2Label  = document.getElementById('room2Label');
  const room2Num    = document.getElementById('room2Number');
  const room2Vis    = document.getElementById('room2Visible');
  const saveStatus  = document.getElementById('saveStatus');

  const messageText = document.getElementById('messageText');
  const msgOn       = document.getElementById('msgOn');
  const msgOff      = document.getElementById('msgOff');
  const modeAlways  = document.getElementById('modeAlways');
  const modeSync    = document.getElementById('modeSync');
  const tipsOn      = document.getElementById('tipsOn');
  const tipsOff     = document.getElementById('tipsOff');
  const intervalInp = document.getElementById('interval');
  const durationInp = document.getElementById('duration');
  const sendMsgBtn  = document.getElementById('sendMessage');
  const saveSetBtn  = document.getElementById('saveSettings');

  // 初期ロード
  async function loadAll() {
    const st   = await fetchJSON('data/status.json');
    room1Label.value = st.room1.label;
    room1Num.value   = st.room1.number;
    room1Vis.checked = st.room1.visible;
    room2Label.value = st.room2.label;
    room2Num.value   = st.room2.number;
    room2Vis.checked = st.room2.visible;

    const msgCfg = await fetchJSON('data/message.json');
    messageText.value = msgCfg.text;
    msgOn.checked = msgCfg.visible;
    msgOff.checked= !msgCfg.visible;

    const cfg = await fetchJSON('data/settings.json');
    modeAlways.checked = cfg.msgMode === 'always';
    modeSync.checked   = cfg.msgMode === 'sync';
    tipsOn.checked     = cfg.showTips;
    tipsOff.checked    = !cfg.showTips;
    intervalInp.value  = cfg.interval;
    durationInp.value  = cfg.duration;
  }

  // 診察順送信
  saveStatus.addEventListener('click', async () => {
    await postJSON('save_status.php', {
      room1:{ label: room1Label.value, number:+room1Num.value, visible:room1Vis.checked },
      room2:{ label: room2Label.value, number:+room2Num.value, visible:room2Vis.checked }
    });
    showToast('診察順を送信しました');
  });

  // メッセージのみ送信
  sendMsgBtn.addEventListener('click', async () => {
    await postJSON('save_message.php', {
      text: messageText.value.trim(),
      visible: msgOn.checked
    });
    showToast('メッセージを送信しました');
  });

  // 設定一括送信（メッセージ含む）
  saveSetBtn.addEventListener('click', async () => {
    const payload = {
      interval: +intervalInp.value,
      duration: +durationInp.value,
      msgMode: modeAlways.checked ? 'always' : 'sync',
      showTips: tipsOn.checked,
      message: {
        text: messageText.value.trim(),
        visible: msgOn.checked
      }
    };
    await postJSON('save_settings.php', payload);
    showToast('設定を変更しました');
  });

  function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position:'fixed',bottom:'10%',left:'50%',transform:'translateX(-50%)',
      background:'rgba(0,0,0,0.7)',color:'#fff',padding:'8px 16px',
      borderRadius:'4px',zIndex:999
    });
    document.body.appendChild(t);
    setTimeout(()=>t.remove(),2000);
  }

  loadAll();
});

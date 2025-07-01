// ─────────────────────────────────────────────────
// 待合室システム コントロール画面JavaScript
// 🔥 要件定義対応版 - 既存機能 + プレビュー + 変更検知
// ─────────────────────────────────────────────────

let isInitialized = false;
let messagePreviewElement = null;
let availableFiles = [];
let currentPlaylist = null;

// 🔥 新規追加
let labelHistory = [];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔥 ステータスメッセージ機能
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STATUS_MESSAGE_PRESETS = {
  'part1_wait': '第１部診察開始まで\nお待ちください',
  'part2_wait': '第２部診察開始まで\nお待ちください',
  'part3_wait': '第３部診察開始まで\nお待ちください',
  'closed': '本日の診療受付は\n終了いたしました',
  'holiday': '本日休診',
  'preparation': '診療準備中です'
};

// 🔥 新機能: 状態管理
let savedState = {
  mode: 'rooms',
  statusMessage: { text: '', visible: false, preset: null },
  room1: { label: '第1診察室', number: 0, visible: false },
  room2: { label: '第2診察室', number: 0, visible: false }
};
let hasChanges = false;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAllData();
    setupEventListeners();
    setupMessagePreview();
    setupPlaylistPreview();
    
    // 数字表示UIの初期化
    initializeNumberDisplays();
    
    // 🔥 新機能: プレビュー初期化
    await refreshPreview();
    startPolling();
    
    isInitialized = true;
    log('info', 'Control panel initialized with preview functionality');
    showToast('コントロールパネルを初期化しました');
  } catch (error) {
    log('error', 'Control panel initialization failed:', error);
    showToast('システムの初期化に失敗しました', 'error');
  }
});

// ─────────────────────────────────────────────────
// 🔥 新機能: プレビュー機能
// ─────────────────────────────────────────────────

/**
 * プレビューエリアの更新
 */
async function refreshPreview() {
  const previewContent = document.getElementById('previewContent');
  if (!previewContent) return;

  const mode = getSelectedMode();

  switch (mode) {
    case 'rooms':
      await refreshRoomPreview();
      break;
    case 'message':
      await refreshMessagePreview();
      break;
    case 'hidden':
      previewContent.innerHTML = '<div class="preview-empty">診察順エリアは非表示です</div>';
      break;
  }
}

async function refreshRoomPreview() {
  const previewContent = document.getElementById('previewContent');
  const currentState = getCurrentFormState();

  const r1 = currentState.room1;
  const r2 = currentState.room2;

  const hasVisibleRoom = (r1.visible && r1.number > 0) || (r2.visible && r2.number > 0);

  if (!hasVisibleRoom) {
    previewContent.innerHTML = '<div class="preview-empty">診察順が設定されていません</div>';
    return;
  }

  let roomsHtml = '';

  if (r1.visible && r1.number > 0) {
    roomsHtml += `
      <div class="preview-room">
        <div class="preview-room-label">${escapeHtml(r1.label || '第1診察室')}</div>
        <div class="preview-room-number">${r1.number}</div>
      </div>
    `;
  }

  if (r2.visible && r2.number > 0) {
    roomsHtml += `
      <div class="preview-room">
        <div class="preview-room-label">${escapeHtml(r2.label || '第2診察室')}</div>
        <div class="preview-room-number">${r2.number}</div>
      </div>
    `;
  }

  previewContent.innerHTML = roomsHtml;
}

async function refreshMessagePreview() {
  const previewContent = document.getElementById('previewContent');
  const messageText = document.getElementById('statusMessageText').value;

  if (!messageText.trim()) {
    previewContent.innerHTML = '<div class="preview-empty">メッセージが入力されていません</div>';
    return;
  }

  const layout = calculatePreviewMessageLayout(messageText);

  if (layout.lineCount === 1) {
    previewContent.innerHTML = `
      <div class="preview-status-message">
        <div class="preview-message-single" style="font-size: ${layout.previewFontSize}px;">
          ${escapeHtml(layout.lines[0])}
        </div>
      </div>`;
  } else {
    previewContent.innerHTML = `
      <div class="preview-status-message">
        <div class="preview-message-container">
          ${layout.lines.map(line => `
            <div class="preview-message-line" style="font-size: ${layout.previewFontSize}px;">
              ${escapeHtml(line)}
            </div>`).join('')}
        </div>
      </div>`;
  }
}

function calculatePreviewMessageLayout(text) {
  const lines = splitVerticalMessage(text);
  const maxCharsPerLine = Math.max(...lines.map(l => l.length));
  const lineCount = lines.length;

  const previewHeight = 180;
  const previewWidth = 300;

  let fontSize;

  if (lineCount === 1) {
    if (maxCharsPerLine <= 4) {
      fontSize = Math.min(previewHeight / maxCharsPerLine * 0.8, 60);
    } else if (maxCharsPerLine <= 8) {
      fontSize = Math.min(previewHeight / maxCharsPerLine * 0.7, 45);
    } else {
      fontSize = Math.min(previewHeight / maxCharsPerLine * 0.6, 35);
    }
  } else if (lineCount === 2) {
    fontSize = Math.min(
      previewHeight / maxCharsPerLine * 0.55,
      previewWidth / 2.5
    );
  } else {
    fontSize = Math.min(
      previewHeight / maxCharsPerLine * 0.4,
      previewWidth / 3.2
    );
  }

  fontSize = Math.max(12, Math.min(fontSize, 60));

  return {
    lines,
    lineCount,
    maxCharsPerLine,
    previewFontSize: Math.round(fontSize)
  };
}

function splitVerticalMessage(text) {
  const cleanText = text.trim();

  if (cleanText.includes('\n')) {
    return cleanText.split('\n').filter(line => line.trim());
  }

  if (cleanText.length <= 10) {
    return [cleanText];
  }

  if (cleanText.length <= 20) {
    return [cleanText];
  }

  const splitPoint = findNaturalBreakPoint(cleanText);
  const line1 = cleanText.substring(0, splitPoint).trim();
  const line2 = cleanText.substring(splitPoint).trim();

  return [line1, line2].filter(line => line.length > 0);
}

function findNaturalBreakPoint(text) {
  const mid = Math.floor(text.length / 2);
  const naturalBreaks = [
    { pattern: 'まで', offset: 2 },
    { pattern: 'から', offset: 2 },
    { pattern: 'です', offset: 2 },
    { pattern: 'ます', offset: 2 },
    { pattern: 'した', offset: 2 },
    { pattern: 'ください', offset: 4 }
  ];

  for (const nb of naturalBreaks) {
    const idx = text.indexOf(nb.pattern);
    if (idx > 0 && idx <= text.length - nb.offset && Math.abs(idx + nb.offset - mid) <= 5) {
      return idx + nb.offset;
    }
  }

  return mid;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─────────────────────────────────────────────────
// 🔥 新機能: 変更検知システム
// ─────────────────────────────────────────────────

/**
 * 現在のフォーム状態を取得
 */
function getCurrentFormState() {
  const mode = getSelectedMode();
  const state = {
    mode: mode
  };

  if (mode === 'message') {
    state.statusMessage = {
      text: document.getElementById('statusMessageText').value.trim(),
      visible: true,
      preset: null
    };
  }

  state.room1 = {
    label: document.getElementById('room1Label')?.value || '第1診察室',
    number: parseInt(document.getElementById('room1Number')?.value) || 0,
    visible: document.getElementById('room1Visible')?.checked || false
  };

  state.room2 = {
    label: document.getElementById('room2Label')?.value || '第2診察室',
    number: parseInt(document.getElementById('room2Number')?.value) || 0,
    visible: document.getElementById('room2Visible')?.checked || false
  };

  return state;
}

/**
 * 変更検知処理
 */
function detectChanges() {
  const currentState = getCurrentFormState();
  const wasChanged = hasChanges;
  
  hasChanges = JSON.stringify(savedState) !== JSON.stringify(currentState);
  
  // UI更新
  updateChangeIndicators(currentState);
  
  // ログ出力
  if (wasChanged !== hasChanges) {
    log('info', hasChanges ? 'Changes detected' : 'No changes');
  }
}

/**
 * 変更インジケーターの更新
 */
function updateChangeIndicators(currentState) {
  // 通知の表示/非表示
  const notification = document.getElementById('changeNotification');
  if (notification) {
    notification.classList.toggle('show', hasChanges);
  }
  
  // 保存ボタンの状態
  const saveButton = document.getElementById('saveButton');
  if (saveButton) {
    saveButton.classList.toggle('changed', hasChanges);
  }
  
  // 各部屋の変更ハイライト
  updateRoomHighlight('room1', currentState.room1);
  updateRoomHighlight('room2', currentState.room2);
}

/**
 * 部屋ごとの変更ハイライト
 */
function updateRoomHighlight(roomId, currentRoomState) {
  const editElement = document.getElementById(roomId + 'Edit');
  if (!editElement) return;
  
  const savedRoomState = savedState[roomId];
  const isChanged = JSON.stringify(savedRoomState) !== JSON.stringify(currentRoomState);
  
  editElement.classList.toggle('changed', isChanged);
}

// ─────────────────────────────────────────────────
// 🔥 新機能: 定期ポーリング（複数端末対応）
// ─────────────────────────────────────────────────

/**
 * 定期的なデータ更新開始
 */
function startPolling() {
  setInterval(async () => {
    try {
      const response = await fetch('data/status.json', { 
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (response.ok) {
        const newState = await response.json();
        
        // 他端末での変更をチェック
        if (JSON.stringify(savedState) !== JSON.stringify(newState)) {
          log('info', 'External changes detected');
          savedState = newState;
          await refreshPreview();
          
          // 現在未編集の場合はフォームも更新
          if (!hasChanges) {
            await loadStatus();
          }
        }
      }
    } catch (error) {
      log('warn', 'Polling error:', error);
    }
  }, 60000); // 1分間隔
}

// ─────────────────────────────────────────────────
// データ読み込み関数
// ─────────────────────────────────────────────────

/**
 * 全データの読み込み
 */
async function loadAllData() {
  await Promise.all([
    loadStatus(),
    loadMessage(),
    loadSettings(),
    loadPlaylist(),
    loadAvailableFiles(),
    loadLabelHistory()
  ]);
}

/**
 * 利用可能なファイルの読み込み
 */
async function loadAvailableFiles() {
  try {
    const response = await fetchJSON('php/get_files.php');
    availableFiles = response.files || [];
    
    // ファイル一覧を表示（availableFiles要素が存在する場合のみ）
    const availableFilesElement = document.getElementById('availableFiles');
    if (availableFilesElement && availableFiles.length > 0) {
      const fileList = availableFiles.map((file, index) => {
        const letter = String.fromCharCode(65 + index); // A, B, C...
        return `<strong>${letter}</strong>: ${file.displayName} (${file.contentCount}項目)`;
      }).join(' | ');
      availableFilesElement.innerHTML = fileList;
    } else if (availableFilesElement) {
      availableFilesElement.innerHTML = 'ファイルが見つかりません';
    }
  } catch (error) {
    log('warn', 'Failed to load available files:', error);
    
    // エラー時の表示更新
    const availableFilesElement = document.getElementById('availableFiles');
    if (availableFilesElement) {
      availableFilesElement.innerHTML = 'ファイル読み込みエラー';
    }
  }
}

/**
 * プレイリストの読み込み
 */
async function loadPlaylist() {
  try {
    const response = await fetchJSON('php/get_playlist_status.php');
    currentPlaylist = response.data;
    
    if (currentPlaylist && currentPlaylist.hasPlaylist) {
      document.getElementById('playlistString').value = currentPlaylist.playlistString || '';
      updatePlaylistPreview();
    }
  } catch (error) {
    log('warn', 'Failed to load playlist:', error);
  }
}

/**
 * 🔥 改良: 診察順の読み込み（状態管理対応）
 */
async function loadStatus() {
  try {
    const status = await fetchJSON('data/status.json');

    savedState = {
      mode: status.mode || 'rooms',
      room1: status.room1 || { label: '第1診察室', number: 0, visible: false },
      room2: status.room2 || { label: '第2診察室', number: 0, visible: false },
      statusMessage: status.statusMessage || { text: '', visible: false, preset: null }
    };

    const modeRadio = document.querySelector(`input[name="displayMode"][value="${savedState.mode}"]`);
    if (modeRadio) modeRadio.checked = true;

    if (savedState.statusMessage) {
      document.getElementById('statusMessageText').value = savedState.statusMessage.text || '';
      updateStatusMessageCounter();
    }

    toggleStatusMessageArea(savedState.mode === 'message');
    toggleRoomSettingsArea(savedState.mode === 'rooms');

    document.getElementById('room1Label').value = savedState.room1.label;
    document.getElementById('room1Number').value = savedState.room1.number;
    document.getElementById('room1Visible').checked = savedState.room1.visible;

    document.getElementById('room2Label').value = savedState.room2.label;
    document.getElementById('room2Number').value = savedState.room2.number;
    document.getElementById('room2Visible').checked = savedState.room2.visible;

    initializeNumberDisplays();

  } catch (error) {
    log('warn', 'Failed to load status:', error);
  }
}

/**
 * メッセージの読み込み
 */
async function loadMessage() {
  try {
    const message = await fetchJSON('data/message.json');
    
    const messageText = TextUtils.processJsonToTextarea(message.text);
    document.getElementById('messageText').value = messageText;
    document.getElementById('showMessage').checked = message.visible !== false;
    
    updateMessageStats();
    updateMessagePreview();
    
  } catch (error) {
    log('warn', 'Failed to load message:', error);
    document.getElementById('showMessage').checked = false;
  }
}

/**
 * 設定の読み込み
 */
async function loadSettings() {
  try {
    const settings = await fetchJSON('data/settings.json');
    
    document.getElementById('waitTime').value = settings.interval || 20;
    document.getElementById('displayTime').value = settings.duration || 8;
    document.getElementById('showTips').checked = settings.showTips !== false;
    
  } catch (error) {
    log('warn', 'Failed to load settings:', error);
    document.getElementById('waitTime').value = 20;
    document.getElementById('displayTime').value = 8;
    document.getElementById('showTips').checked = true;
  }
}

// ─────────────────────────────────────────────────
// 診察順数字操作関数
// ─────────────────────────────────────────────────

/**
 * 診察順番号を変更
 * @param {string} room - room1 または room2
 * @param {number} delta - 変更量（+1 または -1）
 */
function changeNumber(room, delta) {
  const displayElement = document.getElementById(room + 'Display');
  const hiddenInput = document.getElementById(room + 'Number');
  
  if (!displayElement || !hiddenInput) {
    console.warn(`Elements not found for room: ${room}`);
    return;
  }
  
  // 現在の値を取得
  let currentValue = parseInt(hiddenInput.value) || 0;
  
  // 新しい値を計算（0-999の範囲）
  let newValue = currentValue + delta;
  newValue = Math.max(0, Math.min(999, newValue));
  
  // 表示と隠しinputを更新
  updateNumberDisplay(displayElement, newValue);
  hiddenInput.value = newValue;
  
  // 自動チェックボックス更新（0より大きい場合は表示ONに）
  const visibleCheckbox = document.getElementById(room + 'Visible');
  if (visibleCheckbox && newValue > 0) {
    visibleCheckbox.checked = true;
  }
  
  // 🔥 新機能: 変更検知
  detectChanges();
  
  log('info', `Room ${room} number changed to: ${newValue}`);
}

/**
 * 数字表示を更新
 * @param {HTMLElement} displayElement - 表示要素
 * @param {number} value - 表示する値
 */
function updateNumberDisplay(displayElement, value) {
  displayElement.textContent = value;
  displayElement.setAttribute('data-value', value);
  
  // 0の場合と1以上の場合でスタイルを変更
  if (value === 0) {
    displayElement.style.color = '#95a5a6';
    displayElement.style.borderColor = '#bdc3c7';
    displayElement.style.background = 'white';
  } else {
    displayElement.style.color = '#e74c3c';
    displayElement.style.borderColor = '#e74c3c';
    displayElement.style.background = '#fff5f5';
  }
}

/**
 * 数字表示の初期化
 */
function initializeNumberDisplays() {
  const room1Value = parseInt(document.getElementById('room1Number').value) || 0;
  const room2Value = parseInt(document.getElementById('room2Number').value) || 0;
  
  const room1Display = document.getElementById('room1Display');
  const room2Display = document.getElementById('room2Display');
  
  if (room1Display) updateNumberDisplay(room1Display, room1Value);
  if (room2Display) updateNumberDisplay(room2Display, room2Value);
}

// ─────────────────────────────────────────────────
// プレイリスト管理関数
// ─────────────────────────────────────────────────

/**
 * プレイリストプレビューの設定
 */
function setupPlaylistPreview() {
  const playlistInput = document.getElementById('playlistString');
  
  playlistInput.addEventListener('input', debounce(() => {
    updatePlaylistPreview();
  }, 300));
}

/**
 * プレイリストプレビューの更新
 */
function updatePlaylistPreview() {
  const playlistString = document.getElementById('playlistString').value.trim();
  const previewElement = document.getElementById('playlistItems');
  
  if (!playlistString) {
    previewElement.innerHTML = '<span style="color: #999;">プレイリストを入力してください</span>';
    return;
  }
  
  // プレイリスト文字列を解析
  const items = playlistString.split(',').map(item => item.trim()).filter(item => item);
  
  if (items.length === 0) {
    previewElement.innerHTML = '<span style="color: #e74c3c;">有効なアイテムがありません</span>';
    return;
  }
  
  // 各アイテムを解決
  const resolvedItems = items.map((item, index) => {
    // 短縮形（A, B, C...）の場合
    if (item.length === 1 && item >= 'A' && item <= 'Z') {
      const fileIndex = item.charCodeAt(0) - 65;
      if (availableFiles[fileIndex]) {
        return {
          original: item,
          resolved: availableFiles[fileIndex].displayName,
          valid: true
        };
      }
    }
    
    // ファイル名で検索
    const file = availableFiles.find(f => 
      f.filename === item || 
      f.filename === item + '.json' ||
      f.displayName === item
    );
    
    if (file) {
      return {
        original: item,
        resolved: file.displayName,
        valid: true
      };
    }
    
    return {
      original: item,
      resolved: item,
      valid: false
    };
  });
  
  // プレビューHTML生成
  const previewHtml = resolvedItems.map((item, index) => {
    const className = item.valid ? 'playlist-item-valid' : 'playlist-item-invalid';
    const icon = item.valid ? '✓' : '✗';
    return `<span class="${className}">${index + 1}. ${icon} ${item.resolved}</span>`;
  }).join(' → ');
  
  previewElement.innerHTML = previewHtml;
}

/**
 * クイックプレイリスト設定
 */
function setQuickPlaylist(pattern) {
  document.getElementById('playlistString').value = pattern;
  updatePlaylistPreview();
}

/**
 * プレイリストの保存
 */
async function savePlaylist() {
  try {
    const playlistString = document.getElementById('playlistString').value.trim();
    
    if (!playlistString) {
      throw new Error('プレイリストを入力してください');
    }
    
    const data = {
      playlistString: playlistString
    };
    
    const response = await postJSON('php/save_playlist.php', data);
    
    if (response.status === 'success') {
      showToast('プレイリストを保存しました');
      await loadPlaylist();
    } else {
      throw new Error(response.message || 'プレイリストの保存に失敗しました');
    }
    
  } catch (error) {
    log('error', 'Failed to save playlist:', error);
    showToast(error.message || 'プレイリストの保存に失敗しました', 'error');
  }
}

// ─────────────────────────────────────────────────
// イベントリスナー設定
// ─────────────────────────────────────────────────

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
  const messageText = document.getElementById('messageText');
  
  // メッセージ文字数カウントとプレビュー更新
  messageText.addEventListener('input', () => {
    updateMessageStats();
    updateMessagePreview();
  });
  
  // フォームのリアルタイム検証
  setupFormValidation();

  // ステータスメッセージ関連
  setupStatusMessageListeners();
  
  // 🔥 新機能: ページ離脱時の未保存チェック
  window.addEventListener('beforeunload', (e) => {
    if (hasChanges) {
      e.preventDefault();
      e.returnValue = '未保存の変更があります。本当にページを離れますか？';
      return e.returnValue;
    }
  });
}

/**
 * メッセージプレビュー機能の設定
 */
function setupMessagePreview() {
  const messageGroup = document.getElementById('messageText').closest('.form-group');
  messagePreviewElement = ControlTextHandler.createPreviewArea(messageGroup);
}

/**
 * フォーム検証の設定
 */
function setupFormValidation() {
  // 待ち時間の検証
  const waitTime = document.getElementById('waitTime');
  waitTime.addEventListener('input', () => {
    const value = parseInt(waitTime.value);
    if (value < 5 || value > 120) {
      waitTime.style.borderColor = '#e74c3c';
    } else {
      waitTime.style.borderColor = '#ddd';
    }
  });
  
  // 表示時間の検証
  const displayTime = document.getElementById('displayTime');
  displayTime.addEventListener('input', () => {
    const value = parseInt(displayTime.value);
    if (value < 3 || value > 60) {
      displayTime.style.borderColor = '#e74c3c';
    } else {
      displayTime.style.borderColor = '#ddd';
    }
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ステータスメッセージ関連関数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function setupStatusMessageListeners() {
  document.querySelectorAll('input[name="displayMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const mode = getSelectedMode();
      toggleStatusMessageArea(mode === 'message');
      toggleRoomSettingsArea(mode === 'rooms');
      detectChanges();
      refreshPreview();
    });
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (STATUS_MESSAGE_PRESETS[preset]) {
        document.getElementById('statusMessageText').value = STATUS_MESSAGE_PRESETS[preset];
        updateStatusMessageCounter();
        detectChanges();
        refreshPreview();
      }
    });
  });

  document.getElementById('statusMessageText').addEventListener('input', () => {
    updateStatusMessageCounter();
    detectChanges();
    refreshPreview();
  });
}

function getSelectedMode() {
  const checkedRadio = document.querySelector('input[name="displayMode"]:checked');
  return checkedRadio ? checkedRadio.value : 'rooms';
}

function toggleStatusMessageArea(show) {
  const area = document.getElementById('statusMessageArea');
  if (area) area.style.display = show ? 'block' : 'none';
}

function toggleRoomSettingsArea(show) {
  const area = document.getElementById('roomSettingsArea');
  if (area) area.style.display = show ? 'block' : 'none';
}

function updateStatusMessageCounter() {
  const textarea = document.getElementById('statusMessageText');
  const counter = document.getElementById('statusMessageCounter');
  if (!textarea || !counter) return;
  const length = textarea.value.length;
  const maxLength = 30;
  counter.textContent = `${length}/${maxLength}文字`;
  if (length > maxLength * 0.8) {
    counter.classList.add('warning');
  } else {
    counter.classList.remove('warning');
  }
}

// ─────────────────────────────────────────────────
// 🔥 改良: データ保存関数（安全な保存処理）
// ─────────────────────────────────────────────────

/**
 * 診察順の保存（安全な順次実行）
 */
async function saveStatus() {
  try {
    const saveButton = document.getElementById('saveButton');
    
    // 保存中の表示
    saveButton.disabled = true;
    saveButton.textContent = '💾 保存中...';
    
    const data = getCurrentFormState();
    
    log('info', 'Saving status:', data);
    
    const response = await postJSON('php/save_status.php', data);
    
    if (response.status === 'success') {
      // 🔥 この行を追加
      await updateLabelHistory(data.room1.label, data.room2.label);

      // 成功時の処理
      savedState = { ...data };
      hasChanges = false;
      detectChanges();
      await refreshPreview();
      
      showToast('診察順を更新しました');
      log('info', 'Status saved successfully');
    } else {
      throw new Error(response.message || '保存に失敗しました');
    }
    
  } catch (error) {
    log('error', 'Failed to save status:', error);
    showToast(`保存に失敗しました: ${error.message}`, 'error');
  } finally {
    // ボタンを元に戻す
    const saveButton = document.getElementById('saveButton');
    saveButton.disabled = false;
    saveButton.textContent = '💾 診察順を更新';
  }
}

/**
 * 診察順のリセット（数字表示UI対応版）
 */
async function resetStatus() {
  if (!confirm('診察順をリセットしますか？')) return;
  
  document.getElementById('room1Number').value = 0;
  document.getElementById('room2Number').value = 0;
  document.getElementById('room1Visible').checked = false;
  document.getElementById('room2Visible').checked = false;
  
  // 数字表示UIもリセット
  initializeNumberDisplays();
  
  // 🔥 新機能: 変更検知
  detectChanges();
  
  showToast('フォームをリセットしました', 'info');
}

/**
 * メッセージの保存
 */
async function saveMessage() {
  try {
    const messageTextElement = document.getElementById('messageText');
    const rawText = messageTextElement.value;
    
    const processedText = TextUtils.processTextareaInput(rawText);
    
    const data = {
      text: processedText,
      visible: document.getElementById('showMessage').checked
    };
    
    await postJSON('php/save_message.php', data);
    showToast('メッセージを更新しました');
    
    log('info', `Message saved with line breaks: "${processedText}"`);
    
  } catch (error) {
    log('error', 'Failed to save message:', error);
    showToast('メッセージの保存に失敗しました', 'error');
  }
}

/**
 * メッセージの消去
 */
async function clearMessage() {
  if (!confirm('メッセージを消去しますか？')) return;
  
  document.getElementById('messageText').value = '';
  document.getElementById('showMessage').checked = false;
  updateMessageStats();
  updateMessagePreview();
  
  await saveMessage();
}

/**
 * 設定の保存
 */
async function saveSettings() {
  try {
    const data = {
      interval: parseInt(document.getElementById('waitTime').value) || 20,
      duration: parseInt(document.getElementById('displayTime').value) || 8,
      showTips: document.getElementById('showTips').checked
    };
    
    // 入力値の検証
    if (data.interval < 5 || data.interval > 120) {
      throw new Error('待ち時間は5-120秒の範囲で設定してください');
    }
    
    if (data.duration < 3 || data.duration > 60) {
      throw new Error('表示時間は3-60秒の範囲で設定してください');
    }
    
    await postJSON('php/save_settings.php', data);
    showToast('設定を保存しました');
    
  } catch (error) {
    log('error', 'Failed to save settings:', error);
    showToast(error.message || '設定の保存に失敗しました', 'error');
  }
}

// ─────────────────────────────────────────────────
// UI更新関数
// ─────────────────────────────────────────────────

/**
 * メッセージプレビューの更新
 */
function updateMessagePreview() {
  const messageText = document.getElementById('messageText').value;
  ControlTextHandler.updatePreview(messageText, messagePreviewElement);
}

/**
 * メッセージ統計の更新
 */
function updateMessageStats() {
  const text = document.getElementById('messageText').value;
  const statsElement = document.getElementById('messageStats');
  ControlTextHandler.updateTextStats(text, statsElement, 200);
}

// ─────────────────────────────────────────────────
// データ再読み込み関数
// ─────────────────────────────────────────────────

/**
 * プレイリストの再読み込み
 */
async function refreshPlaylist() {
  try {
    await loadPlaylist();
    await loadAvailableFiles();
    showToast('プレイリストを再読み込みしました');
  } catch (error) {
    showToast('プレイリストの再読み込みに失敗しました', 'error');
  }
}

/**
 * 🔥 新機能: 診察順の再読み込み
 */
async function refreshStatus() {
  try {
    await loadStatus();
    await refreshPreview();
    showToast('診察順を再読み込みしました');
  } catch (error) {
    showToast('診察順の再読み込みに失敗しました', 'error');
  }
}

// ─────────────────────────────────────────────────
// ユーティリティ関数
// ─────────────────────────────────────────────────

/**
 * トースト通知
 */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * 🔥 新機能：ラベル履歴の読み込み
 */
async function loadLabelHistory() {
  try {
    const response = await fetchJSON('data/label_history.json');
    labelHistory = response.history || [];
    updateLabelDatalist();
    log('info', `Loaded ${labelHistory.length} label history items`);
  } catch (error) {
    log('warn', 'Failed to load label history:', error);
    labelHistory = [];
  }
}

/**
 * 🔥 新機能：datalistの更新
 */
function updateLabelDatalist() {
  const datalist1 = document.getElementById('labelHistory1');
  const datalist2 = document.getElementById('labelHistory2');

  if (datalist1) {
    datalist1.innerHTML = '';
    labelHistory.forEach(label => {
      const option = document.createElement('option');
      option.value = label;
      datalist1.appendChild(option);
    });
  }

  if (datalist2) {
    datalist2.innerHTML = '';
    labelHistory.forEach(label => {
      const option = document.createElement('option');
      option.value = label;
      datalist2.appendChild(option);
    });
  }
}

/**
 * 🔥 新機能：ラベル履歴の更新
 */
async function updateLabelHistory(label1, label2) {
  try {
    const labels = [label1, label2].filter(label =>
      label &&
      label.trim() &&
      label.trim() !== '第1診察室' &&
      label.trim() !== '第2診察室'
    );

    if (labels.length === 0) return;

    // 履歴を更新（重複削除・最新を先頭に）
    labels.forEach(label => {
      const trimmedLabel = label.trim();
      labelHistory = labelHistory.filter(item => item !== trimmedLabel);
      labelHistory.unshift(trimmedLabel);
    });

    // 10件に制限
    labelHistory = labelHistory.slice(0, 10);

    // datalistを更新
    updateLabelDatalist();

    const historyData = {
      history: labelHistory,
      lastUpdated: new Date().toISOString()
    };

    await postJSON('php/save_label_history.php', historyData);
    log('info', 'Label history updated');

  } catch (error) {
    log('warn', 'Failed to update label history:', error);
  }
}

// ─────────────────────────────────────────────────
// 待合室システム コントロール画面JavaScript
// 3カード構成版（システム状態削除・機能統合）
// ─────────────────────────────────────────────────

let isInitialized = false;
let messagePreviewElement = null;
let availableFiles = [];
let currentPlaylist = null;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAllData();
    setupEventListeners();
    setupMessagePreview();
    setupPlaylistPreview();
    
    // 数字表示UIの初期化
    initializeNumberDisplays();
    
    isInitialized = true;
    log('info', 'Control panel initialized with simplified 3-card layout');
    showToast('コントロールパネルを初期化しました');
  } catch (error) {
    log('error', 'Control panel initialization failed:', error);
    showToast('システムの初期化に失敗しました', 'error');
  }
});

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
    loadAvailableFiles()
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
 * 診察順の読み込み（数字表示UI対応版）
 */
async function loadStatus() {
  try {
    const status = await fetchJSON('data/status.json');
    
    document.getElementById('room1Label').value = status.room1?.label || '第1診察室';
    document.getElementById('room1Number').value = status.room1?.number || 0;
    document.getElementById('room1Visible').checked = status.room1?.visible || false;
    
    document.getElementById('room2Label').value = status.room2?.label || '第2診察室';
    document.getElementById('room2Number').value = status.room2?.number || 0;
    document.getElementById('room2Visible').checked = status.room2?.visible || false;
    
    // 新しい数字表示UIを更新
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
  
  // 診察順番号の検証
  const numbers = ['room1Number', 'room2Number'];
  numbers.forEach(id => {
    const element = document.getElementById(id);
    element.addEventListener('input', () => {
      const value = parseInt(element.value);
      if (value < 0 || value > 999) {
        element.style.borderColor = '#e74c3c';
      } else {
        element.style.borderColor = '#ddd';
      }
    });
  });
}

// ─────────────────────────────────────────────────
// データ保存関数
// ─────────────────────────────────────────────────

/**
 * 診察順の保存
 */
async function saveStatus() {
  try {
    const data = {
      room1: {
        label: document.getElementById('room1Label').value.trim() || '第1診察室',
        number: parseInt(document.getElementById('room1Number').value) || 0,
        visible: document.getElementById('room1Visible').checked
      },
      room2: {
        label: document.getElementById('room2Label').value.trim() || '第2診察室',
        number: parseInt(document.getElementById('room2Number').value) || 0,
        visible: document.getElementById('room2Visible').checked
      }
    };
    
    await postJSON('php/save_status.php', data);
    showToast('診察順を更新しました');
    
  } catch (error) {
    log('error', 'Failed to save status:', error);
    showToast('診察順の保存に失敗しました', 'error');
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
  
  await saveStatus();
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
 * 診察順の再読み込み
 */
async function refreshStatus() {
  try {
    await loadStatus();
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

// ─────────────────────────────────────────────────
// 定期更新（軽量化）
// ─────────────────────────────────────────────────

/**
 * 定期的なデータ更新
 */
setInterval(async () => {
  if (isInitialized) {
    try {
      await loadPlaylist();
    } catch (error) {
      log('warn', 'Background update failed:', error);
    }
  }
}, 30000); // 30秒間隔
// ─────────────────────────────────────────────────
// 待合室システム コントロール画面JavaScript
// プレイリスト管理機能追加版
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
    isInitialized = true;
    updateSystemStatus('システム準備完了');
    log('info', 'Control panel initialized with playlist support');
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
    loadSystemInfo(),
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
    
    // ファイル一覧を表示
    const availableFilesElement = document.getElementById('availableFiles');
    if (availableFilesElement && availableFiles.length > 0) {
      const fileList = availableFiles.map((file, index) => {
        const letter = String.fromCharCode(65 + index); // A, B, C...
        return `<strong>${letter}</strong>: ${file.displayName} (${file.contentCount}項目)`;
      }).join(' | ');
      availableFilesElement.innerHTML = fileList;
    }
  } catch (error) {
    log('warn', 'Failed to load available files:', error);
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
      updatePlaylistStatus();
    } else {
      document.getElementById('playlistStatus').textContent = '未設定';
    }
  } catch (error) {
    log('warn', 'Failed to load playlist:', error);
  }
}

/**
 * 診察順の読み込み
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
 * 設定の読み込み（新タイミング設定対応）
 */
async function loadSettings() {
  try {
    const settings = await fetchJSON('data/settings.json');
    
    // waitTime/displayTimeに名称変更
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

/**
 * システム情報の読み込み
 */
async function loadSystemInfo() {
  try {
    const response = await fetchJSON('php/get_files.php');
    
    document.getElementById('fileCount').textContent = response.totalFiles || 0;
    document.getElementById('lastUpdate').textContent = response.timestamp || '-';
    
    const details = response.files?.map(file => 
      `${file.displayName} (${file.contentCount}項目)`
    ).join(', ') || 'ファイルなし';
    
    document.getElementById('systemDetails').textContent = details;
    
  } catch (error) {
    log('warn', 'Failed to load system info:', error);
    document.getElementById('systemDetails').textContent = 'システム情報の取得に失敗しました';
  }
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
      updatePlaylistStatus();
    } else {
      throw new Error(response.message || 'プレイリストの保存に失敗しました');
    }
    
  } catch (error) {
    log('error', 'Failed to save playlist:', error);
    showToast(error.message || 'プレイリストの保存に失敗しました', 'error');
  }
}

/**
 * プレイリスト状態の更新
 */
function updatePlaylistStatus() {
  if (currentPlaylist && currentPlaylist.hasPlaylist) {
    const status = `${currentPlaylist.totalFiles}ファイル (${currentPlaylist.totalItems}項目)`;
    document.getElementById('playlistStatus').textContent = status;
    
    // 再生状況の更新
    const progressElement = document.getElementById('playlistProgressDetails');
    if (progressElement && currentPlaylist.currentFile) {
      const progress = `
        現在: ${currentPlaylist.currentFile.displayName}
        ${currentPlaylist.currentFile.currentItem ? 
          `(${currentPlaylist.currentFile.currentItem.index + 1}番目: ${currentPlaylist.currentFile.currentItem.title})` : 
          ''}
        <br>進行: ${currentPlaylist.progress}
      `;
      progressElement.innerHTML = progress;
    }
  } else {
    document.getElementById('playlistStatus').textContent = '未設定';
    document.getElementById('playlistProgressDetails').innerHTML = 'プレイリストが設定されていません';
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
 * 診察順のリセット
 */
async function resetStatus() {
  if (!confirm('診察順をリセットしますか？')) return;
  
  document.getElementById('room1Number').value = 0;
  document.getElementById('room2Number').value = 0;
  document.getElementById('room1Visible').checked = false;
  document.getElementById('room2Visible').checked = false;
  
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
 * 設定の保存（新タイミング設定対応）
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

/**
 * システム状態の更新
 */
function updateSystemStatus(status) {
  document.getElementById('systemStatus').textContent = status;
}

// ─────────────────────────────────────────────────
// データ再読み込み関数
// ─────────────────────────────────────────────────

/**
 * プレイリストの再読み込み
 */
async function refreshPlaylist() {
  try {
    updateSystemStatus('プレイリストを更新中...');
    await loadPlaylist();
    await loadAvailableFiles();
    updateSystemStatus('プレイリストを更新しました');
    showToast('プレイリストを再読み込みしました');
  } catch (error) {
    updateSystemStatus('更新に失敗しました');
    showToast('プレイリストの再読み込みに失敗しました', 'error');
  }
}

/**
 * 診察順の再読み込み
 */
async function refreshStatus() {
  try {
    updateSystemStatus('診察順を更新中...');
    await loadStatus();
    updateSystemStatus('診察順を更新しました');
    showToast('診察順を再読み込みしました');
  } catch (error) {
    updateSystemStatus('更新に失敗しました');
    showToast('診察順の再読み込みに失敗しました', 'error');
  }
}

/**
 * システム情報の再読み込み
 */
async function refreshSystemInfo() {
  try {
    updateSystemStatus('システム情報を更新中...');
    await loadSystemInfo();
    await loadPlaylist();
    updatePlaylistStatus();
    updateSystemStatus('システム情報を更新しました');
    showToast('システム情報を更新しました');
  } catch (error) {
    updateSystemStatus('情報取得に失敗しました');
    showToast('システム情報の取得に失敗しました', 'error');
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
// 定期更新
// ─────────────────────────────────────────────────

/**
 * 定期的なデータ更新
 */
setInterval(async () => {
  if (isInitialized) {
    try {
      await loadSystemInfo();
      await loadPlaylist();
      updatePlaylistStatus();
    } catch (error) {
      log('warn', 'Background update failed:', error);
    }
  }
}, 30000); // 30秒間隔

// ─────────────────────────────────────────────────
// プレイリストUI用のスタイル追加
// ─────────────────────────────────────────────────

// 動的スタイルの追加
const style = document.createElement('style');
style.textContent = `
  .playlist-preview {
    margin: 15px 0;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #dee2e6;
  }
  
  .playlist-items {
    margin-top: 8px;
    font-size: 0.9rem;
    line-height: 1.6;
  }
  
  .playlist-item-valid {
    color: #27ae60;
    font-weight: 500;
  }
  
  .playlist-item-invalid {
    color: #e74c3c;
    font-weight: 500;
  }
  
  .quick-settings {
    margin: 15px 0;
  }
  
  .quick-settings .btn-sm {
    padding: 5px 10px;
    font-size: 0.85rem;
    margin-right: 5px;
  }
  
  .available-files {
    padding: 10px;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #dee2e6;
  }
`;
document.head.appendChild(style);
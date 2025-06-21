// ─────────────────────────────────────────────────
// 待合室システム コントロール画面JavaScript
// 改行対応・設定明確化・プレビュー機能付き
// ─────────────────────────────────────────────────

let isInitialized = false;
let messagePreviewElement = null;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAllData();
    setupEventListeners();
    setupMessagePreview();
    isInitialized = true;
    updateSystemStatus('システム準備完了');
    log('info', 'Control panel initialized with text processing');
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
    loadSystemInfo()
  ]);
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
 * メッセージの読み込み（改行対応）
 */
async function loadMessage() {
  try {
    const message = await fetchJSON('data/message.json');
    
    // JSONから読み込んだテキストをテキストエリアに適切に設定
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
 * 設定の読み込み（明確化）
 */
async function loadSettings() {
  try {
    const settings = await fetchJSON('data/settings.json');
    
    // 切替間隔（コンテンツ間の間隔）
    document.getElementById('switchInterval').value = settings.interval || 20;
    
    // 表示時間（1つのコンテンツの表示時間）
    document.getElementById('displayDuration').value = settings.duration || 8;
    
    // コンテンツ表示ON/OFF
    document.getElementById('showTips').checked = settings.showTips !== false;
    
  } catch (error) {
    log('warn', 'Failed to load settings:', error);
    // デフォルト値を設定
    document.getElementById('switchInterval').value = 20;
    document.getElementById('displayDuration').value = 8;
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
// イベントリスナー設定
// ─────────────────────────────────────────────────

/**
 * イベントリスナーの設定（改行対応）
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
  // 切替間隔の検証
  const switchInterval = document.getElementById('switchInterval');
  switchInterval.addEventListener('input', () => {
    const value = parseInt(switchInterval.value);
    if (value < 5 || value > 120) {
      switchInterval.style.borderColor = '#e74c3c';
    } else {
      switchInterval.style.borderColor = '#ddd';
    }
  });
  
  // 表示時間の検証
  const displayDuration = document.getElementById('displayDuration');
  displayDuration.addEventListener('input', () => {
    const value = parseInt(displayDuration.value);
    if (value < 3 || value > 60) {
      displayDuration.style.borderColor = '#e74c3c';
    } else {
      displayDuration.style.borderColor = '#ddd';
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
 * メッセージの保存（改行対応）
 */
async function saveMessage() {
  try {
    const messageTextElement = document.getElementById('messageText');
    const rawText = messageTextElement.value;
    
    // テキストエリアの改行を保持して処理
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
      interval: parseInt(document.getElementById('switchInterval').value) || 20,
      duration: parseInt(document.getElementById('displayDuration').value) || 8,
      showTips: document.getElementById('showTips').checked
    };
    
    // 入力値の検証
    if (data.interval < 5 || data.interval > 120) {
      throw new Error('切替間隔は5-120秒の範囲で設定してください');
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
 * メッセージ統計の更新（改行カウント対応）
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
    } catch (error) {
      log('warn', 'Background system info update failed:', error);
    }
  }
}, 30000); // 30秒間隔
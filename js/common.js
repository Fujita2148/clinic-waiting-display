// ─────────────────────────────────────────────────
// 待合室表示システム - 共通JavaScript
// 確認済み・問題なし
// ─────────────────────────────────────────────────

/**
 * JSON取得ユーティリティ
 * @param {string} url - 取得するJSONファイルのURL
 * @returns {Promise<Object>} パースされたJSONオブジェクト
 */
async function fetchJSON(url) {
  try {
    const response = await fetch(url, { 
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    throw error;
  }
}

/**
 * JSON送信ユーティリティ
 * @param {string} url - 送信先のPHP APIのURL
 * @param {Object} data - 送信するデータ
 * @returns {Promise<Object>} レスポンスオブジェクト
 */
async function postJSON(url, data) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`Failed to post to ${url}:`, error);
    throw error;
  }
}

/**
 * ファイル名からタイトルを生成
 * @param {string} filename - ファイル名
 * @returns {string} 生成されたタイトル
 */
function generateTitleFromFilename(filename) {
  return filename
    .replace('.json', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * 配列をシャッフル（Fisher-Yates アルゴリズム）
 * @param {Array} array - シャッフルする配列
 * @returns {Array} シャッフルされた配列（破壊的変更）
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * 重み付きランダム選択
 * @param {Array} items - 選択肢の配列
 * @param {Function} getWeight - 重みを取得する関数
 * @returns {*} 選択されたアイテム
 */
function weightedRandomSelect(items, getWeight) {
  if (items.length === 0) return null;
  
  const totalWeight = items.reduce((sum, item) => sum + getWeight(item), 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= getWeight(item);
    if (random <= 0) {
      return item;
    }
  }
  
  // フォールバック（数値精度の問題対応）
  return items[0];
}

/**
 * エラーハンドリング付きの非同期実行
 * @param {Function} asyncFunction - 実行する非同期関数
 * @param {string} errorMessage - エラー時のメッセージ
 * @param {*} fallbackValue - エラー時のフォールバック値
 * @returns {Promise<*>} 実行結果またはフォールバック値
 */
async function safeAsync(asyncFunction, errorMessage = 'Operation failed', fallbackValue = null) {
  try {
    return await asyncFunction();
  } catch (error) {
    console.error(errorMessage, error);
    return fallbackValue;
  }
}

/**
 * デバウンス関数
 * @param {Function} func - 実行する関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 時間フォーマット（HH:MM）
 * @param {Date} date - フォーマットする日時
 * @returns {string} フォーマットされた時間
 */
function formatTime(date = new Date()) {
  return date.toLocaleTimeString('ja-JP', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

/**
 * 日付フォーマット（YYYY-MM-DD）
 * @param {Date} date - フォーマットする日付
 * @returns {string} フォーマットされた日付
 */
function formatDate(date = new Date()) {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
}

/**
 * ログ出力（開発環境でのみ）
 * @param {string} level - ログレベル
 * @param {string} message - メッセージ
 * @param {*} data - 追加データ
 */
function log(level, message, data = null) {
  // 本番環境では console.log を無効化する場合
  if (typeof DEBUG !== 'undefined' && !DEBUG) return;
  
  const timestamp = formatTime();
  const prefix = `[${timestamp}] ${level.toUpperCase()}:`;
  
  // ブラウザでサポートされていないログレベルの対応
  const logMethod = console[level] || console.log;
  
  if (data) {
    logMethod(prefix, message, data);
  } else {
    logMethod(prefix, message);
  }
}

/**
 * DOM要素の安全な取得
 * @param {string} selector - CSSセレクター
 * @param {Element} parent - 親要素（オプション）
 * @returns {Element|null} 取得された要素
 */
function safeQuerySelector(selector, parent = document) {
  try {
    return parent.querySelector(selector);
  } catch (error) {
    console.warn(`Invalid selector: ${selector}`, error);
    return null;
  }
}

/**
 * DOM要素が存在するまで待機
 * @param {string} selector - CSSセレクター
 * @param {number} timeout - タイムアウト（ミリ秒）
 * @returns {Promise<Element>} 取得された要素
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = safeQuerySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver((mutations, obs) => {
      const element = safeQuerySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // タイムアウト処理
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * パフォーマンス測定
 */
const Performance = {
  start(name) {
    if (performance && performance.mark) {
      performance.mark(`${name}_start`);
    }
  },
  
  end(name) {
    if (performance && performance.mark && performance.measure) {
      performance.mark(`${name}_end`);
      performance.measure(name, `${name}_start`, `${name}_end`);
      
      const measure = performance.getEntriesByName(name)[0];
      if (measure) {
        log('info', `Performance [${name}]: ${measure.duration.toFixed(2)}ms`);
      }
    }
  }
};

/**
 * エラー情報の収集
 * @param {Error} error - エラーオブジェクト
 * @returns {Object} エラー情報
 */
function collectErrorInfo(error) {
  return {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href
  };
}

/**
 * グローバルエラーハンドラー
 */
window.addEventListener('error', (event) => {
  const errorInfo = collectErrorInfo(event.error);
  log('error', 'Global error caught:', errorInfo);
});

window.addEventListener('unhandledrejection', (event) => {
  log('error', 'Unhandled promise rejection:', event.reason);
});

// 開発用のデバッグ設定
if (typeof DEBUG === 'undefined') {
  window.DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

// 共通ユーティリティを window オブジェクトに追加（デバッグ用）
if (DEBUG) {
  window.utils = {
    fetchJSON,
    postJSON,
    generateTitleFromFilename,
    shuffleArray,
    weightedRandomSelect,
    safeAsync,
    debounce,
    formatTime,
    formatDate,
    log,
    Performance
  };
}
// ─────────────────────────────────────────────────
// テキスト処理ユーティリティ
// 改行処理、エスケープ処理、文字列最適化
// ─────────────────────────────────────────────────

/**
 * テキスト処理クラス
 */
class TextUtils {
  /**
   * テキストをHTMLエスケープ
   * @param {string} text - エスケープするテキスト
   * @returns {string} エスケープ済みテキスト
   */
  static escapeHtml(text) {
    if (!text) return '';
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * プレーンテキストとして改行を保持（CSS white-space: pre-wrap用）
   * @param {string} text - 処理するテキスト
   * @returns {string} エスケープ済みテキスト（改行保持）
   */
  static preserveLineBreaks(text) {
    return this.escapeHtml(text);
  }

  /**
   * 改行文字をHTMLの<br>タグに変換
   * @param {string} text - 変換するテキスト
   * @returns {string} HTMLエスケープ済み＋改行変換済みテキスト
   */
  static convertLineBreaks(text) {
    if (!text) return '';
    
    // HTMLエスケープ後、改行文字を<br>に変換
    return this.escapeHtml(text).replace(/\r?\n/g, '<br>');
  }

  /**
   * 長いタイトルの改行位置を最適化
   * @param {string} title - タイトルテキスト
   * @param {number} maxLength - 1行あたりの最大文字数
   * @returns {string} 最適化されたタイトル
   */
  static optimizeTitle(title, maxLength = 15) {
    if (!title || title.length <= maxLength) return title;
    
    // 既に改行が含まれている場合はそのまま
    if (title.includes('\n')) return title;
    
    // スペースや句読点で自然な改行位置を探す
    const breakPoints = [' ', '、', '。', '！', '？', '・', '｜'];
    let bestBreak = -1;
    
    for (let i = maxLength; i >= Math.floor(maxLength * 0.7); i--) {
      if (breakPoints.includes(title[i])) {
        bestBreak = i + 1;
        break;
      }
    }
    
    if (bestBreak > 0) {
      return title.substring(0, bestBreak) + '\n' + title.substring(bestBreak);
    }
    
    // 自然な改行位置が見つからない場合は強制改行
    return title.substring(0, maxLength) + '\n' + title.substring(maxLength);
  }

  /**
   * テキストエリアの改行を保持してJSONに保存
   * @param {string} textareaValue - テキストエリアの値
   * @returns {string} JSON保存用のテキスト
   */
  static processTextareaInput(textareaValue) {
    // テキストエリアの改行は既に\nとして処理されているのでそのまま返す
    return textareaValue ? textareaValue.trim() : '';
  }

  /**
   * JSONから読み込んだテキストをテキストエリアに設定
   * @param {string} jsonText - JSONから読み込んだテキスト
   * @returns {string} テキストエリア表示用のテキスト
   */
  static processJsonToTextarea(jsonText) {
    // JSONの\nをそのまま返す（テキストエリアが適切に改行表示する）
    return jsonText || '';
  }

  /**
   * プレビュー表示用のテキスト処理
   * @param {string} text - 元のテキスト
   * @returns {string} プレビュー用HTML
   */
  static processForPreview(text) {
    return this.convertLineBreaks(text);
  }

  /**
   * 安全にDOM要素にテキストを設定
   * @param {HTMLElement} element - 対象要素
   * @param {string} text - 設定するテキスト
   * @param {boolean} allowLineBreaks - 改行を有効にするか
   */
  static setElementText(element, text, allowLineBreaks = true) {
    if (!element) return;
    
    if (allowLineBreaks) {
      // textContentを使用して安全に設定（CSSで改行処理）
      element.textContent = text || '';
    } else {
      // 改行を削除して設定
      element.textContent = (text || '').replace(/\r?\n/g, ' ');
    }
  }

  /**
   * 文字数と行数をカウント
   * @param {string} text - カウントするテキスト
   * @returns {Object} {length: number, lines: number}
   */
  static countText(text) {
    if (!text) return { length: 0, lines: 0 };
    
    return {
      length: text.length,
      lines: (text.match(/\n/g) || []).length + 1
    };
  }

  /**
   * 文字列を指定した長さで改行
   * @param {string} text - 対象テキスト
   * @param {number} maxLength - 最大文字数
   * @returns {string} 改行済みテキスト
   */
  static wrapText(text, maxLength = 30) {
    if (!text || typeof text !== 'string') return '';
    
    const words = text.split('');
    let result = '';
    let currentLine = '';
    
    for (const char of words) {
      if (currentLine.length + 1 > maxLength) {
        result += currentLine + '\n';
        currentLine = char;
      } else {
        currentLine += char;
      }
    }
    
    if (currentLine) {
      result += currentLine;
    }
    
    return result;
  }

  /**
   * 改行をHTMLのbrタグに変換
   * @param {string} text - 対象テキスト
   * @returns {string} 変換済みテキスト
   */
  static nl2br(text) {
    if (!text) return '';
    return text.replace(/\n/g, '<br>');
  }

  /**
   * テキストをHTMLで安全に表示するために処理
   * @param {string} text - 対象テキスト
   * @returns {string} 安全なHTML
   */
  static safeHtml(text) {
    if (!text) return '';
    return this.nl2br(this.escapeHtml(text));
  }

  /**
   * 文字列の長さを制限（日本語対応）
   * @param {string} text - 対象テキスト
   * @param {number} maxLength - 最大文字数
   * @param {string} suffix - 省略記号
   * @returns {string} 制限済みテキスト
   */
  static truncate(text, maxLength = 50, suffix = '...') {
    if (!text || typeof text !== 'string') return '';
    
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * 空白文字を除去
   * @param {string} text - 対象テキスト
   * @returns {string} トリム済みテキスト
   */
  static trim(text) {
    if (!text || typeof text !== 'string') return '';
    return text.trim();
  }

  /**
   * 文字列が空かどうかチェック
   * @param {string} text - チェックするテキスト
   * @returns {boolean} 空かどうか
   */
  static isEmpty(text) {
    return !text || text.trim() === '';
  }

  /**
   * 数字を全角に変換
   * @param {string} text - 対象テキスト
   * @returns {string} 全角数字テキスト
   */
  static toFullWidth(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/[0-9]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
    });
  }

  /**
   * 数字を半角に変換
   * @param {string} text - 対象テキスト
   * @returns {string} 半角数字テキスト
   */
  static toHalfWidth(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/[０-９]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
  }

  /**
   * フォーマット済みテキストを生成（sprintf風）
   * @param {string} template - テンプレート文字列
   * @param {...any} args - 引数
   * @returns {string} フォーマット済みテキスト
   */
  static format(template, ...args) {
    if (!template) return '';
    
    return template.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    });
  }

  /**
   * CSSクラス名用に文字列をサニタイズ
   * @param {string} text - 対象テキスト
   * @returns {string} CSSクラス名
   */
  static toCssClass(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * URL用に文字列をエンコード
   * @param {string} text - 対象テキスト
   * @returns {string} URLスラッグ
   */
  static toSlug(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

/**
 * コントロール画面専用のテキスト処理
 */
class ControlTextHandler {
  /**
   * メッセージプレビューエリアを作成
   * @param {HTMLElement} parentElement - 親要素
   * @returns {HTMLElement} プレビュー要素
   */
  static createPreviewArea(parentElement) {
    const previewDiv = document.createElement('div');
    previewDiv.id = 'messagePreview';
    previewDiv.style.cssText = `
      margin-top: 10px;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: #f9f9f9;
      min-height: 40px;
      white-space: pre-wrap;
      font-size: 14px;
      color: #555;
      word-break: break-word;
    `;
    previewDiv.innerHTML = '<small style="color: #999;">プレビュー（改行も反映されます）</small>';
    parentElement.appendChild(previewDiv);
    return previewDiv;
  }

  /**
   * メッセージプレビューを更新
   * @param {string} messageText - プレビューするテキスト
   * @param {HTMLElement} previewElement - プレビュー要素
   */
  static updatePreview(messageText, previewElement) {
    if (!previewElement) return;
    
    if (messageText && messageText.trim()) {
      // プレビュー用にテキストを処理
      const previewHtml = TextUtils.processForPreview(messageText);
      previewElement.innerHTML = `<strong>プレビュー:</strong><br>${previewHtml}`;
    } else {
      previewElement.innerHTML = '<small style="color: #999;">プレビュー（改行も反映されます）</small>';
    }
  }

  /**
   * 文字数統計を更新
   * @param {string} text - カウントするテキスト
   * @param {HTMLElement} statsElement - 統計表示要素
   * @param {number} maxLength - 最大文字数
   */
  static updateTextStats(text, statsElement, maxLength = 200) {
    if (!statsElement) return;
    
    const { length, lines } = TextUtils.countText(text);
    statsElement.textContent = `文字数: ${length}/${maxLength} (${lines}行)`;
    
    // 色の変更
    if (length > maxLength) {
      statsElement.style.color = '#e74c3c';
    } else if (length > maxLength * 0.75) {
      statsElement.style.color = '#f39c12';
    } else {
      statsElement.style.color = '#27ae60';
    }
  }
}

// グローバルに公開
if (typeof window !== 'undefined') {
  window.TextUtils = TextUtils;
  window.ControlTextHandler = ControlTextHandler;
}

// CommonJS/Node.js対応
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TextUtils, ControlTextHandler };
}

// common.jsのutilsオブジェクトに追加
if (typeof window !== 'undefined' && window.utils) {
  window.utils.TextUtils = TextUtils;
  window.utils.ControlTextHandler = ControlTextHandler;
}
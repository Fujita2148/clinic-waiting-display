/**
 * TextUtils - テキスト処理ユーティリティクラス
 * 待合室表示システム用
 */
class TextUtils {
    /**
     * 文字列を指定した長さで改行
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
     * HTMLエスケープ
     */
    static escapeHtml(text) {
        if (!text) return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * 改行をHTMLのbrタグに変換
     */
    static nl2br(text) {
        if (!text) return '';
        return text.replace(/\n/g, '<br>');
    }
    
    /**
     * テキストをHTMLで安全に表示するために処理
     */
    static safeHtml(text) {
        if (!text) return '';
        return this.nl2br(this.escapeHtml(text));
    }
    
    /**
     * 文字列の長さを制限（日本語対応）
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
     */
    static trim(text) {
        if (!text || typeof text !== 'string') return '';
        return text.trim();
    }
    
    /**
     * カタカナをひらがなに変換
     */
    static katakanaToHiragana(text) {
        if (!text || typeof text !== 'string') return '';
        return text.replace(/[\u30a1-\u30f6]/g, function(match) {
            const chr = match.charCodeAt(0) - 0x60;
            return String.fromCharCode(chr);
        });
    }
    
    /**
     * ひらがなをカタカナに変換
     */
    static hiraganaToKatakana(text) {
        if (!text || typeof text !== 'string') return '';
        return text.replace(/[\u3041-\u3096]/g, function(match) {
            const chr = match.charCodeAt(0) + 0x60;
            return String.fromCharCode(chr);
        });
    }
    
    /**
     * 文字列が空かどうかチェック
     */
    static isEmpty(text) {
        return !text || text.trim() === '';
    }
    
    /**
     * 数字を全角に変換
     */
    static toFullWidth(text) {
        if (!text || typeof text !== 'string') return '';
        return text.replace(/[0-9]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
        });
    }
    
    /**
     * 数字を半角に変換
     */
    static toHalfWidth(text) {
        if (!text || typeof text !== 'string') return '';
        return text.replace(/[０-９]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        });
    }
    
    /**
     * フォーマット済みテキストを生成（sprintf風）
     */
    static format(template, ...args) {
        if (!template) return '';
        
        return template.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });
    }
    
    /**
     * CSSクラス名用に文字列をサニタイズ
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

// グローバルスコープに公開
if (typeof window !== 'undefined') {
    window.TextUtils = TextUtils;
}

// CommonJS/Node.js対応
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextUtils;
}
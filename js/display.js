// ─────────────────────────────────────────────────
// 待合室表示システム - 表示制御JavaScript
// 順番表示完全対応・改行対応・レイアウト改善版
// ─────────────────────────────────────────────────

/**
 * 表示管理クラス（順番表示完全対応版）
 */
class DisplayManager {
  constructor() {
    // DOM要素
    this.categoryTitle = null;
    this.mainContent = null;
    this.messageArea = null;
    this.statusCard = null;
    
    // データ
    this.contentFiles = [];
    this.loadedContents = {};
    this.settings = {
      interval: 20,    // コンテンツ切替間隔（秒）
      duration: 8,     // コンテンツ表示時間（秒）
      showTips: true   // コンテンツ表示ON/OFF
    };
    this.message = { text: '', visible: false };
    this.status = {
      room1: { label: '第1診察室', number: 0, visible: false },
      room2: { label: '第2診察室', number: 0, visible: false }
    };
    
    // 表示制御
    this.contentQueue = [];
    this.currentIndex = 0;
    this.displayInterval = null;
    this.dataInterval = null;
    this.isInitialized = false;
    
    // 順番表示専用
    this.sequentialFiles = {};       // 連続表示ファイルの管理
    this.currentSequentialFile = 0;  // 現在の連続表示ファイルインデックス
    this.displayModeCache = {};      // 表示モードキャッシュ
  }

  /**
   * 初期化
   */
  async init() {
    try {
      Performance.start('display_init');
      
      // DOM要素の取得
      this.initializeElements();
      
      // 初期データ読み込み
      await this.loadAllData();
      
      // コンテンツキューの構築
      this.buildContentQueue();
      
      // 初期表示
      this.renderStatus();
      this.renderMessage();
      this.updateTitle();
      
      // 表示開始
      if (this.hasContent() && this.settings.showTips) {
        this.startDisplay();
      } else {
        this.showFallback();
      }
      
      // 定期データ更新開始
      this.startDataPolling();
      
      this.isInitialized = true;
      Performance.end('display_init');
      log('info', 'Display manager initialized successfully with sequential support');
      
    } catch (error) {
      log('error', 'Failed to initialize display manager:', error);
      this.showError('システムの初期化に失敗しました');
    }
  }

  /**
   * DOM要素の初期化
   */
  initializeElements() {
    this.categoryTitle = safeQuerySelector('#categoryTitle');
    this.mainContent = safeQuerySelector('#mainContent');
    this.messageArea = safeQuerySelector('#messageArea');
    this.statusCard = safeQuerySelector('#statusCard');
    
    if (!this.categoryTitle || !this.mainContent || !this.messageArea || !this.statusCard) {
      throw new Error('Required DOM elements not found');
    }
    
    // 背景動画の処理
    this.initializeBackgroundVideo();
  }

  /**
   * 背景動画の初期化
   */
  initializeBackgroundVideo() {
    const bgVideo = safeQuerySelector('#bg-video');
    if (bgVideo) {
      bgVideo.addEventListener('canplay', () => {
        bgVideo.style.display = 'block';
        log('info', 'Background video loaded');
      });
      
      bgVideo.addEventListener('error', () => {
        bgVideo.style.display = 'none';
        log('warn', 'Background video failed to load');
      });
    }
  }

  /**
   * 全データの読み込み
   */
  async loadAllData() {
    await Promise.all([
      this.loadContentFiles(),
      this.loadSettings(),
      this.loadMessage(),
      this.loadStatus()
    ]);
    
    await this.loadEnabledContents();
  }

  /**
   * コンテンツファイル一覧の読み込み
   */
  async loadContentFiles() {
    try {
      const response = await fetchJSON('php/get_files.php');
      this.contentFiles = response.files || [];
      log('info', `Loaded ${this.contentFiles.length} content files`);
    } catch (error) {
      log('warn', 'Failed to load content files:', error);
      this.contentFiles = [];
    }
  }

  /**
   * 設定の読み込み
   */
  async loadSettings() {
    this.settings = await safeAsync(
      () => fetchJSON('data/settings.json'),
      'Failed to load settings',
      {
        interval: 20,    // コンテンツ切替間隔
        duration: 8,     // コンテンツ表示時間
        showTips: true,  // コンテンツ表示ON/OFF
        files: {}
      }
    );
  }

  /**
   * メッセージの読み込み
   */
  async loadMessage() {
    this.message = await safeAsync(
      () => fetchJSON('data/message.json'),
      'Failed to load message',
      { text: '', visible: false }
    );
  }

  /**
   * 診察順の読み込み
   */
  async loadStatus() {
    this.status = await safeAsync(
      () => fetchJSON('data/status.json'),
      'Failed to load status',
      {
        room1: { label: '第1診察室', number: 0, visible: false },
        room2: { label: '第2診察室', number: 0, visible: false }
      }
    );
  }

  /**
   * 有効なコンテンツの読み込み
   */
  async loadEnabledContents() {
    this.loadedContents = {};
    
    for (const file of this.contentFiles) {
      const fileSettings = this.settings.files && this.settings.files[file.filename];
      
      // デフォルト設定
      const enabled = fileSettings ? fileSettings.enabled !== false : true;
      
      if (enabled) {
        try {
          const rawData = await fetchJSON(`data/contents/${file.filename}`);
          
          let contentData, metaData;
          
          if (rawData.meta && rawData.items) {
            // 新フォーマット
            metaData = rawData.meta;
            contentData = rawData.items;
          } else if (Array.isArray(rawData)) {
            // 旧フォーマット（フォールバック）
            contentData = rawData;
            metaData = {
              title: generateTitleFromFilename(file.filename),
              icon: "💡",
              displayMode: "random"
            };
          } else {
            throw new Error('Invalid JSON format');
          }
          
          // 表示モードの決定（優先順位: ファイル設定 > メタデータ > デフォルト）
          const displayMode = (fileSettings && fileSettings.displayMode) || 
                            metaData.displayMode || 
                            'random';
          
          this.loadedContents[file.filename] = {
            data: contentData,
            meta: metaData,
            settings: {
              duration: (fileSettings && fileSettings.duration) || this.settings.duration || 8,
              weight: (fileSettings && fileSettings.weight) || 1,
              displayMode: displayMode
            }
          };
          
          // 表示モードキャッシュに保存
          this.displayModeCache[file.filename] = displayMode;
          
          log('info', `Loaded content: ${file.filename} (${contentData.length} items, mode: ${displayMode})`);
          
        } catch (error) {
          log('warn', `Failed to load content ${file.filename}:`, error);
        }
      }
    }
  }

  /**
   * コンテンツキューの構築（順番表示完全対応版）
   */
  buildContentQueue() {
    this.contentQueue = [];
    this.sequentialFiles = {};
    
    // ファイル別に表示モードで分類
    const randomFiles = [];
    const orderFiles = [];
    const sequentialFiles = [];
    
    Object.entries(this.loadedContents).forEach(([filename, contentObj]) => {
      const { data, meta, settings } = contentObj;
      const displayMode = settings.displayMode || 'random';
      
      switch (displayMode) {
        case 'sequence':
          sequentialFiles.push({ filename, contentObj });
          // 連続表示ファイルの状態を初期化
          this.sequentialFiles[filename] = {
            currentIndex: 0,
            items: data,
            meta: meta,
            settings: settings,
            totalItems: data.length
          };
          break;
          
        case 'order':
          orderFiles.push({ filename, contentObj });
          break;
          
        default: // 'random'
          randomFiles.push({ filename, contentObj });
          break;
      }
    });
    
    // 1. 連続表示ファイルがある場合
    if (sequentialFiles.length > 0) {
      this.currentSequentialFile = 0;
      log('info', `Sequential mode: ${sequentialFiles.length} files will be displayed in order`);
      
      // 順番表示がメインの場合はキューは使わない
      if (randomFiles.length === 0 && orderFiles.length === 0) {
        log('info', 'Pure sequential mode activated');
        return;
      }
    }
    
    // 2. 順番表示ファイルの処理
    orderFiles.forEach(({ filename, contentObj }) => {
      const { data, meta, settings } = contentObj;
      data.forEach((item, index) => {
        this.contentQueue.push({
          filename,
          item,
          index,
          meta,
          settings,
          originalOrder: index, // 元の順番を保持
          displayMode: 'order'
        });
      });
    });
    
    // 3. ランダム表示ファイルの処理（重み付き）
    randomFiles.forEach(({ filename, contentObj }) => {
      const { data, meta, settings } = contentObj;
      const weight = settings.weight || 1;
      
      data.forEach((item, index) => {
        for (let i = 0; i < weight; i++) {
          this.contentQueue.push({
            filename,
            item,
            index,
            meta,
            settings,
            displayMode: 'random'
          });
        }
      });
    });
    
    // 4. ランダム部分のみシャッフル（順番表示部分は保持）
    if (randomFiles.length > 0) {
      const randomPart = this.contentQueue.filter(item => item.displayMode === 'random');
      const orderPart = this.contentQueue.filter(item => item.displayMode === 'order');
      
      shuffleArray(randomPart);
      
      // 順番表示とランダム表示を適切に配置
      this.contentQueue = [...orderPart, ...randomPart];
    }
    
    this.currentIndex = 0;
    
    log('info', `Built content queue: ${this.contentQueue.length} items, sequential files: ${Object.keys(this.sequentialFiles).length}`);
  }

  /**
   * コンテンツがあるかチェック
   */
  hasContent() {
    return (Object.keys(this.sequentialFiles).length > 0) || (this.contentQueue.length > 0);
  }

  /**
   * 表示開始（順番表示対応版）
   */
  startDisplay() {
    if (this.displayInterval) {
      clearInterval(this.displayInterval);
    }
    
    if (!this.settings.showTips) {
      log('info', 'Content display is disabled');
      return;
    }
    
    if (!this.hasContent()) {
      log('info', 'No content available');
      return;
    }
    
    // 連続表示の初期化
    if (Object.keys(this.sequentialFiles).length > 0) {
      this.currentSequentialFile = 0;
      
      // 保存された表示位置を復元
      this.loadSequentialProgress();
    }
    
    // 初回表示
    this.showNextContent();
    
    // 定期表示（切替間隔で制御）
    this.displayInterval = setInterval(() => {
      this.showNextContent();
    }, this.settings.interval * 1000);
    
    const mode = Object.keys(this.sequentialFiles).length > 0 ? 'sequential' : 'queue';
    log('info', `Display started in ${mode} mode with interval: ${this.settings.interval}s`);
  }

  /**
   * 次のコンテンツを表示（順番表示対応版）
   */
  showNextContent() {
    if (!this.settings.showTips) {
      return;
    }
    
    // 連続表示ファイルがある場合の処理
    if (Object.keys(this.sequentialFiles).length > 0) {
      this.showSequentialContent();
      return;
    }
    
    // 通常のキュー表示
    if (this.contentQueue.length === 0) {
      return;
    }
    
    const content = this.contentQueue[this.currentIndex];
    const { item, meta, settings } = content;
    
    // カテゴリタイトル更新
    this.updateTitle(meta);
    
    // メインコンテンツ表示
    this.displayContent(item, settings);
    
    // 次のインデックス
    this.currentIndex = (this.currentIndex + 1) % this.contentQueue.length;
    
    // 一周したらランダム部分のみシャッフル
    if (this.currentIndex === 0) {
      this.reshuffleRandomContent();
    }
  }

  /**
   * 連続表示の処理（完全版）
   */
  showSequentialContent() {
    const fileNames = Object.keys(this.sequentialFiles);
    if (fileNames.length === 0) return;
    
    // 現在のファイル
    const currentFileName = fileNames[this.currentSequentialFile];
    const fileData = this.sequentialFiles[currentFileName];
    
    if (!fileData || fileData.currentIndex >= fileData.items.length) {
      // 現在のファイルが終了、次のファイルへ
      this.currentSequentialFile = (this.currentSequentialFile + 1) % fileNames.length;
      
      // 全ファイルが一周した場合、全てリセット
      if (this.currentSequentialFile === 0) {
        Object.keys(this.sequentialFiles).forEach(filename => {
          this.sequentialFiles[filename].currentIndex = 0;
        });
        log('info', 'Sequential display completed one full cycle, restarting from beginning');
      } else {
        log('info', `Sequential display: Moving to next file (${fileNames[this.currentSequentialFile]})`);
      }
      
      // 進捗を保存
      this.saveSequentialProgress();
      
      // 再帰的に次のコンテンツを取得
      this.showSequentialContent();
      return;
    }
    
    // 現在のアイテムを表示
    const item = fileData.items[fileData.currentIndex];
    const meta = fileData.meta;
    const settings = fileData.settings;
    
    // カテゴリタイトル更新
    this.updateTitle(meta);
    
    // メインコンテンツ表示
    this.displayContent(item, settings);
    
    // 次のアイテムへ
    this.sequentialFiles[currentFileName].currentIndex++;
    
    // 進捗を保存
    this.saveSequentialProgress();
    
    log('debug', `Sequential: ${currentFileName} [${fileData.currentIndex}/${fileData.totalItems}] - ${item.title}`);
  }

  /**
   * ランダムコンテンツのみ再シャッフル
   */
  reshuffleRandomContent() {
    const randomPart = this.contentQueue.filter(item => item.displayMode === 'random');
    const otherPart = this.contentQueue.filter(item => item.displayMode !== 'random');
    
    if (randomPart.length > 0) {
      shuffleArray(randomPart);
      this.contentQueue = [...otherPart, ...randomPart];
      log('info', 'Random content reshuffled, sequential order preserved');
    }
  }

  /**
   * 順番表示の進捗を保存
   */
  saveSequentialProgress() {
    try {
      const progress = {
        currentFile: this.currentSequentialFile,
        fileProgress: {}
      };
      
      Object.entries(this.sequentialFiles).forEach(([filename, data]) => {
        progress.fileProgress[filename] = data.currentIndex;
      });
      
      localStorage.setItem('sequentialProgress', JSON.stringify(progress));
    } catch (error) {
      log('warn', 'Failed to save sequential progress:', error);
    }
  }

  /**
   * 順番表示の進捗を読み込み
   */
  loadSequentialProgress() {
    try {
      const saved = localStorage.getItem('sequentialProgress');
      if (saved) {
        const progress = JSON.parse(saved);
        
        this.currentSequentialFile = progress.currentFile || 0;
        
        if (progress.fileProgress) {
          Object.entries(progress.fileProgress).forEach(([filename, index]) => {
            if (this.sequentialFiles[filename]) {
              this.sequentialFiles[filename].currentIndex = index;
            }
          });
        }
        
        log('info', 'Sequential progress restored');
      }
    } catch (error) {
      log('warn', 'Failed to load sequential progress:', error);
    }
  }

  /**
   * 順番表示をリセット
   */
  resetSequentialProgress() {
    Object.keys(this.sequentialFiles).forEach(filename => {
      this.sequentialFiles[filename].currentIndex = 0;
    });
    this.currentSequentialFile = 0;
    
    try {
      localStorage.removeItem('sequentialProgress');
    } catch (error) {
      log('warn', 'Failed to clear sequential progress:', error);
    }
    
    log('info', 'Sequential progress reset to beginning');
  }

  /**
   * コンテンツの表示（改行対応版）
   */
  displayContent(item, settings) {
    const duration = settings.duration || this.settings.duration || 8;
    
    // フェードアウト
    this.mainContent.classList.remove('show');
    
    setTimeout(() => {
      // コンテンツ更新（安全にテキスト設定）
      this.mainContent.innerHTML = '';
      
      const titleElement = document.createElement('h2');
      const textElement = document.createElement('p');
      
      // タイトルとテキストを安全に設定（改行保持）
      TextUtils.setElementText(titleElement, `${item.icon || '💡'} ${item.title}`, true);
      TextUtils.setElementText(textElement, item.text, true);
      
      this.mainContent.appendChild(titleElement);
      this.mainContent.appendChild(textElement);
      
      // フェードイン
      this.mainContent.classList.add('show');
    }, 300);
    
    // 自動フェードアウト（表示時間で制御）
    setTimeout(() => {
      this.mainContent.classList.remove('show');
    }, duration * 1000);
    
    log('debug', `Displayed content for ${duration}s: ${item.title}`);
  }

  /**
   * カテゴリタイトルの更新（改行対応版）
   */
  updateTitle(meta = null) {
    if (!this.categoryTitle) return;
    
    let titleText = '';
    
    if (meta) {
      titleText = `${meta.icon || '💡'} ${meta.title}`;
    } else if (Object.keys(this.loadedContents).length > 0) {
      const firstContent = Object.values(this.loadedContents)[0];
      titleText = `${firstContent.meta.icon || '💡'} ${firstContent.meta.title}`;
    } else {
      titleText = '💡 待合室表示システム';
    }
    
    // タイトルの長さをチェックして改行処理
    const processedTitle = TextUtils.optimizeTitle(titleText, 15);
    
    // 改行が含まれている場合はmulti-lineクラスを追加
    if (processedTitle.includes('\n')) {
      this.categoryTitle.classList.add('multi-line');
    } else {
      this.categoryTitle.classList.remove('multi-line');
    }
    
    // テキストを安全に設定
    TextUtils.setElementText(this.categoryTitle, processedTitle, true);
  }

  /**
   * メッセージ表示（改行対応版）
   */
  renderMessage() {
    if (!this.messageArea) return;
    
    if (this.message.visible && this.message.text) {
      // メッセージを安全に処理
      this.messageArea.innerHTML = '';
      const messageElement = document.createElement('p');
      TextUtils.setElementText(messageElement, this.message.text, true);
      this.messageArea.appendChild(messageElement);
      
      this.messageArea.classList.add('show');
    } else {
      this.messageArea.classList.remove('show');
    }
  }

  /**
   * 診察順表示
   */
  renderStatus() {
    if (!this.statusCard) return;
    
    const r1 = this.status.room1 || {};
    const r2 = this.status.room2 || {};
    
    const hasVisibleRoom = (r1.visible && r1.number > 0) || (r2.visible && r2.number > 0);
    
    if (!hasVisibleRoom) {
      this.statusCard.style.display = 'none';
      return;
    }
    
    this.statusCard.style.display = 'block';
    this.statusCard.innerHTML = `
      <h4>🩺 診察順のご案内</h4>
      ${r1.visible && r1.number > 0 ? `
        <div class="room-info">
          <div class="room-label">${r1.label || '第1診察室'}</div>
          <div class="room-number">${r1.number}</div>
        </div>
      ` : ''}
      ${r2.visible && r2.number > 0 ? `
        <div class="room-info">
          <div class="room-label">${r2.label || '第2診察室'}</div>
          <div class="room-number">${r2.number}</div>
        </div>
      ` : ''}
    `;
  }

  /**
   * 定期データ更新の開始
   */
  startDataPolling() {
    if (this.dataInterval) {
      clearInterval(this.dataInterval);
    }
    
    this.dataInterval = setInterval(async () => {
      try {
        const oldInterval = this.settings.interval;
        const oldShowTips = this.settings.showTips;
        
        // 設定とデータの更新
        await Promise.all([
          this.loadSettings(),
          this.loadMessage(),
          this.loadStatus()
        ]);
        
        // UI更新
        this.renderStatus();
        this.renderMessage();
        
        // 表示間隔やコンテンツ表示設定の変更チェック
        if (this.settings.interval !== oldInterval || this.settings.showTips !== oldShowTips) {
          log('info', `Settings changed: interval ${oldInterval}→${this.settings.interval}, showTips ${oldShowTips}→${this.settings.showTips}`);
          
          // 表示制御の再開始
          if (this.displayInterval) {
            clearInterval(this.displayInterval);
          }
          
          if (this.settings.showTips && this.hasContent()) {
            this.startDisplay();
          }
        }
        
      } catch (error) {
        log('warn', 'Data polling error:', error);
      }
    }, 5000); // 5秒間隔
  }

  /**
   * フォールバック表示
   */
  showFallback() {
    TextUtils.setElementText(this.categoryTitle, '💡 待合室表示システム', false);
    
    const fallbackTips = [
      { icon: '💡', title: 'システム準備中', text: 'コンテンツを読み込んでいます。しばらくお待ちください。' },
      { icon: '🌟', title: 'お知らせ', text: 'システムの準備が完了次第、表示を開始いたします。' }
    ];
    
    let currentTip = 0;
    
    const showFallback = () => {
      const tip = fallbackTips[currentTip];
      this.mainContent.innerHTML = '';
      
      const titleElement = document.createElement('h2');
      const textElement = document.createElement('p');
      
      TextUtils.setElementText(titleElement, `${tip.icon} ${tip.title}`, false);
      TextUtils.setElementText(textElement, tip.text, false);
      
      this.mainContent.appendChild(titleElement);
      this.mainContent.appendChild(textElement);
      this.mainContent.classList.add('show');
      
      setTimeout(() => {
        this.mainContent.classList.remove('show');
      }, 5000);
      
      currentTip = (currentTip + 1) % fallbackTips.length;
    };
    
    showFallback();
    this.displayInterval = setInterval(showFallback, 10000);
  }

  /**
   * エラー表示
   */
  showError(message) {
    TextUtils.setElementText(this.categoryTitle, '⚠️ システムエラー', false);
    
    this.mainContent.innerHTML = '';
    const titleElement = document.createElement('h2');
    const textElement = document.createElement('p');
    
    TextUtils.setElementText(titleElement, 'システムエラー', false);
    TextUtils.setElementText(textElement, message, false);
    
    this.mainContent.appendChild(titleElement);
    this.mainContent.appendChild(textElement);
    this.mainContent.classList.add('show', 'error');
  }

  /**
   * 破棄
   */
  destroy() {
    if (this.displayInterval) {
      clearInterval(this.displayInterval);
    }
    if (this.dataInterval) {
      clearInterval(this.dataInterval);
    }
    this.isInitialized = false;
    log('info', 'Display manager destroyed');
  }

  /**
   * 現在の表示状態を取得（デバッグ用）
   */
  getDisplayStatus() {
    const status = {
      isSequentialMode: Object.keys(this.sequentialFiles).length > 0,
      currentSequentialFile: this.currentSequentialFile,
      sequentialFiles: {},
      queueLength: this.contentQueue.length,
      currentQueueIndex: this.currentIndex
    };
    
    Object.entries(this.sequentialFiles).forEach(([filename, data]) => {
      status.sequentialFiles[filename] = {
        currentIndex: data.currentIndex,
        totalItems: data.totalItems,
        progress: `${data.currentIndex + 1}/${data.totalItems}`
      };
    });
    
    return status;
  }
}

// ─────────────────────────────────────────────────
// 初期化
// ─────────────────────────────────────────────────

let displayManager = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    log('info', 'Starting display system initialization');
    
    displayManager = new DisplayManager();
    await displayManager.init();
    
  } catch (error) {
    log('error', 'Failed to start display system:', error);
    
    // 緊急フォールバック
    const mainContent = safeQuerySelector('#mainContent');
    if (mainContent) {
      mainContent.innerHTML = `
        <h2>⚠️ システムエラー</h2>
        <p>表示システムの起動に失敗しました。管理者にお問い合わせください。</p>
      `;
      mainContent.classList.add('show', 'error');
    }
  }
});

// ページ離脱時のクリーンアップ
window.addEventListener('beforeunload', () => {
  if (displayManager) {
    displayManager.destroy();
  }
});

// デバッグ用（開発環境のみ）
if (DEBUG) {
  window.displayManager = displayManager;
  
  // デバッグ用関数を追加
  window.resetSequence = () => {
    if (displayManager) {
      displayManager.resetSequentialProgress();
      log('info', 'Sequence reset via debug command');
    }
  };
  
  window.getDisplayStatus = () => {
    return displayManager ? displayManager.getDisplayStatus() : null;
  };
}
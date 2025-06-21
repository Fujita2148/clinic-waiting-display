// ─────────────────────────────────────────────────
// 待合室表示システム - 表示制御JavaScript
// ─────────────────────────────────────────────────

/**
 * 表示管理クラス（シンプル版）
 */
class SimpleDisplayManager {
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
      interval: 20,
      messageMode: 'sync',
      showTips: true
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
      this.updateTitle();
      
      // 表示開始
      if (this.contentQueue.length > 0) {
        this.startDisplay();
      } else {
        this.showFallback();
      }
      
      // 定期データ更新開始
      this.startDataPolling();
      
      this.isInitialized = true;
      Performance.end('display_init');
      log('info', 'Display manager initialized successfully');
      
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
        interval: 20,
        messageMode: 'sync',
        showTips: true,
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
          
          this.loadedContents[file.filename] = {
            data: contentData,
            meta: metaData,
            settings: {
              duration: (fileSettings && fileSettings.duration) || 8,
              weight: (fileSettings && fileSettings.weight) || 1,
              displayMode: (fileSettings && fileSettings.displayMode) || metaData.displayMode || "random"
            }
          };
          
          log('info', `Loaded content: ${file.filename} (${contentData.length} items)`);
          
        } catch (error) {
          log('warn', `Failed to load content ${file.filename}:`, error);
        }
      }
    }
  }

  /**
   * コンテンツキューの構築
   */
  buildContentQueue() {
    this.contentQueue = [];
    
    Object.entries(this.loadedContents).forEach(([filename, contentObj]) => {
      const { data, meta, settings } = contentObj;
      const weight = settings.weight || 1;
      
      // 重み付きでキューに追加
      data.forEach((item, index) => {
        for (let i = 0; i < weight; i++) {
          this.contentQueue.push({
            filename,
            item,
            index,
            meta,
            settings
          });
        }
      });
    });
    
    // シャッフル
    shuffleArray(this.contentQueue);
    this.currentIndex = 0;
    
    log('info', `Built content queue with ${this.contentQueue.length} items`);
  }

  /**
   * 表示開始
   */
  startDisplay() {
    if (this.displayInterval) {
      clearInterval(this.displayInterval);
    }
    
    // 初回表示
    this.showNextContent();
    
    // 定期表示
    this.displayInterval = setInterval(() => {
      this.showNextContent();
    }, this.settings.interval * 1000);
    
    log('info', `Display started with interval: ${this.settings.interval}s`);
  }

  /**
   * 次のコンテンツを表示
   */
  showNextContent() {
    if (!this.settings.showTips || this.contentQueue.length === 0) {
      return;
    }
    
    const content = this.contentQueue[this.currentIndex];
    const { item, meta, settings, index } = content;
    
    // カテゴリタイトル更新
    this.updateTitle(meta);
    
    // メインコンテンツ表示
    this.displayContent(item, settings);
    
    // 次のインデックス
    this.currentIndex = (this.currentIndex + 1) % this.contentQueue.length;
    
    // 一周したらシャッフル
    if (this.currentIndex === 0) {
      shuffleArray(this.contentQueue);
      log('info', 'Content queue reshuffled');
    }
    
    // メッセージ同期表示
    if (this.settings.messageMode === 'sync' && this.message.visible && this.message.text) {
      setTimeout(() => {
        this.showMessage();
      }, (settings.duration * 1000) / 2);
    }
  }

  /**
   * コンテンツの表示
   */
  displayContent(item, settings) {
    const duration = settings.duration || 8;
    
    // フェードアウト
    this.mainContent.classList.remove('show');
    
    setTimeout(() => {
      // コンテンツ更新
      this.mainContent.innerHTML = `
        <h2>${item.icon || '💡'} ${item.title}</h2>
        <p>${item.text}</p>
      `;
      
      // フェードイン
      this.mainContent.classList.add('show');
    }, 300);
    
    // 自動フェードアウト
    setTimeout(() => {
      this.mainContent.classList.remove('show');
    }, duration * 1000);
  }

  /**
   * カテゴリタイトルの更新
   */
  updateTitle(meta = null) {
    if (!this.categoryTitle) return;
    
    if (meta) {
      this.categoryTitle.textContent = `${meta.icon || '💡'} ${meta.title}`;
    } else if (Object.keys(this.loadedContents).length > 0) {
      const firstContent = Object.values(this.loadedContents)[0];
      this.categoryTitle.textContent = `${firstContent.meta.icon || '💡'} ${firstContent.meta.title}`;
    } else {
      this.categoryTitle.textContent = '💡 待合室表示システム';
    }
  }

  /**
   * メッセージ表示
   */
  showMessage() {
    if (!this.message.visible || !this.message.text) {
      this.messageArea.classList.remove('show');
      return;
    }
    
    this.messageArea.innerHTML = `<p>${this.message.text}</p>`;
    this.messageArea.classList.add('show');
    
    // 常時表示でない場合は自動で非表示
    if (this.settings.messageMode !== 'always') {
      setTimeout(() => {
        this.messageArea.classList.remove('show');
      }, 5000);
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
        // 設定とデータの更新
        await Promise.all([
          this.loadSettings(),
          this.loadMessage(),
          this.loadStatus()
        ]);
        
        // UI更新
        this.renderStatus();
        this.showMessage();
        
        // 表示間隔の変更チェック
        if (this.displayInterval) {
          clearInterval(this.displayInterval);
          this.startDisplay();
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
    this.categoryTitle.textContent = '💡 待合室表示システム';
    
    const fallbackTips = [
      { icon: '💡', title: 'システム準備中', text: 'コンテンツを読み込んでいます。しばらくお待ちください。' },
      { icon: '🌟', title: 'お知らせ', text: 'システムの準備が完了次第、表示を開始いたします。' }
    ];
    
    let currentTip = 0;
    
    const showFallback = () => {
      const tip = fallbackTips[currentTip];
      this.mainContent.innerHTML = `<h2>${tip.icon} ${tip.title}</h2><p>${tip.text}</p>`;
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
    this.categoryTitle.textContent = '⚠️ システムエラー';
    this.mainContent.innerHTML = `<h2>システムエラー</h2><p>${message}</p>`;
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
}

// ─────────────────────────────────────────────────
// 初期化
// ─────────────────────────────────────────────────

let displayManager = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    log('info', 'Starting display system initialization');
    
    displayManager = new SimpleDisplayManager();
    await displayManager.init();
    
    // 常時メッセージ表示の初期チェック
    if (displayManager.settings.messageMode === 'always') {
      displayManager.showMessage();
    }
    
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
}
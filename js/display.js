// ─────────────────────────────────────────────────
// 待合室表示システム - PlaylistDisplayManager
// DOM要素修正版・3カード対応
// ─────────────────────────────────────────────────

/**
 * プレイリスト表示管理クラス（修正版）
 */
class PlaylistDisplayManager {
  constructor() {
    // DOM要素
    this.categoryTitle = null;
    this.mainContent = null;
    this.messageArea = null;
    this.statusCard = null;
    
    // データ
    this.playlist = null;
    this.loadedContents = {};
    this.settings = {
      interval: 20,    // デフォルト待ち時間
      duration: 8,     // デフォルト表示時間
      showTips: true,
      files: {}
    };
    this.message = { text: '', visible: false };
    this.status = {
      room1: { label: '第1診察室', number: 0, visible: false },
      room2: { label: '第2診察室', number: 0, visible: false }
    };
    
    // プレイリスト制御
    this.currentPlaylistIndex = 0;
    this.currentFileIndex = 0;
    this.currentTimeout = null;
    this.fadeOutTimeout = null;
    this.dataInterval = null;
    this.isInitialized = false;
    this.manualAdvanceMode = false;

    this.manualCategoryListeners = { click: null, keydown: null };
    this.manualContentListeners = { click: null, keydown: null };
  }

  clearPlaybackTimers() {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }

    if (this.fadeOutTimeout) {
      clearTimeout(this.fadeOutTimeout);
      this.fadeOutTimeout = null;
    }
  }

  /**
   * 初期化
   */
  async init() {
    try {
      // パフォーマンス測定開始（common.js読み込み済みの場合のみ）
      if (typeof Performance !== 'undefined') {
        Performance.start('playlist_init');
      }
      
      // DOM要素の取得
      this.initializeElements();
      
      // 初期データ読み込み
      await this.loadAllData();

      // 手動送りモードの判定
      const params = new URLSearchParams(window.location.search);
      this.manualAdvanceMode = params.get('manualTips') === '1' || params.get('manualTips') === 'true';
      if (this.manualAdvanceMode) {
        log('info', 'Manual advance mode enabled for tips');
      }

      this.setupManualAdvanceControls();

      // 初期表示
      this.renderStatus();
      this.renderMessage();
      
      // プレイリスト開始
      if (this.playlist && this.playlist.hasPlaylist && this.settings.showTips) {
        this.startPlaylist();
      } else {
        this.showFallback();
      }
      
      // 定期データ更新開始
      this.startDataPolling();
      
      this.isInitialized = true;
      
      // パフォーマンス測定終了
      if (typeof Performance !== 'undefined') {
        Performance.end('playlist_init');
      }
      
      log('info', 'PlaylistDisplayManager initialized successfully');
      
    } catch (error) {
      log('error', 'Failed to initialize PlaylistDisplayManager:', error);
      this.showError('システムの初期化に失敗しました');
    }
  }

  setupManualAdvanceControls() {
    const detachHandlers = (element, listeners, focusClass) => {
      if (!element) return;
      if (listeners.click) {
        element.removeEventListener('click', listeners.click);
      }
      if (listeners.keydown) {
        element.removeEventListener('keydown', listeners.keydown);
      }
      element.removeAttribute('role');
      element.removeAttribute('tabindex');
      if (focusClass) {
        element.classList.remove(focusClass);
      }
    };

    detachHandlers(this.categoryTitle, this.manualCategoryListeners, 'tip-title-button');
    detachHandlers(this.mainContent, this.manualContentListeners, 'tip-body-button');

    this.manualCategoryListeners = { click: null, keydown: null };
    this.manualContentListeners = { click: null, keydown: null };

    if (!this.manualAdvanceMode) {
      return;
    }

    const attachHandlers = (element, handler, focusClass, listenersStore) => {
      if (!element) return;

      const clickHandler = () => handler();
      const keydownHandler = (event) => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          handler();
        }
      };

      element.setAttribute('role', 'button');
      element.tabIndex = 0;
      if (focusClass) {
        element.classList.add(focusClass);
      }

      element.addEventListener('click', clickHandler);
      element.addEventListener('keydown', keydownHandler);

      listenersStore.click = clickHandler;
      listenersStore.keydown = keydownHandler;
    };

    attachHandlers(this.categoryTitle, () => this.skipToNextFile(), 'tip-title-button', this.manualCategoryListeners);
    attachHandlers(this.mainContent, () => this.skipToNextItem(), 'tip-body-button', this.manualContentListeners);
  }

  /**
   * DOM要素の初期化（修正版）
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
 * 背景動画の初期化（z-index問題対応版）
 */
initializeBackgroundVideo() {
  const bgVideo = safeQuerySelector('#bg-video');
  const bgGradient = safeQuerySelector('.bg-gradient');
  
  if (!bgVideo) {
    console.warn('Background video element not found');
    // 動画がない場合はグラデーションにフォールバッククラス追加
    if (bgGradient) {
      bgGradient.classList.add('no-video');
    }
    return;
  }

  console.log('Setting up background video...');

  // 動画読み込み成功時
  bgVideo.addEventListener('loadeddata', () => {
    console.log('✅ Video loaded successfully');
    bgVideo.style.display = 'block';
    
    // 🔥 重要: グラデーションを透明化して動画を見えるようにする
    if (bgGradient) {
      bgGradient.classList.add('video-loaded');
    }
  });

  bgVideo.addEventListener('canplay', () => {
    console.log('✅ Video can play');
    bgVideo.style.display = 'block';
    
    if (bgGradient) {
      bgGradient.classList.add('video-loaded');
    }
  });

  // 動画読み込み失敗時
  bgVideo.addEventListener('error', (e) => {
    console.warn('❌ Video loading failed:', e);
    bgVideo.style.display = 'none';
    
    // フォールバック: グラデーション背景を復活
    if (bgGradient) {
      bgGradient.classList.remove('video-loaded');
      bgGradient.classList.add('no-video');
    }
  });

  // タイムアウト後のチェック
  setTimeout(() => {
    if (bgVideo.readyState >= 3) { // HAVE_FUTURE_DATA
      console.log('✅ Video ready (timeout check)');
      bgVideo.style.display = 'block';
      
      if (bgGradient) {
        bgGradient.classList.add('video-loaded');
      }
    } else {
      console.warn('⚠️ Video not ready after 5s, using fallback');
      bgVideo.style.display = 'none';
      
      if (bgGradient) {
        bgGradient.classList.add('no-video');
      }
    }
  }, 5000);

  // 明示的に動画読み込み開始
  try {
    bgVideo.load();
  } catch (error) {
    console.warn('Video load() failed:', error);
  }
}

  /**
   * 全データの読み込み
   */
  async loadAllData() {
    await Promise.all([
      this.loadPlaylist(),
      this.loadSettings(),
      this.loadMessage(),
      this.loadStatus()
    ]);
  }

  /**
   * プレイリストの読み込み
   */
  async loadPlaylist() {
    try {
      const response = await fetchJSON('php/get_playlist_status.php');
      this.playlist = response.data || null;
      
      if (this.playlist && this.playlist.hasPlaylist) {
        // インデックスの復元
        this.currentPlaylistIndex = this.playlist.currentPlaylistIndex || 0;
        this.currentFileIndex = this.playlist.currentFileIndex || 0;
        
        // プレイリストのコンテンツを事前読み込み
        await this.preloadPlaylistContents();
        
        log('info', `Loaded playlist with ${this.playlist.totalFiles} files`);
      }
    } catch (error) {
      log('warn', 'Failed to load playlist:', error);
      this.playlist = null;
    }
  }

  /**
   * プレイリストのコンテンツを事前読み込み
   */
  async preloadPlaylistContents() {
    if (!this.playlist || !this.playlist.playlist) return;
    
    const uniqueFiles = new Set();
    this.playlist.playlist.forEach(item => {
      if (item.filename) {
        uniqueFiles.add(item.filename);
      }
    });
    
    // 各ファイルを読み込み
    for (const filename of uniqueFiles) {
      try {
        const content = await fetchJSON(`data/contents/${filename}`);
        this.loadedContents[filename] = content;
        log('info', `Preloaded content: ${filename}`);
      } catch (error) {
        log('warn', `Failed to load content ${filename}:`, error);
      }
    }
  }

  /**
   * 設定の読み込み
   */
  async loadSettings() {
    const defaults = {
      interval: 20,
      duration: 8,
      showTips: true,
      files: {}
    };

    const loadedSettings = await safeAsync(
      () => fetchJSON('data/settings.json'),
      'Failed to load settings',
      defaults
    );

    this.settings = {
      interval: Number.isFinite(loadedSettings?.interval) ? loadedSettings.interval : defaults.interval,
      duration: Number.isFinite(loadedSettings?.duration) ? loadedSettings.duration : defaults.duration,
      showTips: typeof loadedSettings?.showTips === 'boolean' ? loadedSettings.showTips : defaults.showTips,
      files: (loadedSettings?.files && typeof loadedSettings.files === 'object') ? loadedSettings.files : defaults.files
    };
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
        mode: 'rooms',
        statusMessage: { text: '', visible: false, preset: null },
        room1: { label: '第1診察室', number: 0, visible: false },
        room2: { label: '第2診察室', number: 0, visible: false }
      }
    );
  }

  /**
   * プレイリスト表示開始
   */
  startPlaylist() {
    if (!this.playlist || !this.playlist.hasPlaylist || !this.settings.showTips) {
      return;
    }

    // 現在のタイムアウトをクリア
    this.clearPlaybackTimers();

    // 次のアイテムを表示
    this.showNextItem();
  }

  /**
   * 次のアイテムを表示
   */
  async showNextItem() {
    if (!this.playlist || !this.playlist.hasPlaylist || !this.settings.showTips) {
      return;
    }

    this.clearPlaybackTimers();

    const playlistItems = this.playlist.playlist;
    if (!playlistItems || playlistItems.length === 0) {
      log('warn', 'No items in playlist');
      return;
    }
    
    // 現在のファイル情報を取得
    const currentFile = playlistItems[this.currentPlaylistIndex];
    if (!currentFile || !currentFile.filename) {
      log('warn', 'Invalid playlist item at index', this.currentPlaylistIndex);
      this.moveToNextPlaylistItem();
      return;
    }
    
    // コンテンツを取得
    const content = this.loadedContents[currentFile.filename];
    if (!content) {
      log('warn', `Content not loaded for ${currentFile.filename}`);
      this.moveToNextPlaylistItem();
      return;
    }
    
    // アイテム配列を取得（新旧フォーマット対応）
    const items = content.items || content;
    if (!Array.isArray(items) || items.length === 0) {
      log('warn', `No items in content ${currentFile.filename}`);
      this.moveToNextPlaylistItem();
      return;
    }
    
    // 現在のアイテムを取得
    if (this.currentFileIndex >= items.length) {
      this.currentFileIndex = 0;
      this.moveToNextPlaylistItem();
      return;
    }
    
    const currentItem = items[this.currentFileIndex];
    
    // タイミング設定を取得（優先順位：アイテム > ファイル > グローバル）
    const timing = this.getItemTiming(currentItem, content);
    
    // カテゴリタイトル更新
    const meta = content.meta || { 
      title: currentFile.displayName || currentFile.filename,
      icon: '💡'
    };
    this.updateTitle(meta);
    
    // アイテムを表示
    this.displayItem(currentItem, timing.displayTime);
    
    // プレイリスト状態を保存
    await this.savePlaylistState();

    // 次のアイテムまでの待機
    if (!this.manualAdvanceMode) {
      this.currentTimeout = setTimeout(() => {
        this.currentTimeout = null;
        this.currentFileIndex++;

        // 現在のファイルの最後に達した場合
        if (this.currentFileIndex >= items.length) {
          this.currentFileIndex = 0;
          this.moveToNextPlaylistItem();
        } else {
          this.showNextItem();
        }
      }, timing.waitTime * 1000);
    }

    log('debug', `Displayed: ${currentFile.filename}[${this.currentFileIndex}] - wait: ${timing.waitTime}s, display: ${timing.displayTime}s`);
  }

  /**
   * アイテムのタイミング設定を取得
   */
  getItemTiming(item, content) {
    // 優先順位：アイテム個別 > ファイルデフォルト > グローバル設定
    const waitTime = 
      item.waitTime || 
      (content.defaultTiming && content.defaultTiming.waitTime) || 
      this.settings.interval || 
      20;
      
    const displayTime = 
      item.displayTime || 
      (content.defaultTiming && content.defaultTiming.displayTime) || 
      this.settings.duration || 
      8;
    
    return { waitTime, displayTime };
  }

  /**
   * 次のプレイリストアイテムへ移動
   */
  moveToNextPlaylistItem() {
    this.currentPlaylistIndex++;

    // プレイリストの最後に達した場合
    if (this.currentPlaylistIndex >= this.playlist.playlist.length) {
      this.currentPlaylistIndex = 0;
      log('info', 'Playlist completed, restarting from beginning');
    }

    this.currentFileIndex = 0;
    this.showNextItem();
  }

  skipToNextItem() {
    if (!this.playlist || !this.playlist.hasPlaylist || !this.settings.showTips) {
      return;
    }

    this.clearPlaybackTimers();

    const playlistItems = this.playlist.playlist;
    if (!playlistItems || playlistItems.length === 0) {
      return;
    }

    const currentFile = playlistItems[this.currentPlaylistIndex];
    const content = currentFile ? this.loadedContents[currentFile.filename] : null;
    const itemsSource = content?.items ?? content;
    const items = Array.isArray(itemsSource) ? itemsSource : [];

    if (items.length === 0) {
      this.moveToNextPlaylistItem();
      return;
    }

    this.currentFileIndex++;

    if (this.currentFileIndex >= items.length) {
      this.currentFileIndex = 0;
      this.moveToNextPlaylistItem();
      return;
    }

    this.showNextItem();
  }

  skipToNextFile() {
    if (!this.playlist || !this.playlist.hasPlaylist || !this.settings.showTips) {
      return;
    }

    this.clearPlaybackTimers();
    this.moveToNextPlaylistItem();
  }

  /**
   * アイテムの表示
   */
  displayItem(item, displayTime) {
    // フェードアウト
    this.mainContent.classList.remove('show');

    setTimeout(() => {
      // コンテンツ更新
      this.mainContent.innerHTML = '';
      this.mainContent.classList.remove('wide-card');

      const titleElement = document.createElement('h2');
      const textElement = document.createElement('p');

      const itemIcon = item.icon || '💡';
      const itemTitle = item.title || '';
      const titleText = `${itemIcon} ${itemTitle}`;

      // タイトルの長さを計測し、クラスを調整
      const titleLength = Array.from(titleText).length;
      if (titleLength > 28) {
        titleElement.classList.add('long-title', 'xlong-title');
        this.mainContent.classList.add('wide-card');
      } else if (titleLength > 22) {
        titleElement.classList.add('long-title');
        this.mainContent.classList.add('wide-card');
      }

      // タイトルとテキストを設定
      TextUtils.setElementText(titleElement, titleText, true);
      TextUtils.setElementText(textElement, item.text, true);

      titleElement.classList.add('tip-title-button');
      textElement.classList.add('tip-body-button');

      if (!this.manualAdvanceMode) {
        const activateOnInteraction = (element, handler) => {
          element.setAttribute('role', 'button');
          element.tabIndex = 0;
          element.addEventListener('click', handler);
          element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
              event.preventDefault();
              handler();
            }
          });
        };

        activateOnInteraction(titleElement, () => this.skipToNextFile());
        activateOnInteraction(textElement, () => this.skipToNextItem());
      }

      this.mainContent.appendChild(titleElement);
      this.mainContent.appendChild(textElement);

      // フェードイン
      this.mainContent.classList.add('show');
    }, 300);

    // 自動フェードアウト
    if (this.fadeOutTimeout) {
      clearTimeout(this.fadeOutTimeout);
      this.fadeOutTimeout = null;
    }

    if (!this.manualAdvanceMode) {
      this.fadeOutTimeout = setTimeout(() => {
        this.mainContent.classList.remove('show');
        this.fadeOutTimeout = null;
      }, displayTime * 1000);
    }
  }

  /**
   * カテゴリタイトルの更新
   */
  updateTitle(meta = null) {
    if (!this.categoryTitle) return;
    
    let titleText = '';
    
    if (meta) {
      titleText = `${meta.icon || '💡'} ${meta.title}`;
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
    
    // テキストを設定
    TextUtils.setElementText(this.categoryTitle, processedTitle, true);
  }

  /**
   * メッセージ表示
   */
  renderMessage() {
    if (!this.messageArea) return;
    
    if (this.message.visible && this.message.text) {
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

    const mode = this.status.mode || 'rooms';

    this.statusCard.className = 'status-card';

    switch (mode) {
      case 'hidden':
        this.statusCard.style.display = 'none';
        break;
      case 'message':
        this.renderVerticalStatusMessage();
        break;
      case 'rooms':
      default:
        this.renderRoomStatus();
        break;
    }
  }

  renderVerticalStatusMessage() {
    const statusMessage = this.status.statusMessage || {};

    if (!statusMessage.visible || !statusMessage.text) {
      this.statusCard.style.display = 'none';
      return;
    }

    this.statusCard.className = 'status-card message-mode';
    this.statusCard.style.display = 'flex';

    const messageLayout = this.calculateMessageLayout(statusMessage.text);
    
    // 🔥 修正: 行数に応じたクラスを追加
    const lineCountClass = `lines-${messageLayout.lineCount}`;

    if (messageLayout.lineCount === 1) {
      this.statusCard.innerHTML = `
        <div class="vertical-message-container ${lineCountClass}">
          <div class="vertical-message-single" 
               style="font-size: ${messageLayout.fontSize}px; line-height: ${messageLayout.lineHeight};">
            ${TextUtils.escapeHtml(messageLayout.lines[0])}
          </div>
        </div>
      `;
    } else {
      this.statusCard.innerHTML = `
        <div class="vertical-message-container ${lineCountClass}">
          ${messageLayout.lines.map((line, index) => `
            <div class="vertical-message-line line-${index + 1}" 
                 style="font-size: ${messageLayout.fontSize}px; line-height: ${messageLayout.lineHeight};">
              ${TextUtils.escapeHtml(line)}
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  calculateMessageLayout(text) {
    const lines = this.splitVerticalMessage(text);
    const maxCharsPerLine = Math.max(...lines.map(line => line.length));
    const lineCount = lines.length;

    const rect = this.statusCard.getBoundingClientRect();
    const availableHeight = rect.height > 0 ? rect.height - 60 : 400;
    const availableWidth = rect.width > 0 ? rect.width - 40 : 400;

    let fontSize;
    let lineHeight;

    if (lineCount === 1) {
      if (maxCharsPerLine <= 4) {
        fontSize = Math.min(availableHeight / maxCharsPerLine * 0.9, 200);
      } else if (maxCharsPerLine <= 8) {
        fontSize = Math.min(availableHeight / maxCharsPerLine * 0.8, 150);
      } else {
        fontSize = Math.min(availableHeight / maxCharsPerLine * 0.7, 120);
      }
      lineHeight = 1.0;
    } else if (lineCount === 2) {
      fontSize = Math.min(
        availableHeight / maxCharsPerLine * 0.65,
        availableWidth / 2.5
      );
      lineHeight = 1.1;
    } else {
      fontSize = Math.min(
        availableHeight / maxCharsPerLine * 0.5,
        availableWidth / 3.2
      );
      lineHeight = 1.2;
    }

    fontSize = Math.max(30, Math.min(fontSize, 200));

    return {
      fontSize: Math.round(fontSize),
      lineHeight,
      lines,
      lineCount,
      maxCharsPerLine
    };
  }

  splitVerticalMessage(text) {
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

    const splitPoint = this.findNaturalBreakPoint(cleanText);
    const line1 = cleanText.substring(0, splitPoint).trim();
    const line2 = cleanText.substring(splitPoint).trim();

    return [line1, line2].filter(line => line.length > 0);
  }

  findNaturalBreakPoint(text) {
    const midPoint = Math.floor(text.length / 2);
    const naturalBreaks = [
      { pattern: 'まで', offset: 2 },
      { pattern: 'から', offset: 2 },
      { pattern: 'です', offset: 2 },
      { pattern: 'ます', offset: 2 },
      { pattern: 'した', offset: 2 },
      { pattern: 'ください', offset: 4 }
    ];

    for (const nb of naturalBreaks) {
      const index = text.indexOf(nb.pattern);
      if (index > 0 && index <= text.length - nb.offset && Math.abs(index + nb.offset - midPoint) <= 5) {
        return index + nb.offset;
      }
    }

    return midPoint;
  }

  renderRoomStatus() {
    const r1 = this.status.room1 || {};
    const r2 = this.status.room2 || {};

    const room1Class = this.getRoomLabelClass(r1.label || '第1診察室');
    const room2Class = this.getRoomLabelClass(r2.label || '第2診察室');

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
          <div class="room-label ${room1Class}">${r1.label || '第1診察室'}</div>
          <div class="room-number">${r1.number}</div>
          </div>
        ` : ''}
        ${r2.visible && r2.number > 0 ? `
          <div class="room-info">
          <div class="room-label ${room2Class}">${r2.label || '第2診察室'}</div>
          <div class="room-number">${r2.number}</div>
          </div>
        ` : ''}
      `;
  }

  getRoomLabelClass(label) {
    const normalized = (label || '').replace(/\s+/g, '');
    const length = Array.from(normalized).length;

    if (length >= 6) {
      return 'room-label-compact';
    }

    if (length >= 3) {
      return 'room-label-tight';
    }

    return '';
  }

  /**
   * プレイリスト状態の保存（簡易版）
   */
  async savePlaylistState() {
    try {
      const response = await fetch('php/get_playlist_status.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPlaylistIndex: this.currentPlaylistIndex,
          currentFileIndex: this.currentFileIndex
        })
      });

      if (!response.ok) {
        throw new Error(`Playback update failed: ${response.status}`);
      }
    } catch (error) {
      log('warn', 'Failed to save playlist state:', error);
    }
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
        
        // コンテンツ表示設定の変更チェック
        if (this.settings.showTips !== oldShowTips) {
          log('info', `showTips changed: ${oldShowTips} → ${this.settings.showTips}`);
          
          if (this.settings.showTips && this.playlist && this.playlist.hasPlaylist) {
            this.startPlaylist();
          } else if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
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
    
    const fallbackContent = {
      icon: '⚙️',
      title: 'システム準備中',
      text: 'プレイリストを設定してください。コントロール画面から設定できます。'
    };
    
    this.mainContent.innerHTML = '';
    
    const titleElement = document.createElement('h2');
    const textElement = document.createElement('p');
    
    TextUtils.setElementText(titleElement, `${fallbackContent.icon} ${fallbackContent.title}`, false);
    TextUtils.setElementText(textElement, fallbackContent.text, false);
    
    this.mainContent.appendChild(titleElement);
    this.mainContent.appendChild(textElement);
    this.mainContent.classList.add('show');
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
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
    }
    if (this.dataInterval) {
      clearInterval(this.dataInterval);
    }
    this.isInitialized = false;
    log('info', 'PlaylistDisplayManager destroyed');
  }

  /**
   * プレイリストのリロード
   */
  async reloadPlaylist() {
    log('info', 'Reloading playlist...');
    
    // 現在の表示を停止
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    
    // プレイリストを再読み込み
    await this.loadPlaylist();
    
    // プレイリストがある場合は再開
    if (this.playlist && this.playlist.hasPlaylist && this.settings.showTips) {
      this.startPlaylist();
    } else {
      this.showFallback();
    }
  }
}

// ページ離脱時のクリーンアップ
window.addEventListener('beforeunload', () => {
  if (window.displayManager) {
    window.displayManager.destroy();
  }
});

// デバッグ用（開発環境のみ）
if (typeof DEBUG !== 'undefined' && DEBUG) {
  // デバッグ用関数
  window.reloadPlaylist = () => {
    if (window.displayManager) {
      window.displayManager.reloadPlaylist();
    }
  };
}

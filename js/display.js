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
      interval: 20,    // デフォルト待ち時間（waitTime）
      duration: 8,     // デフォルト表示時間（displayTime）
      showTips: true
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
    this.dataInterval = null;
    this.isInitialized = false;
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
    this.settings = await safeAsync(
      () => fetchJSON('data/settings.json'),
      'Failed to load settings',
      {
        interval: 20,    // デフォルトwaitTime
        duration: 8,     // デフォルトdisplayTime
        showTips: true
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
   * プレイリスト表示開始
   */
  startPlaylist() {
    if (!this.playlist || !this.playlist.hasPlaylist || !this.settings.showTips) {
      return;
    }
    
    // 現在のタイムアウトをクリア
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    
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
    this.currentTimeout = setTimeout(() => {
      this.currentFileIndex++;
      
      // 現在のファイルの最後に達した場合
      if (this.currentFileIndex >= items.length) {
        this.currentFileIndex = 0;
        this.moveToNextPlaylistItem();
      } else {
        this.showNextItem();
      }
    }, timing.waitTime * 1000);
    
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

  /**
   * アイテムの表示
   */
  displayItem(item, displayTime) {
    // フェードアウト
    this.mainContent.classList.remove('show');
    
    setTimeout(() => {
      // コンテンツ更新
      this.mainContent.innerHTML = '';
      
      const titleElement = document.createElement('h2');
      const textElement = document.createElement('p');
      
      // タイトルとテキストを設定
      TextUtils.setElementText(titleElement, `${item.icon || '💡'} ${item.title}`, true);
      TextUtils.setElementText(textElement, item.text, true);
      
      this.mainContent.appendChild(titleElement);
      this.mainContent.appendChild(textElement);
      
      // フェードイン
      this.mainContent.classList.add('show');
    }, 300);
    
    // 自動フェードアウト
    setTimeout(() => {
      this.mainContent.classList.remove('show');
    }, displayTime * 1000);
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
   * プレイリスト状態の保存（簡易版）
   */
  async savePlaylistState() {
    try {
      // ローカルストレージに保存（サーバー実装は今回なし）
      const data = {
        currentPlaylistIndex: this.currentPlaylistIndex,
        currentFileIndex: this.currentFileIndex,
        timestamp: Date.now()
      };
      
      localStorage.setItem('playlistState', JSON.stringify(data));
      
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
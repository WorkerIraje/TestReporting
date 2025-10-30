
const Storage = {

  config: {
    version: '2.0.0',
    maxStorageSize: 50 * 1024 * 1024, 
    autoSaveInterval: 2000, 
    backupInterval: 300000, 
    maxBackups: 5,
    compressionEnabled: true,
    crossTabSyncEnabled: true
  },


  isInitialized: false,
  autoSaveTimer: null,
  backupTimer: null,
  lastSaveTime: 0,
  pendingChanges: false,
  storageQuotaWarning: false,


  async init() {
    if (this.isInitialized) return;
    
    console.log('🔧 Initializing Enhanced Persistence System...');
    
    try {

      await this.checkStorageHealth();
      

      await this.migrateData();
      
     
      await this.restoreCompleteState();
      
    
      this.setupAutoSave();
      this.setupBackupSystem();
      
     
      if (this.config.crossTabSyncEnabled) {
        this.setupCrossTabSync();
      }
      
     
      this.setupCleanup();
      
     
      this.setupVisibilityHandlers();
      
      this.isInitialized = true;
      console.log('✅ Persistence system initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize persistence system:', error);
   
      this.isInitialized = true;
    }
  },




  saveRowState(testId, data) {
    try {
      const enhancedData = {
        ...data,
        testId,
        lastModified: new Date().toISOString(),
        version: this.config.version
      };
      
      const key = `test_${testId}`;
      const serialized = JSON.stringify(enhancedData);
      

      const finalData = this.config.compressionEnabled && serialized.length > 1000 
        ? this.compress(serialized) 
        : serialized;
      
      localStorage.setItem(key, finalData);
      this.markPendingChanges();
      
   
      this.broadcastChange('testCase', { testId, data: enhancedData });
      
    } catch (error) {
      console.error(`Failed to save test case ${testId}:`, error);
      this.handleStorageError(error, 'saveRowState', { testId, data });
    }
  },

  
  loadRowState(testId) {
    try {
      const key = `test_${testId}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) return null;
      

      const decompressed = stored.startsWith('{"') ? stored : this.decompress(stored);
      const data = JSON.parse(decompressed);
      
 
      if (!this.validateTestCaseData(data)) {
        console.warn(`Invalid data structure for test case ${testId}, removing...`);
        this.removeRowState(testId);
        return null;
      }
      
      return data;
      
    } catch (error) {
      console.error(`Failed to load test case ${testId}:`, error);
      return null;
    }
  },


  removeRowState(testId) {
    try {
      localStorage.removeItem(`test_${testId}`);
      this.markPendingChanges();
      this.broadcastChange('testCaseRemoved', { testId });
    } catch (error) {
      console.error(`Failed to remove test case ${testId}:`, error);
    }
  },




  saveCompleteState() {
    try {
      console.log('💾 Saving complete application state...');
      
      const completeState = {
     
        flatRows: window.AppState?.flatRows || [],
        rowsByGroup: window.AppState?.rowsByGroup || {},
        loadedCount: window.AppState?.loadedCount || 0,
        
     
        selectedSheets: window.AppState?.selectedSheets || [],
        workbookInfo: this.extractWorkbookInfo(),
        
   
        currentPage: window.Navigation?.getCurrentPage?.() || 'workspace',
        expandedSections: this.getExpandedSections(),
        scrollPositions: this.getScrollPositions(),
        
      
        header: this.getHeaderData(),
        
       
        currentProject: window.AppState?.currentProject || null,
        
       
        lastSaved: new Date().toISOString(),
        version: this.config.version,
        sessionId: this.getSessionId()
      };
      
    
      const compressed = this.config.compressionEnabled 
        ? this.compress(JSON.stringify(completeState))
        : JSON.stringify(completeState);
      
      localStorage.setItem('iraje_complete_state', compressed);
      
     
      this.saveAllTestCaseStates();
      
      this.updateMetadata();
      
      this.lastSaveTime = Date.now();
      this.pendingChanges = false;
      
      console.log('✅ Complete state saved successfully');
      
    } catch (error) {
      console.error('❌ Failed to save complete state:', error);
      this.handleStorageError(error, 'saveCompleteState');
    }
  },

  async restoreCompleteState() {
    try {
      console.log('🔄 Restoring complete application state...');
      
      const stored = localStorage.getItem('iraje_complete_state');
      if (!stored) {
        console.log('No previous state found, starting fresh');
        return false;
      }
      
      const decompressed = stored.startsWith('{') ? stored : this.decompress(stored);
      const state = JSON.parse(decompressed);
      
      if (!this.validateStateVersion(state)) {
        console.warn('State version mismatch, attempting migration...');
        await this.migrateState(state);
      }
      
      if (state.flatRows && Array.isArray(state.flatRows)) {
        window.AppState = window.AppState || {};
        window.AppState.flatRows = state.flatRows;
        window.AppState.rowsByGroup = state.rowsByGroup || {};
        window.AppState.loadedCount = state.loadedCount || state.flatRows.length;
        window.AppState.selectedSheets = state.selectedSheets || [];
        window.AppState.currentProject = state.currentProject;
      }
      
      if (state.currentPage && window.Navigation?.setCurrentPage) {
        setTimeout(() => window.Navigation.setCurrentPage(state.currentPage), 100);
      }
      
      if (state.header) {
        this.restoreHeaderData(state.header);
      }
      
      if (state.expandedSections) {
        setTimeout(() => this.restoreExpandedSections(state.expandedSections), 500);
      }
      
      if (state.scrollPositions) {
        setTimeout(() => this.restoreScrollPositions(state.scrollPositions), 1000);
      }
      
      console.log(`✅ State restored successfully! Loaded ${window.AppState?.flatRows?.length || 0} test cases`);
      
    
      setTimeout(() => {
        if (window.App?.ensureOptimizedUIRender) {
          window.App.ensureOptimizedUIRender();
        }
        if (window.App?.updateUIState) {
          window.App.updateUIState();
        }
      }, 200);
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to restore state:', error);

      return false;
    }
  },


  setupAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(() => {
      if (this.pendingChanges) {
        this.saveCompleteState();
      }
    }, this.config.autoSaveInterval);
    
    this.setupEventBasedSave();
    
    console.log(`🔄 Auto-save enabled (every ${this.config.autoSaveInterval/1000}s)`);
  },

  setupEventBasedSave() {

    const observer = new MutationObserver(() => {
      this.markPendingChanges();
    });
    

    const sectionsRoot = document.getElementById('sectionsRoot');
    if (sectionsRoot) {
      observer.observe(sectionsRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-status']
      });
    }
    

    document.addEventListener('change', (e) => {
      if (e.target.matches('.status-selector, .notes-field, .expected-result-field, input[type="checkbox"]')) {
        this.markPendingChanges();
      }
    });
    

    let inputTimeout;
    document.addEventListener('input', (e) => {
      if (e.target.matches('.notes-field, .expected-result-field, #reportDate, #testerName, #signature')) {
        clearTimeout(inputTimeout);
        inputTimeout = setTimeout(() => {
          this.markPendingChanges();
        }, 1000);
      }
    });
    

    window.addEventListener('beforeunload', () => {
      if (this.pendingChanges) {
        this.saveCompleteState();
      }
    });
    

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.pendingChanges) {
        this.saveCompleteState();
      }
    });
  },


  markPendingChanges() {
    this.pendingChanges = true;
    
    this.showSaveIndicator();
  },



 
  setupBackupSystem() {

    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }
    

    this.createBackup();
    

    this.backupTimer = setInterval(() => {
      this.createBackup();
    }, this.config.backupInterval);
    
    console.log(`💾 Backup system enabled (every ${this.config.backupInterval/60000} minutes)`);
  },


  createBackup() {
    try {
      const timestamp = new Date().toISOString();
      const backupKey = `iraje_backup_${timestamp}`;
      
      const backupData = {
        timestamp,
        state: localStorage.getItem('iraje_complete_state'),
        testCases: this.getAllTestCaseStates(),
        version: this.config.version
      };
      
      localStorage.setItem(backupKey, JSON.stringify(backupData));
      
    
      this.cleanupOldBackups();
      
      console.log(`💾 Backup created: ${backupKey}`);
      
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  },


  cleanupOldBackups() {
    try {
      const backupKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('iraje_backup_'))
        .sort()
        .reverse(); 
      
   
      if (backupKeys.length > this.config.maxBackups) {
        const toDelete = backupKeys.slice(this.config.maxBackups);
        toDelete.forEach(key => localStorage.removeItem(key));
        console.log(`🧹 Cleaned up ${toDelete.length} old backups`);
      }
      
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  },

  
  restoreFromBackup(timestamp) {
    try {
      const backupKey = `iraje_backup_${timestamp}`;
      const backup = localStorage.getItem(backupKey);
      
      if (!backup) {
        throw new Error(`Backup ${timestamp} not found`);
      }
      
      const backupData = JSON.parse(backup);
      

      localStorage.setItem('iraje_complete_state', backupData.state);
      

      Object.entries(backupData.testCases).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      console.log(`✅ Restored from backup: ${timestamp}`);
      
     
      window.location.reload();
      
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      throw error;
    }
  },


  getAvailableBackups() {
    return Object.keys(localStorage)
      .filter(key => key.startsWith('iraje_backup_'))
      .map(key => {
        const timestamp = key.replace('iraje_backup_', '');
        return {
          timestamp,
          date: new Date(timestamp).toLocaleString(),
          key
        };
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },


  setupCrossTabSync() {

    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('iraje_')) {
        console.log('🔄 Cross-tab change detected:', e.key);
        this.handleCrossTabChange(e);
      }
    });
    
 
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('iraje_sync');
      
      this.broadcastChannel.addEventListener('message', (e) => {
        this.handleBroadcastMessage(e.data);
      });
    }
    
    console.log('🔄 Cross-tab synchronization enabled');
  },

 
  broadcastChange(type, data) {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type,
        data,
        timestamp: Date.now(),
        sessionId: this.getSessionId()
      });
    }
  },

  handleBroadcastMessage(message) {
 
    if (message.sessionId === this.getSessionId()) return;
    
    console.log('📡 Received cross-tab message:', message.type);
    
    switch (message.type) {
      case 'testCase':

        this.updateTestCaseInUI(message.data.testId, message.data.data);
        break;
      case 'completeRefresh':
      
        setTimeout(() => {
          if (window.App?.ensureOptimizedUIRender) {
            window.App.ensureOptimizedUIRender();
          }
        }, 100);
        break;
    }
  },



  
  validateTestCaseData(data) {
    if (!data || typeof data !== 'object') return false;
    
   
    const requiredFields = ['testId', 'lastModified'];
    if (!requiredFields.every(field => data.hasOwnProperty(field))) {
      return false;
    }
    
    
    if (data.lastModified && isNaN(new Date(data.lastModified))) {
      return false;
    }
    
    return true;
  },

 
  validateStateVersion(state) {
    return state && state.version === this.config.version;
  },


  async checkStorageHealth() {
    try {
   
      const testKey = 'iraje_storage_test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      
      // Check quota
      const usage = await this.getStorageUsage();
      if (usage.percentage > 80) {
        console.warn(`⚠️ Storage usage high: ${usage.percentage}%`);
        this.storageQuotaWarning = true;
      }
      
      console.log(`📊 Storage health: ${usage.used}/${usage.quota} (${usage.percentage}%)`);
      
    } catch (error) {
      console.error('Storage health check failed:', error);
      throw new Error('LocalStorage not available');
    }
  },


  async getStorageUsage() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
        percentage: Math.round((estimate.usage / estimate.quota) * 100) || 0
      };
    }
    

    const used = JSON.stringify(localStorage).length;
    return {
      used,
      quota: 10 * 1024 * 1024, // Assume 10MB default
      percentage: Math.round((used / (10 * 1024 * 1024)) * 100)
    };
  },




  getSessionId() {
    if (!this.sessionId) {
      this.sessionId = 'iraje_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    return this.sessionId;
  },


  compress(str) {

    return str.replace(/\s+/g, ' ').trim();
  },

  
  decompress(str) {
    return str; 
  },

  
  getAllTestCaseStates() {
    const testCaseStates = {};
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('test_')) {
        testCaseStates[key] = localStorage.getItem(key);
      }
    });
    return testCaseStates;
  },

  
  saveAllTestCaseStates() {
    if (window.AppState?.flatRows) {
      window.AppState.flatRows.forEach(testCase => {
        const saved = this.loadRowState(testCase.id);
        if (saved) {
          this.saveRowState(testCase.id, saved);
        }
      });
    }
  },

 
  extractWorkbookInfo() {
    if (window.AppState?.workbook) {
      return {
        sheetNames: window.AppState.workbook.SheetNames || [],
        selectedSheets: window.AppState.selectedSheets || []
      };
    }
    return null;
  },


  getHeaderData() {
    return {
      date: document.getElementById('reportDate')?.value || '',
      tester: document.getElementById('testerName')?.value || '',
      signature: document.getElementById('signature')?.value || ''
    };
  },


  restoreHeaderData(header) {
    if (document.getElementById('reportDate')) document.getElementById('reportDate').value = header.date || '';
    if (document.getElementById('testerName')) document.getElementById('testerName').value = header.tester || '';
    if (document.getElementById('signature')) document.getElementById('signature').value = header.signature || '';
  },


  getExpandedSections() {
    const expanded = [];
    document.querySelectorAll('.test-group').forEach((group, index) => {
      const isExpanded = !group.querySelector('.checklist')?.style.display || 
                         group.querySelector('.checklist')?.style.display !== 'none';
      if (isExpanded) {
        expanded.push(index);
      }
    });
    return expanded;
  },


  restoreExpandedSections(expandedSections) {
    document.querySelectorAll('.test-group').forEach((group, index) => {
      const checklist = group.querySelector('.checklist');
      if (checklist) {
        checklist.style.display = expandedSections.includes(index) ? 'block' : 'none';
      }
    });
  },

  getScrollPositions() {
    return {
      main: window.scrollY,
      sections: document.getElementById('sectionsRoot')?.scrollTop || 0
    };
  },

  restoreScrollPositions(positions) {
    if (positions.main) {
      window.scrollTo(0, positions.main);
    }
    if (positions.sections) {
      const sectionsRoot = document.getElementById('sectionsRoot');
      if (sectionsRoot) {
        sectionsRoot.scrollTop = positions.sections;
      }
    }
  },

 
  showSaveIndicator() {
    
    let indicator = document.getElementById('saveIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'saveIndicator';
      indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s;
      `;
      document.body.appendChild(indicator);
    }
    
    indicator.textContent = '💾 Saving...';
    indicator.style.opacity = '1';
    
    setTimeout(() => {
      indicator.textContent = '✅ Saved';
      setTimeout(() => {
        indicator.style.opacity = '0';
      }, 1000);
    }, 500);
  },


  handleStorageError(error, operation, data = null) {
    console.error(`Storage error in ${operation}:`, error);
    
    if (error.name === 'QuotaExceededError') {
     
      this.handleQuotaExceeded();
    } else {

      console.error('Storage operation failed:', { operation, error: error.message, data });
    }
  },

 
  handleQuotaExceeded() {
    console.warn('⚠️ Storage quota exceeded, attempting cleanup...');
    
   
    this.cleanupOldData();
   
    if (window.showWarningNotification) {
      showWarningNotification('Storage space is running low. Some old data has been cleaned up.');
    }
  },


  cleanupOldData() {
    try {
      
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('test_')) {
          const data = this.loadRowState(key.replace('test_', ''));
          if (data && data.lastModified) {
            const lastModified = new Date(data.lastModified).getTime();
            if (lastModified < thirtyDaysAgo) {
              localStorage.removeItem(key);
            }
          }
        }
      });
      
      console.log('🧹 Old data cleanup completed');
      
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
    }
  },

  
  setupCleanup() {
  
    setTimeout(() => this.cleanupOldData(), 5000);
    
    
    setInterval(() => this.cleanupOldData(), 24 * 60 * 60 * 1000);
  },

  
  setupVisibilityHandlers() {
    
    window.addEventListener('focus', () => {
     
      if (!this.autoSaveTimer) {
        this.setupAutoSave();
      }
    });
    
    window.addEventListener('blur', () => {
      
      if (this.pendingChanges) {
        this.saveCompleteState();
      }
    });
  },

 
  updateMetadata() {
    const metadata = {
      lastSave: new Date().toISOString(),
      version: this.config.version,
      testCaseCount: window.AppState?.flatRows?.length || 0,
      sessionId: this.getSessionId()
    };
    
    localStorage.setItem('iraje_metadata', JSON.stringify(metadata));
  },

  
  async migrateData() {
    const metadata = localStorage.getItem('iraje_metadata');
    if (!metadata) {
      console.log('🔄 First time setup, no migration needed');
      return;
    }
    
    try {
      const meta = JSON.parse(metadata);
      if (meta.version !== this.config.version) {
        console.log(`🔄 Migrating data from ${meta.version} to ${this.config.version}...`);
        
        this.updateMetadata();
      }
    } catch (error) {
      console.error('Migration failed:', error);
    }
  },

 
  async migrateState(state) {
    
    console.log('🔄 State migration completed');
  },

 
  updateTestCaseInUI(testId, data) {
    const testElement = document.getElementById(`test-${testId}`);
    if (testElement) {
      
      const statusSelect = testElement.querySelector('.status-selector');
      if (statusSelect && data.status) {
        statusSelect.value = data.status;
      }
      
   
      const attendedCheckbox = document.getElementById(`attended_${testId}`);
      const pendingCheckbox = document.getElementById(`pending_${testId}`);
      
      if (attendedCheckbox && data.hasOwnProperty('attended')) {
        attendedCheckbox.checked = data.attended;
      }
      
      if (pendingCheckbox && data.hasOwnProperty('pending')) {
        pendingCheckbox.checked = data.pending;
      }
      
      
      const notesField = testElement.querySelector('.notes-field');
      if (notesField && data.notes) {
        notesField.value = data.notes;
      }
    }
  },

  

 
  saveAppState() {
    try {
      const state = window.AppState;
      const stateSnapshot = {
        flatRows: state?.flatRows || [],
        rowsByGroup: state?.rowsByGroup || {},
        selectedSheets: state?.selectedSheets || [],
        sheets: state?.sheets || [],
        loadedCount: state?.loadedCount || 0,
        currentProject: state?.currentProject || null,
        timestamp: new Date().toISOString(),
        version: this.config.version || '1.0'
      };
    
      localStorage.setItem('irajeAppState', JSON.stringify(stateSnapshot));
    
      localStorage.setItem('irajeAppState_backup', JSON.stringify(stateSnapshot));

      this.saveAllTestCaseStates();
      console.log('✅ App state saved successfully:', stateSnapshot);
      return true;
    } catch (error) {
      console.error('❌ Failed to save app state:', error);
      return false;
    }
  },


  loadAppState() {
    try {
    
      let stateData = localStorage.getItem('irajeAppState');
     
      if (!stateData) {
        console.warn('⚠️ Primary state not found, trying backup...');
        stateData = localStorage.getItem('irajeAppState_backup');
      }
      if (stateData) {
        const parsedState = JSON.parse(stateData);
        console.log('✅ App state restored:', parsedState);
        return parsedState;
      }
      console.log('ℹ️ No saved state found');
      return null;
    } catch (error) {
      console.error('❌ Failed to load app state:', error);
      return null;
    }
  },

  saveAllTestCaseStates() {
    try {
      const state = window.AppState;
      if (!state?.flatRows) return;
      const allStates = {};
      state.flatRows.forEach(row => {
        const saved = this.loadRowState(row.id);
        if (saved) {
          allStates[row.id] = saved;
        }
      });
      localStorage.setItem('irajeAllTestStates', JSON.stringify(allStates));
      localStorage.setItem('irajeAllTestStates_backup', JSON.stringify(allStates));
      console.log(`✅ Saved ${Object.keys(allStates).length} test case states`);
    } catch (error) {
      console.error('❌ Failed to save test case states:', error);
    }
  },

 
  loadAllTestCaseStates() {
    try {
      let statesData = localStorage.getItem('irajeAllTestStates');
      if (!statesData) {
        statesData = localStorage.getItem('irajeAllTestStates_backup');
      }
      if (statesData) {
        const allStates = JSON.parse(statesData);
        console.log(`✅ Restored ${Object.keys(allStates).length} test case states`);
        // Restore each test case state
        Object.entries(allStates).forEach(([testId, state]) => {
          this.saveRowState(testId, state);
        });
        return allStates;
      }
      return {};
    } catch (error) {
      console.error('❌ Failed to load test case states:', error);
      return {};
    }
  },

  
  saveHeader() {
    const headerData = {
      reportDate: document.getElementById('reportDate')?.value || '',
      testerName: document.getElementById('testerName')?.value || '',
      signature: document.getElementById('signature')?.value || '',
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('irajeHeader', JSON.stringify(headerData));
    localStorage.setItem('irajeHeader_backup', JSON.stringify(headerData));
   
    this.saveAppState();
  },


  loadHeaderFromStorage() {
    try {
      let headerData = localStorage.getItem('irajeHeader');
      if (!headerData) {
        headerData = localStorage.getItem('irajeHeader_backup');
      }
      if (headerData) {
        const data = JSON.parse(headerData);
        const reportDate = document.getElementById('reportDate');
        const testerName = document.getElementById('testerName');
        const signature = document.getElementById('signature');
        if (reportDate) reportDate.value = data.reportDate || '';
        if (testerName) testerName.value = data.testerName || '';
        if (signature) signature.value = data.signature || '';
        console.log('✅ Header restored:', data);
      }
    } catch (error) {
      console.error('❌ Failed to load header:', error);
    }
  },


  saveProject(name, description) {
    try {
      const project = {
        name,
        description,
        data: window.AppState?.flatRows || [],
        metadata: {
          timestamp: new Date().toISOString(),
          testCaseCount: window.AppState?.flatRows?.length || 0,
          version: this.config.version
        }
      };
      
      localStorage.setItem(`project_${name}`, JSON.stringify(project));
      this.updateMetadata();
      
      console.log(`💾 Project "${name}" saved with ${project.data.length} test cases`);
      return true;
      
    } catch (error) {
      console.error('Failed to save project:', error);
      return false;
    }
  },

  loadProject(name) {
    try {
      const project = localStorage.getItem(`project_${name}`);
      if (project) {
        const data = JSON.parse(project);
        

        window.AppState = window.AppState || {};
        window.AppState.flatRows = data.data || [];
        window.AppState.loadedCount = data.data?.length || 0;
        window.AppState.currentProject = name;
        
        console.log(`📂 Project "${name}" loaded with ${data.data?.length || 0} test cases`);
        return true;
      }
      return false;
      
    } catch (error) {
      console.error('Failed to load project:', error);
      return false;
    }
  },


  clearStorage() {
    try {
      const keys = Object.keys(localStorage);
      let cleared = 0;
      
      keys.forEach(key => {
        if (key.startsWith('test_') || 
            key.startsWith('project_') || 
            key.startsWith('iraje_')) {
          localStorage.removeItem(key);
          cleared++;
        }
      });
      
      console.log(`🧹 Cleared ${cleared} storage items`);

      this.pendingChanges = false;
      this.lastSaveTime = 0;
      
      return true;
      
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  },


  showProjectDialog(filename, callback) {
    const existingProject = localStorage.getItem(`project_${filename}`);
    
    if (existingProject) {
      try {
        const projectData = JSON.parse(existingProject);
        const lastModified = projectData.metadata?.timestamp || projectData.timestamp;
        const testCaseCount = projectData.metadata?.testCaseCount || projectData.data?.length || 0;
        
   
        const modal = document.createElement('div');
        modal.className = 'project-dialog-overlay';
        modal.innerHTML = `
          <div class="project-dialog">
            <div class="project-header">
              <h3>🗂️ Project Found: ${filename}</h3>
            </div>
            <div class="project-body">
              <p><strong>Existing project data found!</strong></p>
              <div class="project-stats">
                <div class="stat">
                  <span class="label">Last Modified:</span>
                  <span class="value">${new Date(lastModified).toLocaleString()}</span>
                </div>
                <div class="stat">
                  <span class="label">Test Cases:</span>
                  <span class="value">${testCaseCount}</span>
                </div>
              </div>
              <br>
              <p><strong>Choose an option:</strong></p>
              <p>• <strong>Continue</strong> - Resume with saved progress</p>
              <p>• <strong>Fresh Start</strong> - Start over (saved data will be kept as backup)</p>
            </div>
            <div class="project-footer">
              <button class="btn-primary" onclick="handleProjectChoice('continue', '${filename}')">
                📂 Continue
              </button>
              <button class="btn-secondary" onclick="handleProjectChoice('fresh', '${filename}')">
                🆕 Fresh Start
              </button>
            </div>
          </div>
          <style>
            .project-dialog-overlay {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0, 0, 0, 0.7);
              display: flex;
              justify-content: center;
              align-items: center;
              z-index: 10000;
            }
            .project-dialog {
              background: white;
              border-radius: 12px;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
              max-width: 500px;
              width: 90%;
            }
            .project-header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 1.5rem;
              border-radius: 12px 12px 0 0;
            }
            .project-body {
              padding: 2rem;
            }
            .project-stats {
              margin: 1rem 0;
              padding: 1rem;
              background: #f8f9fa;
              border-radius: 6px;
            }
            .stat {
              display: flex;
              justify-content: space-between;
              margin: 0.5rem 0;
            }
            .label {
              font-weight: 600;
            }
            .project-footer {
              padding: 1rem 2rem 2rem;
              display: flex;
              gap: 1rem;
              justify-content: flex-end;
            }
            .btn-primary, .btn-secondary {
              padding: 0.75rem 1.5rem;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 600;
              transition: all 0.3s;
            }
            .btn-primary {
              background: #28a745;
              color: white;
            }
            .btn-primary:hover {
              background: #218838;
            }
            .btn-secondary {
              background: #6c757d;
              color: white;
            }
            .btn-secondary:hover {
              background: #5a6268;
            }
          </style>
        `;
        
        document.body.appendChild(modal);
        window.projectDialogCallback = callback;
        
      } catch (error) {
        console.error('Failed to show project dialog:', error);
        callback('fresh');
      }
    } else {
      callback('fresh');
    }
  },


  exportAllData() {
    try {
      const exportData = {
        completeState: localStorage.getItem('iraje_complete_state'),
        testCases: this.getAllTestCaseStates(),
        metadata: localStorage.getItem('iraje_metadata'),
        header: localStorage.getItem('iraje_header'),
        backups: this.getAvailableBackups(),
        exportedAt: new Date().toISOString(),
        version: this.config.version
      };
      
      return JSON.stringify(exportData);
      
    } catch (error) {
      console.error('Failed to export data:', error);
      return null;
    }
  },

  // Import data from backup
  importAllData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      // Validate import data
      if (!data.version || !data.exportedAt) {
        throw new Error('Invalid import data format');
      }
      
      // Restore data
      if (data.completeState) {
        localStorage.setItem('iraje_complete_state', data.completeState);
      }
      
      if (data.testCases) {
        Object.entries(data.testCases).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      }
      
      if (data.metadata) {
        localStorage.setItem('iraje_metadata', data.metadata);
      }
      
      if (data.header) {
        localStorage.setItem('iraje_header', data.header);
      }
      
      console.log('✅ Data import completed successfully');
      
    
      window.location.reload();
      
      return true;
      
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  },


  getStorageStats() {
    const keys = Object.keys(localStorage);
    const stats = {
      totalKeys: keys.length,
      testCases: keys.filter(k => k.startsWith('test_')).length,
      projects: keys.filter(k => k.startsWith('project_')).length,
      backups: keys.filter(k => k.startsWith('iraje_backup_')).length,
      totalSize: JSON.stringify(localStorage).length,
      lastSave: this.lastSaveTime,
      autoSaveEnabled: !!this.autoSaveTimer,
      backupEnabled: !!this.backupTimer
    };
    
    return stats;
  }
};


window.handleProjectChoice = function(choice, filename) {
  const modal = document.querySelector('.project-dialog-overlay');
  if (modal) {
    modal.remove();
  }
  
  if (window.projectDialogCallback) {
    window.projectDialogCallback(choice);
    window.projectDialogCallback = null;
  }
};


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    Storage.init();
  });
} else {
  Storage.init();
}


window.Storage = Storage;

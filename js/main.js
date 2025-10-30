
const AppState = {
  workbook: null,
  sheets: [],
  selectedSheets: [],
  rowsByGroup: {},
  flatRows: [],
  loadedCount: 0,
  loadMs: 0,
  currentProject: null,
  els: {},
  autoSync: true,
  isUpdating: false
};


const SheetPicker = {
  open(sheetNames) {
    console.log('Opening sheet picker with sheets:', sheetNames);
    const sheetList = document.getElementById('sheetList');
    
    if (!sheetList) {
      console.error('Sheet list container not found');
      return;
    }
    
    sheetList.innerHTML = "";
    
    sheetNames.forEach((name, index) => {
      const id = "sheet_" + index;
      const row = document.createElement("div");
      row.className = "sheet-row";
      row.innerHTML = `
        <label class="sheet-label">
          <input type="checkbox" id="${id}" value="${name}" checked>
          <span class="sheet-name">${name}</span>
          <span class="sheet-icon">📋</span>
        </label>
      `;
      sheetList.appendChild(row);
    });
    
    const sheetPicker = document.getElementById('sheetPicker');
    if (sheetPicker) {
      sheetPicker.style.display = 'flex';
      console.log('Sheet picker displayed');
    }
  },

  close() {
    const sheetPicker = document.getElementById('sheetPicker');
    if (sheetPicker) {
      sheetPicker.style.display = 'none';
    }
  },

  applySelection() {
    const checks = document.querySelectorAll("#sheetList input[type=checkbox]");
    const selected = [];
    
    checks.forEach(checkbox => { 
      if (checkbox.checked) {
        selected.push(checkbox.value); 
      }
    });
    
    if (selected.length === 0) {
      alert('Please select at least one sheet to import.');
      return;
    }
    
    AppState.selectedSheets = selected;
    this.close();
    
    if (!AppState.workbook) {
      console.error('Workbook not available');
      return;
    }
    
    ExcelHandler.buildFromWorkbook(AppState.workbook, selected);
  }
};

const App = {
  syncTimeout: null,

  restoreApplicationState() {
    console.log('🔄 Starting application state restoration...');
    try {

      const savedState = Storage.loadAppState && Storage.loadAppState();
      if (savedState && savedState.flatRows && savedState.flatRows.length > 0) {
        // Restore core application state
        AppState.flatRows = savedState.flatRows || [];
        AppState.rowsByGroup = savedState.rowsByGroup || {};
        AppState.selectedSheets = savedState.selectedSheets || [];
        AppState.sheets = savedState.sheets || [];
        AppState.loadedCount = savedState.loadedCount || 0;
        AppState.currentProject = savedState.currentProject || null;
        console.log('✅ Core state restored:', {
          testCases: AppState.flatRows.length,
          modules: Object.keys(AppState.rowsByGroup).length,
          sheets: AppState.selectedSheets.length
        });
    
        if (Storage.loadAllTestCaseStates) Storage.loadAllTestCaseStates();

        if (Storage.loadHeaderFromStorage) Storage.loadHeaderFromStorage();
  
        this.rebuildWorkspaceUI();
   
        setTimeout(() => {
          this.initializeStatusFromImportedData && this.initializeStatusFromImportedData();
          this.updateAllComponentsOptimized && this.updateAllComponentsOptimized();
        }, 500);
        if (typeof showSuccessNotification === 'function') {
          showSuccessNotification(`✅ Restored ${AppState.flatRows.length} test cases from previous session!`);
        }
        return true;
      } else {
        console.log('ℹ️ No previous session to restore');
        return false;
      }
    } catch (error) {
      console.error('❌ State restoration failed:', error);
      if (typeof showErrorNotification === 'function') {
        showErrorNotification('Failed to restore previous session. Starting fresh.');
      }
      return false;
    }
  },


  rebuildWorkspaceUI() {
    console.log('🏗️ Rebuilding workspace UI...');
    try {

      if (!AppState.flatRows || AppState.flatRows.length === 0) {
        console.log('No test cases to rebuild');
        this.updateUIState(); 
        return;
      }
   
      this.groupTestCases();
  
      const loadInfo = Utils.$("#loadInfo");
      if (loadInfo) {
        loadInfo.innerHTML = `✅ Restored ${AppState.flatRows.length} test cases from previous session`;
      }
    
      this.updateUIState();
    
      this.ensureOptimizedUIRender();
      console.log('✅ Workspace UI rebuilt successfully');
    } catch (error) {
      console.error('❌ Failed to rebuild workspace UI:', error);
      this.updateUIState(); 
    }
  },


  ensureOptimizedUIRender() {
    if (AppState.isUpdating) return;
    AppState.isUpdating = true;
    requestIdleCallback(() => {
      try {
        if (AppState.flatRows && AppState.flatRows.length > 0) {
  
          if (!AppState.rowsByGroup || Object.keys(AppState.rowsByGroup).length === 0) {
            this.groupTestCases();
          }
          const sectionsRoot = document.getElementById('sectionsRoot');
          if (sectionsRoot) {
            sectionsRoot.innerHTML = '';
          }
    
          if (window.UIRenderer && UIRenderer.renderAllSectionsIncremental) {
            UIRenderer.renderAllSectionsIncremental();
          }
          this.updateUIState();
    
          setTimeout(() => {
            this.updateAllComponentsOptimized && this.updateAllComponentsOptimized();
 
            document.dispatchEvent(new CustomEvent('ExcelImportComplete'));
          }, 300);
        }
      } finally {
        AppState.isUpdating = false;
      }
    });
  },


  setupAutoSave() {

    const debouncedSave = this.debounce(() => {
      if (Storage.saveAppState) Storage.saveAppState();
    }, 1000);

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(debouncedSave);
      const sectionsRoot = document.getElementById('sectionsRoot');
      if (sectionsRoot) {
        observer.observe(sectionsRoot, {
          childList: true,
          subtree: true,
          attributes: true
        });
      }
    }

    window.addEventListener('beforeunload', () => {
      console.log('🔄 Saving state before page unload...');
      if (Storage.saveAppState) Storage.saveAppState();
    });

    setInterval(() => {
      if (AppState.flatRows && AppState.flatRows.length > 0 && Storage.saveAppState) {
        Storage.saveAppState();
      }
    }, 30000);

    window.addEventListener('blur', () => {
      if (Storage.saveAppState) Storage.saveAppState();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && Storage.saveAppState) {
        Storage.saveAppState();
      }
    });
    console.log('✅ Auto-save system initialized');
  },

  init() {
    console.log('🚀 Initializing Iraje Test Management Portal...');
    this.bindDOMElements();
    this.setupOptimizedEventHandlers();
    this.setupLogo();
    this.setupOptimizedAutoSync();
    this.initializeStatusHandler();
    this.setupAutoSave();
    Navigation.init();
    Dashboard.init();

    setTimeout(() => {
      const restored = this.restoreApplicationState();
      if (!restored) {

        if (Storage.loadHeaderFromStorage) Storage.loadHeaderFromStorage();
        this.updateUIState(); 
      } else {

        const currentPage = Navigation?.getCurrentPage?.() || 'workspace';
        if (currentPage === 'workspace') {
          console.log('🎯 Focusing on workspace restoration...');
          setTimeout(() => {
            this.rebuildWorkspaceUI();
          }, 100);
        }
      }
    }, 100);

    if (window.PerformanceOptimizer) {
      PerformanceOptimizer.init();
    }
    console.log('✅ Application initialized successfully');
  },


  initializeStatusHandler() {
    console.log('🔧 Initializing status and attendance handler...');
    

    document.addEventListener('change', (event) => {
      if (event.target && event.target.classList.contains('status-selector')) {
        this.handleStatusChange(event.target);
      }
    });
    

    document.addEventListener('ExcelImportComplete', () => {
      console.log('📊 Excel import completed, initializing status from imported data...');
      setTimeout(() => {
        this.initializeStatusFromImportedData();
      }, 1000);
    });
    
    console.log('✅ Status handler initialized');
  },


  handleStatusChange(statusSelect) {
    const selectedStatus = statusSelect.value;
    

    const testCaseItem = statusSelect.closest('.test-case-item');
    if (!testCaseItem) return;
    
    const testId = testCaseItem.id.replace('test-', ''); 
    console.log(`🔄 Status changed for ${testId}: ${selectedStatus}`);
    
  
    const attendedCheckbox = document.getElementById(`attended_${testId}`);
    const pendingCheckbox = document.getElementById(`pending_${testId}`);
    
    if (attendedCheckbox && pendingCheckbox) {
 
      if (selectedStatus === 'Pass' || selectedStatus === 'Fail' || selectedStatus === 'Blocked') {
      
        attendedCheckbox.checked = true;
        pendingCheckbox.checked = false;
        console.log(`✅ ${testId} marked as attended (status: ${selectedStatus})`);
      } else {
  
        attendedCheckbox.checked = false;
        pendingCheckbox.checked = true;
        console.log(`⏳ ${testId} marked as pending (no status)`);
      }
      
  
      attendedCheckbox.dispatchEvent(new Event('change'));
    }
    

    this.updateTestCaseStatus(testId, selectedStatus);
  },


  initializeStatusFromImportedData() {
    console.log('📋 Initializing status from imported Excel data...');
    
    const testCases = document.querySelectorAll('.test-case-item');
    let updatedCount = 0;
    
    testCases.forEach(testCase => {
      const testId = testCase.id.replace('test-', '');
      const saved = window.Storage?.loadRowState(testId) || {};
      
      // Debug log for each test case
      console.log(`🔍 Checking ${testId}:`, {
        savedStatus: saved.status,
        savedNotes: saved.notes,
        savedAttended: saved.attended,
        savedPending: saved.pending
      });
      

      const statusSelect = testCase.querySelector('.status-selector');
      if (statusSelect && saved.status) {
        console.log(`📝 Setting status for ${testId}: ${saved.status}`);
        statusSelect.value = saved.status;
        updatedCount++;
        

        const statusClass = `status-${saved.status.toLowerCase()}`;
        testCase.classList.remove('status-pass', 'status-fail', 'status-blocked');
        testCase.classList.add(statusClass);
      }
      

      const notesTextarea = testCase.querySelector('.notes-field');
      if (notesTextarea && saved.notes) {
        notesTextarea.value = saved.notes;
        console.log(`📄 Notes populated for ${testId}: ${saved.notes.substring(0, 50)}...`);
      }
      

      const attendedCheckbox = document.getElementById(`attended_${testId}`);
      const pendingCheckbox = document.getElementById(`pending_${testId}`);
      
      if (attendedCheckbox && pendingCheckbox) {
        const isAttended = saved.attended || ['Pass', 'Fail', 'Blocked'].includes(saved.status);
        const isPending = saved.pending || !isAttended;
        
        attendedCheckbox.checked = isAttended;
        pendingCheckbox.checked = isPending;
        
        console.log(`🎯 Attendance updated for ${testId}: attended=${isAttended}, pending=${isPending}`);
      }
    });
    
    console.log(`✅ Status initialization completed! Updated ${updatedCount} test cases.`);
    
    if (updatedCount > 0) {
      showSuccessNotification(`Imported status and attendance for ${updatedCount} test cases!`);
    }
  },

  bindDOMElements() {
    AppState.els = {
      file: Utils.$("#excelFile"),
      btnImport: Utils.$("#btnImport"),
      sectionsRoot: Utils.$("#sectionsRoot"),
      summaryTbody: Utils.$("#summaryTable tbody"),
      loadInfo: Utils.$("#loadInfo"),
      sheetPicker: Utils.$("#sheetPicker"),
      sheetList: Utils.$("#sheetList"),
      reportDate: Utils.$("#reportDate"),
      testerName: Utils.$("#testerName"),
      signature: Utils.$("#signature"),
      coverLogo: Utils.$("#coverLogo"),
      emptyState: Utils.$("#emptyState"),
      bottomActions: Utils.$("#bottomActions"),
      deleteSheetBtn: Utils.$("#deleteSheetBtn"),
      clearFileBtn: Utils.$("#clearFileBtn")
    };
  },

  setupOptimizedEventHandlers() {
    const els = AppState.els;
    
    // Debounced file change handler
    if (els.file) {
      els.file.addEventListener('change', this.debounce(() => {
        this.handleFileChange();
      }, 300));
    }
    
    if (els.btnImport) {
      els.btnImport.addEventListener("click", this.handleImport.bind(this));
    }


    const saveProjectBtn = Utils.$("#saveProjectBtn");
    if (saveProjectBtn) {
      saveProjectBtn.addEventListener('click', this.throttle(() => {
        this.handleSaveProject();
      }, 1000));
    }

    const downloadTemplateBtn = Utils.$("#downloadTemplateBtn");
    if (downloadTemplateBtn) {
      downloadTemplateBtn.addEventListener('click', this.downloadTemplate.bind(this));
    }

  
    if (els.reportDate) {
      els.reportDate.addEventListener('input', this.debounce(() => {
        Storage.saveHeader();
        this.triggerOptimizedSync();
      }, 500));
    }
    
    if (els.testerName) {
      els.testerName.addEventListener('input', this.debounce(() => {
        Storage.saveHeader();
        this.triggerOptimizedSync();
      }, 500));
    }
    
    if (els.signature) {
      els.signature.addEventListener('input', this.debounce(() => {
        Storage.saveHeader();
        this.triggerOptimizedSync();
      }, 500));
    }

    const deleteInput = Utils.$("#deleteConfirmInput");
    if (deleteInput) {
      deleteInput.addEventListener('input', this.validateDeleteInput.bind(this));
    }
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  setupOptimizedAutoSync() {

    setInterval(() => {
      if (AppState.autoSync && !AppState.isUpdating) {
        this.syncAllTabsOptimized();
      }
    }, 10000); 


    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(this.debounce(() => {
        if (AppState.autoSync && !AppState.isUpdating) {
          this.broadcastDataChange();
        }
      }, 2000));
      
      observer.observe(document.body, {
        childList: true,
        subtree: false, 
        attributes: false
      });
    }

    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  },

  handleFileChange() {
    const file = AppState.els.file?.files?.[0];
    const clearBtn = AppState.els.clearFileBtn;
    const fileLabel = Utils.$('.file-label');
    
    if (file) {
      if (clearBtn) clearBtn.classList.add('show');
      if (fileLabel) fileLabel.innerHTML = `<i class="fas fa-file-excel"></i> ${file.name}`;
    } else {
      if (clearBtn) clearBtn.classList.remove('show');
      if (fileLabel) fileLabel.innerHTML = '<i class="fas fa-folder-open"></i> Browse Files';
    }
  },

  setupLogo() {
    if (CONFIG.LOGO_DATA_URL && AppState.els.coverLogo) {
      AppState.els.coverLogo.src = CONFIG.LOGO_DATA_URL;
    }
  },

  async handleImport() {
    const f = AppState.els.file?.files && AppState.els.file.files[0];
    if (!f) { 
      showErrorNotification("Please choose a file first."); 
      return; 
    }

    try {
      showLoadingState(true);
      const loadInfo = Utils.$("#loadInfo");
      if (loadInfo) {
        loadInfo.textContent = "Reading file...";
      }

      const wb = await ExcelHandler.readFile(f);
      AppState.workbook = wb;
      const sheetNames = wb.SheetNames || [];
      AppState.sheets = sheetNames;
      
      if (loadInfo) {
        loadInfo.textContent = "File read successfully. Processing sheets...";
      }

      const filename = f.name.replace(/\.[^/.]+$/, "");
      

      if (window.ProjectManager) {
        ProjectManager.checkExistingProject(filename, (choice) => {
          if (choice === 'resume') {
            this.loadExistingProject(filename);
          } else {
            this.handleFreshImport(sheetNames);
          }
          showLoadingState(false);
        });
      } else {
        this.handleFreshImport(sheetNames);
        showLoadingState(false);
      }
      
    } catch (e) {
      console.error('Import error:', e);
      showErrorNotification(`Failed to import file: ${e.message}`);
      showLoadingState(false);
      
      const loadInfo = Utils.$("#loadInfo");
      if (loadInfo) {
        loadInfo.textContent = "";
      }
    }
  },

  loadExistingProject(filename) {
    if (window.ProjectManager) {
      const loaded = ProjectManager.loadProject(filename);
      if (loaded) {
        this.groupTestCases();
        this.ensureOptimizedUIRender();
        
        const loadInfo = Utils.$("#loadInfo");
        if (loadInfo) {
          loadInfo.innerHTML = `✅ Loaded ${AppState.flatRows.length} test cases from saved project.`;
        }
        
  
        setTimeout(() => {
          this.initializeStatusFromImportedData();
        }, 1000);
        
        this.triggerOptimizedSync();
      } else {
        showErrorNotification('Failed to load saved project data, starting fresh import.');
        this.handleFreshImport(AppState.sheets);
      }
    }
  },

  handleFreshImport(sheetNames) {
    if (sheetNames.length === 1) {
      AppState.selectedSheets = sheetNames;
      ExcelHandler.buildFromWorkbook(AppState.workbook, sheetNames);
    } else if (sheetNames.length > 1) {
      if (window.SheetPicker) {
        SheetPicker.open(sheetNames);
      } else {
        AppState.selectedSheets = sheetNames;
        ExcelHandler.buildFromWorkbook(AppState.workbook, sheetNames);
      }
    } else {
      showErrorNotification('No sheets found in file');
    }
  },

  handleSaveProject() {
    if (!AppState.flatRows || AppState.flatRows.length === 0) {
      showErrorNotification('No test cases to save. Please import data first.');
      return;
    }

    let projectName = AppState.currentProject;
    if (!projectName) {
      projectName = prompt('Enter project name:', 'Test Project ' + new Date().toDateString());
      if (!projectName) return;
    }

    if (window.ProjectManager) {
      const success = ProjectManager.saveProject(projectName);
      if (success) {
        AppState.currentProject = projectName;
      }
    }
  },

  downloadTemplate() {
    try {
      const link = document.createElement('a');
      link.href = 'assets/IrajeTestcaseTemplate.xlsx';
      link.download = 'IrajeTestcaseTemplate.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccessNotification('Template download started!');
    } catch (error) {
      showErrorNotification('Failed to download template.');
    }
  },

  validateDeleteInput() {
    const input = Utils.$("#deleteConfirmInput");
    const confirmBtn = Utils.$("#confirmDeleteBtn");
    const errorDiv = Utils.$("#deleteValidationError");
    
    if (input && confirmBtn) {
      if (input.value.trim().toUpperCase() === 'DELETE') {
        confirmBtn.disabled = false;
        if (errorDiv) errorDiv.style.display = 'none';
      } else {
        confirmBtn.disabled = true;
        if (errorDiv && input.value.trim().length > 0) {
          errorDiv.style.display = 'block';
        }
      }
    }
  },

  updateUIState() {
    if (AppState.isUpdating) return;
    
    const hasData = AppState.flatRows && AppState.flatRows.length > 0;
    const emptyState = AppState.els.emptyState;
    const sectionsRoot = AppState.els.sectionsRoot;
    const deleteSheetBtn = AppState.els.deleteSheetBtn;

    requestAnimationFrame(() => {
      if (hasData) {
        if (emptyState) emptyState.style.display = 'none';
        if (sectionsRoot) sectionsRoot.style.display = 'block';
        if (deleteSheetBtn) deleteSheetBtn.style.display = 'inline-flex';
      } else {
        if (emptyState) emptyState.style.display = 'block';
        if (sectionsRoot) sectionsRoot.style.display = 'none';
        if (deleteSheetBtn) deleteSheetBtn.style.display = 'none';
      }
    });
  },

  updateAllComponentsOptimized() {
    const updates = [];
    
    if (window.Summary && Summary.updateSummary) {
      updates.push(() => Summary.updateSummary());
    }
    if (window.Dashboard && Dashboard.updateDashboard) {
      updates.push(() => Dashboard.updateDashboard());
    }
    if (window.ReportGenerator && ReportGenerator.updateReportCounts) {
      updates.push(() => ReportGenerator.updateReportCounts());
    }

    // Batch execute updates
    updates.forEach((update, index) => {
      setTimeout(update, index * 100);
    });
  },

  broadcastDataChange() {
    this.triggerOptimizedSync();
  },

  triggerOptimizedSync() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    
    this.syncTimeout = setTimeout(() => {
      this.syncAllTabsOptimized();
      
      if (AppState.currentProject && window.ProjectManager) {
        ProjectManager.autoSaveProject();
      }
    }, 1000);
  },

  syncAllTabsOptimized() {
    if (AppState.isUpdating) return;

    const currentPage = Navigation?.getCurrentPage?.() || 'workspace';
    
    requestAnimationFrame(() => {
      switch(currentPage) {
        case 'summary':
          if (window.Summary) Summary.updateSummary();
          break;
        case 'reports':
          if (window.ReportGenerator) ReportGenerator.updateReportCounts();
          break;
        case 'status':
          if (window.Dashboard) Dashboard.updateDashboard();
          break;
      }
    });
  },

  markTestCaseAttended(testId) {
    if (window.ProjectManager) {
      ProjectManager.markTestCaseAttended(testId);
    }
    this.triggerOptimizedSync();
  },

  deleteTestCase(testId) {
    if (!confirm('Are you sure you want to delete this test case?')) {
      return;
    }

    AppState.flatRows = AppState.flatRows.filter(row => row.id !== testId);
    Storage.removeRowState(testId);
    
    this.groupTestCases();
    this.ensureOptimizedUIRender();
    this.broadcastDataChange();
    
    showSuccessNotification('Test case deleted successfully.');
  },

  groupTestCases() {
    AppState.rowsByGroup = {};
    
    AppState.flatRows.forEach(row => {
      const groupKey = row.module || row.sheet || 'General';
      if (!AppState.rowsByGroup[groupKey]) {
        AppState.rowsByGroup[groupKey] = [];
      }
      AppState.rowsByGroup[groupKey].push(row);
    });
  },

  updateTestCaseStatus(testId, status) {
    const currentState = window.Storage?.loadRowState(testId) || {};
    currentState.status = status;
    currentState.lastModified = new Date().toISOString();
    
   
    if (status && ['Pass', 'Fail', 'Blocked'].includes(status)) {
      currentState.attended = true;
      currentState.pending = false;
    } else {
      currentState.attended = false;
      currentState.pending = true;
    }
    
    window.Storage?.saveRowState(testId, currentState);
    
    
    if (status && status !== 'Not Executed') {
      this.markTestCaseAttended(testId);
    }
    
    console.log(`💾 Status updated for ${testId}: ${status}, attended: ${currentState.attended}`);
  },

  cleanup() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    AppState.isUpdating = false;
  }
};

const RecoverySystem = {

  checkForRecoveryData() {
    const recoveryData = localStorage.getItem('irajeRecoveryData');
    if (recoveryData) {
      this.showRecoveryModal(JSON.parse(recoveryData));
    }
  },

  showRecoveryModal(recoveryData) {
    const modal = document.createElement('div');
    modal.className = 'recovery-modal-overlay';
    modal.innerHTML = `
      <div class="recovery-modal">
        <div class="modal-header">
          <h3>🔄 Session Recovery Available</h3>
        </div>
        <div class="modal-body">
          <p>We found unsaved work from your previous session:</p>
          <ul>
            <li><strong>${recoveryData.testCaseCount || 0}</strong> test cases</li>
            <li><strong>${recoveryData.moduleCount || 0}</strong> modules</li>
            <li>Last saved: <strong>${new Date(recoveryData.timestamp).toLocaleString()}</strong></li>
          </ul>
          <p>Would you like to restore your previous work?</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="RecoverySystem.discardRecovery()">
            Start Fresh
          </button>
          <button class="btn-primary" onclick="RecoverySystem.restoreFromRecovery()">
            Restore Previous Session
          </button>
        </div>
      </div>
      <style>
        .recovery-modal-overlay {
          position: fixed;
          top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(0,0,0,0.7);
          display: flex; align-items: center; justify-content: center;
          z-index: 99999;
        }
        .recovery-modal {
          background: #fff;
          border-radius: 10px;
          max-width: 400px;
          width: 90vw;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
          padding: 0;
        }
        .recovery-modal .modal-header {
          background: #667eea;
          color: #fff;
          padding: 1.2rem 1.5rem;
          border-radius: 10px 10px 0 0;
        }
        .recovery-modal .modal-body {
          padding: 1.5rem;
        }
        .recovery-modal .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1rem 1.5rem 1.5rem;
        }
        .recovery-modal .btn-primary {
          background: #28a745;
          color: #fff;
          border: none;
          border-radius: 5px;
          padding: 0.5rem 1.2rem;
          font-weight: 600;
          cursor: pointer;
        }
        .recovery-modal .btn-secondary {
          background: #6c757d;
          color: #fff;
          border: none;
          border-radius: 5px;
          padding: 0.5rem 1.2rem;
          font-weight: 600;
          cursor: pointer;
        }
        .recovery-modal .btn-primary:hover {
          background: #218838;
        }
        .recovery-modal .btn-secondary:hover {
          background: #5a6268;
        }
      </style>
    `;
    document.body.appendChild(modal);
  },

  restoreFromRecovery() {
    App.restoreApplicationState();
    this.closeRecoveryModal();
    localStorage.removeItem('irajeRecoveryData');
  },

  discardRecovery() {
    localStorage.removeItem('irajeRecoveryData');
    localStorage.removeItem('irajeAppState');
    localStorage.removeItem('irajeAppState_backup');
    this.closeRecoveryModal();
  },

  closeRecoveryModal() {
    const modal = document.querySelector('.recovery-modal-overlay');
    if (modal) {
      modal.remove();
    }
  }
};

window.RecoverySystem = RecoverySystem;


function clearFileSelection() {
  const fileInput = Utils.$("#excelFile");
  const clearBtn = Utils.$("#clearFileBtn");
  const fileLabel = Utils.$('.file-label');
  
  if (fileInput) fileInput.value = '';
  if (clearBtn) clearBtn.classList.remove('show');
  if (fileLabel) fileLabel.innerHTML = '<i class="fas fa-folder-open"></i> Browse Files';
}

function showClearDataModal() {
  const modal = Utils.$("#clearDataModal");
  if (modal) modal.classList.add('show');
}

function closeClearDataModal() {
  const modal = Utils.$("#clearDataModal");
  if (modal) modal.classList.remove('show');
}

function confirmClearData() {
  try {
    Storage.clearStorage();
    AppState.flatRows = [];
    AppState.rowsByGroup = {};
    AppState.loadedCount = 0;
    AppState.currentProject = null;
    
    const sectionsRoot = Utils.$("#sectionsRoot");
    if (sectionsRoot) sectionsRoot.innerHTML = '';
    
    App.updateUIState();
    App.updateAllComponentsOptimized();
    
    closeClearDataModal();
    showSuccessNotification('All saved data cleared successfully.');
    clearFileSelection();
    
  } catch (error) {
    showErrorNotification('Failed to clear data.');
  }
}

function showDeleteSheetModal() {
  const modal = Utils.$("#deleteSheetModal");
  const input = Utils.$("#deleteConfirmInput");
  const confirmBtn = Utils.$("#confirmDeleteBtn");
  
  if (input) input.value = '';
  if (confirmBtn) confirmBtn.disabled = true;
  if (modal) modal.classList.add('show');
}

function closeDeleteSheetModal() {
  const modal = Utils.$("#deleteSheetModal");
  if (modal) modal.classList.remove('show');
}

function confirmDeleteSheet() {
  const input = Utils.$("#deleteConfirmInput");
  
  if (!input || input.value.trim().toUpperCase() !== 'DELETE') {
    showErrorNotification('Please type "DELETE" to confirm.');
    return;
  }

  try {
    AppState.flatRows = [];
    AppState.rowsByGroup = {};
    AppState.loadedCount = 0;
    AppState.selectedSheets = [];
    AppState.workbook = null;
    AppState.currentProject = null;
    
    const sectionsRoot = Utils.$("#sectionsRoot");
    if (sectionsRoot) sectionsRoot.innerHTML = '';
    
    const loadInfo = Utils.$("#loadInfo");
    if (loadInfo) loadInfo.textContent = '';
    
    App.updateUIState();
    App.updateAllComponentsOptimized();
    
    closeDeleteSheetModal();
    clearFileSelection();
    showSuccessNotification('All test cases deleted from workspace.');
    
  } catch (error) {
    showErrorNotification('Failed to delete test cases.');
  }
}

function exportSummary() {
  try {
    const summaryData = Summary.getSummaryData();
    
    if (!summaryData || summaryData.length === 0) {
      showErrorNotification('No summary data to export.');
      return;
    }

    const headers = ['Module', 'Total', 'Passed', 'Failed', '% Pass', 'Attended', 'Pending'];
    const csvContent = [
      headers.join(','),
      ...summaryData.map(row => [
        `"${row.module}"`,
        row.total,
        row.passed,
        row.failed,
        row.passRate + '%',
        row.attended,
        row.pending
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Test_Summary_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    showSuccessNotification('Summary exported successfully!');
    
  } catch (error) {
    showErrorNotification('Failed to export summary.');
  }
}

function showLoadingState(loading) {
  const btnImport = Utils.$("#btnImport");
  if (btnImport) {
    if (loading) {
      btnImport.disabled = true;
      btnImport.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    } else {
      btnImport.disabled = false;
      btnImport.innerHTML = '<i class="fas fa-upload"></i> Import Excel';
    }
  }
}


function updateTestCaseStatus(testId, status) {

  App.updateTestCaseStatus(testId, status);
  
  if (status && status !== 'Not Executed') {
    showSuccessNotification(`Test case ${testId} marked as ${status}`);
  }
}

function updateTestCaseNotes(testId, notes) {
  const currentState = window.Storage?.loadRowState(testId) || {};
  currentState.notes = notes;
  currentState.lastModified = new Date().toISOString();
  
  if (notes && notes.trim()) {
    currentState.attended = true;
    currentState.pending = false;
  }
  
  window.Storage?.saveRowState(testId, currentState);
  App.markTestCaseAttended(testId);
}


function updateTestCaseActualResults(testId, actualResults) {
  const currentState = window.Storage?.loadRowState(testId) || {};
  currentState.notes = actualResults; // Map actual results to notes field
  currentState.lastModified = new Date().toISOString();
  
  if (actualResults && actualResults.trim()) {
    currentState.attended = true;
    currentState.pending = false;
  }
  
  window.Storage?.saveRowState(testId, currentState);
  App.markTestCaseAttended(testId);
}

function addScreenshotToTestCase(testId, imageData) {
  const currentState = window.Storage?.loadRowState(testId) || {};
  if (!currentState.images) {
    currentState.images = [];
  }
  
  currentState.images.push(imageData);
  currentState.lastModified = new Date().toISOString();
  currentState.attended = true;
  currentState.pending = false;
  
  window.Storage?.saveRowState(testId, currentState);
  App.markTestCaseAttended(testId);
  
  showSuccessNotification('Screenshot added successfully');
}

function toggleTestCaseAttendance(testId, attended) {
  if (window.ProjectManager) {
    if (attended) {
      ProjectManager.markTestCaseAttended(testId);
    } else {
      ProjectManager.markTestCaseUnattended(testId);
    }
  }
  
  App.triggerOptimizedSync();
}


function manualInitializeStatus() {
  console.log('🔧 Manually initializing status...');
  App.initializeStatusFromImportedData();
}


window.AppState = AppState;
window.SheetPicker = SheetPicker;
window.App = App;
window.applySheetSelection = () => SheetPicker.applySelection();
window.closeSheetPicker = () => SheetPicker.close();
window.clearStorage = () => showClearDataModal();
window.clearFileSelection = clearFileSelection;
window.showClearDataModal = showClearDataModal;
window.closeClearDataModal = closeClearDataModal;
window.confirmClearData = confirmClearData;
window.showDeleteSheetModal = showDeleteSheetModal;
window.closeDeleteSheetModal = closeDeleteSheetModal;
window.confirmDeleteSheet = confirmDeleteSheet;
window.exportSummary = exportSummary;
window.updateTestCaseStatus = updateTestCaseStatus;
window.updateTestCaseNotes = updateTestCaseNotes;
window.updateTestCaseActualResults = updateTestCaseActualResults;
window.addScreenshotToTestCase = addScreenshotToTestCase;
window.toggleTestCaseAttendance = toggleTestCaseAttendance;
window.manualInitializeStatus = manualInitializeStatus; 


window.addEventListener("DOMContentLoaded", () => {
  try {
    App.init();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    if (window.showErrorNotification) {
      showErrorNotification('Application failed to start.');
    }
  }
});

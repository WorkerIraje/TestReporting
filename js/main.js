// Complete Enhanced Main Application with Performance Optimizations
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

// Enhanced Sheet Picker
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

  init() {
    this.bindDOMElements();
    this.setupOptimizedEventHandlers();
    this.setupLogo();
    this.setupOptimizedAutoSync();
    Navigation.init();
    Dashboard.init();
    Storage.loadHeaderFromStorage();
    this.updateUIState();
    
    // Initialize performance optimizations
    if (window.PerformanceOptimizer) {
      PerformanceOptimizer.init();
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

    // Enhanced save project button
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

    // Optimized header inputs with debouncing
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
    // Reduced frequency auto-sync
    setInterval(() => {
      if (AppState.autoSync && !AppState.isUpdating) {
        this.syncAllTabsOptimized();
      }
    }, 10000); // Increased to 10 seconds

    // Optimized mutation observer
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(this.debounce(() => {
        if (AppState.autoSync && !AppState.isUpdating) {
          this.broadcastDataChange();
        }
      }, 2000));
      
      observer.observe(document.body, {
        childList: true,
        subtree: false, // Reduced scope
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
      
      // Check for existing project using ProjectManager
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

  ensureOptimizedUIRender() {
    if (AppState.isUpdating) return;
    AppState.isUpdating = true;

    requestIdleCallback(() => {
      try {
        if (AppState.flatRows && AppState.flatRows.length > 0) {
          this.groupTestCases();
          
          const sectionsRoot = document.getElementById('sectionsRoot');
          if (sectionsRoot) {
            sectionsRoot.innerHTML = '';
          }
          
          if (window.UIRenderer && UIRenderer.renderAllSectionsIncremental) {
            UIRenderer.renderAllSectionsIncremental();
          }
          
          this.updateUIState();
          this.updateAllComponentsOptimized();
        }
      } finally {
        AppState.isUpdating = false;
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

  cleanup() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    AppState.isUpdating = false;
  }
};

// Optimized utility functions
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

// Enhanced test case interaction functions
function updateTestCaseStatus(testId, status) {
  const currentState = window.Storage?.loadRowState(testId) || {};
  currentState.status = status;
  currentState.lastModified = new Date().toISOString();
  
  if (status && status !== 'Not Executed') {
    currentState.attended = true;
  }
  
  window.Storage?.saveRowState(testId, currentState);
  App.markTestCaseAttended(testId);
  
  showSuccessNotification(`Test case ${testId} marked as ${status}`);
}

function updateTestCaseNotes(testId, notes) {
  const currentState = window.Storage?.loadRowState(testId) || {};
  currentState.notes = notes;
  currentState.lastModified = new Date().toISOString();
  
  if (notes && notes.trim()) {
    currentState.attended = true;
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

// Global functions
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
window.addScreenshotToTestCase = addScreenshotToTestCase;
window.toggleTestCaseAttendance = toggleTestCaseAttendance;

// Initialize app
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


// Enhanced Excel Handler - Complete Version with Fixed ID Sorting
const ExcelHandler = {
  // Enhanced validation rules
  validationRules: {
    required: ['id', 'title'],
    maxLengths: {
      id: 50,
      title: 200,
      module: 100
    },
    allowedStatuses: ['', 'Pass', 'Fail', 'Blocked', 'Skip'],
    allowedTypes: ['Functional', 'UI', 'API', 'Integration', 'Security', 'Performance', '']
  },

  // Import history and statistics
  importHistory: [],
  duplicateIds: new Map(),
  transformationRules: [],
  
  errors: [],
  warnings: [],

  // Phase 2: Support multiple file formats
  supportedFormats: {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
    '.tsv': 'text/tab-separated-values'
  },

  // Enhanced file reading with CSV support
  async readFile(file) {
    this.clearMessages();
    
    try {
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      this.showProgress("Reading file...");
      
      const fileExtension = this.getFileExtension(file.name);
      
      if (fileExtension === '.csv' || fileExtension === '.tsv') {
        return await this.readCsvFile(file, fileExtension === '.tsv');
      } else {
        return await this.readExcelFile(file);
      }
      
    } catch (error) {
      this.hideProgress();
      this.addError(`File Reading Error: ${error.message}`);
      throw error;
    }
  },

  // CSV file reader
  async readCsvFile(file, isTabSeparated = false) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onerror = () => reject(new Error("Failed to read CSV file"));
      
      reader.onload = e => {
        try {
          const text = e.target.result;
          const delimiter = isTabSeparated ? '\t' : ',';
          const workbook = this.csvToWorkbook(text, delimiter, file.name);
          
          const wbValidation = this.validateWorkbook(workbook);
          if (!wbValidation.isValid) {
            reject(new Error(wbValidation.message));
            return;
          }
          
          resolve(workbook);
        } catch(err) {
          reject(new Error(`CSV parsing failed: ${err.message}`));
        }
      };
      
      reader.readAsText(file);
    });
  },

  // Convert CSV to workbook format
  csvToWorkbook(text, delimiter, filename) {
    const lines = text.split('\n').filter(line => line.trim());
    const rows = lines.map(line => this.parseCsvLine(line, delimiter));
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Create workbook
    const wb = {
      Sheets: { [this.getFileBaseName(filename)]: ws },
      SheetNames: [this.getFileBaseName(filename)]
    };
    
    return wb;
  },

  // Parse CSV line handling quoted values
  parseCsvLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  },

  // Get file extension
  getFileExtension(filename) {
    return filename.toLowerCase().substring(filename.lastIndexOf('.'));
  },

  // Get file base name without extension
  getFileBaseName(filename) {
    return filename.substring(0, filename.lastIndexOf('.')) || filename;
  },

  // Enhanced file validation with multiple formats
  validateFile(file) {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const extension = this.getFileExtension(file.name);
    
    if (!file) {
      return { isValid: false, message: "No file selected" };
    }

    if (file.size > maxSize) {
      return { isValid: false, message: "File too large (max 50MB)" };
    }

    if (!this.supportedFormats[extension]) {
      const supported = Object.keys(this.supportedFormats).join(', ');
      return { 
        isValid: false, 
        message: `Invalid file type. Supported formats: ${supported}` 
      };
    }

    return { isValid: true };
  },

  // Original Excel reader (keeping for backward compatibility)
  async readExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onerror = () => reject(new Error("Failed to read file - file may be corrupted"));
      
      reader.onload = e => {
        try {
          const data = e.target.result;
          const wb = XLSX.read(data, { 
            type: "binary", 
            cellDates: false, 
            cellNF: false, 
            cellText: false 
          });
          
          const wbValidation = this.validateWorkbook(wb);
          if (!wbValidation.isValid) {
            reject(new Error(wbValidation.message));
            return;
          }
          
          resolve(wb);
        } catch(err) { 
          reject(new Error(`Excel parsing failed: ${err.message}`));
        }
      };
      
      reader.readAsBinaryString(file);
    });
  },

  // Validate workbook structure
  validateWorkbook(wb) {
    if (!wb || !wb.Sheets) {
      return { isValid: false, message: "Invalid file structure" };
    }

    const sheetNames = wb.SheetNames || [];
    if (sheetNames.length === 0) {
      return { isValid: false, message: "No sheets found in file" };
    }

    let hasData = false;
    for (const name of sheetNames) {
      const sheet = wb.Sheets[name];
      if (sheet && Object.keys(sheet).length > 1) {
        hasData = true;
        break;
      }
    }

    if (!hasData) {
      return { isValid: false, message: "No data found in any sheet" };
    }

    return { isValid: true };
  },

  // Phase 2: Duplicate ID detection and handling
  detectDuplicateIds(flatRows) {
    this.duplicateIds.clear();
    const idMap = new Map();
    
    flatRows.forEach((row, index) => {
      if (idMap.has(row.id)) {
        // Found duplicate
        const existingIndex = idMap.get(row.id);
        
        if (!this.duplicateIds.has(row.id)) {
          this.duplicateIds.set(row.id, [existingIndex]);
        }
        this.duplicateIds.get(row.id).push(index);
        
        // Auto-resolve by appending suffix
        let suffix = 1;
        let newId = `${row.id}_${suffix}`;
        while (idMap.has(newId)) {
          suffix++;
          newId = `${row.id}_${suffix}`;
        }
        
        this.addWarning(`Duplicate ID "${row.id}" found. Renamed to "${newId}"`);
        row.id = newId;
        row.isDuplicateResolved = true;
        idMap.set(newId, index);
      } else {
        idMap.set(row.id, index);
      }
    });
    
    return this.duplicateIds.size > 0;
  },

  // Phase 2: Data transformation rules
  applyTransformationRules(row) {
    this.transformationRules.forEach(rule => {
      try {
        switch(rule.type) {
          case 'uppercase':
            if (row[rule.field]) {
              row[rule.field] = row[rule.field].toUpperCase();
            }
            break;
            
          case 'lowercase':
            if (row[rule.field]) {
              row[rule.field] = row[rule.field].toLowerCase();
            }
            break;
            
          case 'trim_whitespace':
            if (row[rule.field]) {
              row[rule.field] = row[rule.field].trim().replace(/\s+/g, ' ');
            }
            break;
            
          case 'default_value':
            if (!row[rule.field] || row[rule.field].trim() === '') {
              row[rule.field] = rule.value;
            }
            break;
            
          case 'prefix':
            if (row[rule.field] && !row[rule.field].startsWith(rule.value)) {
              row[rule.field] = rule.value + row[rule.field];
            }
            break;
            
          case 'map_value':
            if (row[rule.field] && rule.mapping[row[rule.field]]) {
              row[rule.field] = rule.mapping[row[rule.field]];
            }
            break;
        }
      } catch (error) {
        this.addWarning(`Transformation rule failed for ${rule.field}: ${error.message}`);
      }
    });
    
    return row;
  },

  // Add default transformation rules
  initializeDefaultRules() {
    this.transformationRules = [
      {
        type: 'trim_whitespace',
        field: 'title',
        description: 'Remove extra whitespace from titles'
      },
      {
        type: 'trim_whitespace', 
        field: 'id',
        description: 'Remove extra whitespace from test IDs'
      },
      {
        type: 'default_value',
        field: 'type',
        value: 'Functional',
        description: 'Set default test type to Functional'
      },
      {
        type: 'map_value',
        field: 'type',
        mapping: {
          'UI Test': 'UI',
          'Api Test': 'API',
          'Functional Test': 'Functional',
          'Integration Test': 'Integration'
        },
        description: 'Normalize test type values'
      }
    ];
  },

  // Convert worksheet to JSON with headers
  sheetToJsonWithHeaders(ws) {
    const o = XLSX.utils.sheet_to_json(ws, { 
      header: 1, 
      raw: false, 
      defval: "" 
    });
    
    if (!o || !o.length) return { headers: [], rows: [] };

    let headerRowIdx = 0;
    for (let i = 0; i < o.length; i++) {
      const row = o[i];
      const nonEmpty = row.filter(c => Utils.safeTrim(c) !== "").length;
      if (nonEmpty >= 3) { 
        headerRowIdx = i; 
        break; 
      }
    }

    const headers = (o[headerRowIdx] || []).map(h => String(h ?? ""));
    const rows = o.slice(headerRowIdx + 1);
    return { headers, rows };
  },

  // Create header index for column mapping
  makeHeaderIndex(headers) {
    const idx = {};
    headers.forEach((h, i) => {
      const norm = Utils.normalizeHeaderKey(h);
      if (!(norm in idx)) idx[norm] = i;
      idx[h] = i;
    });
    return idx;
  },

  // Build column index with fallback strategies
  buildColumnIndex(map, headerIndex, sheetName) {
    if (map) {
      return {
        module: this.resolveColIndex(headerIndex, map.moduleCol),
        id: this.resolveColIndex(headerIndex, map.idCol),
        title: this.resolveColIndex(headerIndex, map.titleCol),
        field: this.resolveColIndex(headerIndex, map.fieldCol),
        type: this.resolveColIndex(headerIndex, map.typeCol),
        pre: this.resolveColIndex(headerIndex, map.preCol),
        steps: this.resolveColIndex(headerIndex, map.stepsCol),
        data: this.resolveColIndex(headerIndex, map.dataCol),
        expected: this.resolveColIndex(headerIndex, map.expectedCol),
      };
    }
    
    return this.autoDetectColumns(headerIndex);
  },

  // Auto-detect columns when no mapping exists
  autoDetectColumns(headerIndex) {
    const patterns = {
      id: /test.?id|id|#/i,
      title: /title|description|name|test.?case/i,
      module: /module|feature|component|area/i,
      field: /field|control|element/i,
      type: /type|category/i,
      pre: /pre.?condition|setup|prerequisite/i,
      steps: /step|procedure|action/i,
      data: /data|input|value/i,
      expected: /expected|result|outcome/i,
    };

    const colIdx = {};
    for (const [key, pattern] of Object.entries(patterns)) {
      colIdx[key] = -1;
      for (const header in headerIndex) {
        if (pattern.test(header)) {
          colIdx[key] = headerIndex[header];
          break;
        }
      }
    }

    return colIdx;
  },

  // Resolve column index from configuration
  resolveColIndex(headerIndex, configuredName) {
    if (!configuredName) return -1;
    
    if (configuredName in headerIndex) return headerIndex[configuredName];
    
    const trimmed = configuredName.trim();
    if (trimmed && (trimmed in headerIndex)) return headerIndex[trimmed];
    
    const norm = Utils.normalizeHeaderKey(configuredName);
    if (norm in headerIndex) return headerIndex[norm];
    
    for (const key in headerIndex) {
      if (Utils.safeTrim(key) === trimmed) return headerIndex[key];
    }
    
    return -1;
  },

  // Validate column mapping
  validateColumnMapping(colIdx, sheetName) {
    const missing = [];
    if (colIdx.id === -1) missing.push('Test ID');
    if (colIdx.title === -1) missing.push('Title/Description');

    if (missing.length > 0) {
      this.addWarning(`Sheet "${sheetName}": Could not find columns: ${missing.join(', ')}`);
    }
  },

  // Check if row is non-data (summary, total, etc.)
  isNonDataRow(firstCell) {
    const t = Utils.normalizeHeaderKey(firstCell || "");
    if (!t) return false;
    if (t.includes("iraje pam test cases summary")) return true;
    if (t.startsWith("total:")) return true;
    if (t.startsWith("execution coverage:")) return true;
    return false;
  },

  // Parse individual row with better data handling
  parseRow(r, colIdx, sheetName, rowNum) {
    const firstCell = r[0];
    if (this.isNonDataRow(firstCell)) return null;

    const testId = Utils.safeTrim(colIdx.id >= 0 ? r[colIdx.id] : "");
    const title = Utils.safeTrim(colIdx.title >= 0 ? r[colIdx.title] : "");
    
    if (!testId && !title) return null;

    const row = {
      sheet: sheetName,
      rowNumber: rowNum,
      module: Utils.safeTrim(colIdx.module >= 0 ? r[colIdx.module] : sheetName),
      id: testId || `AUTO_${sheetName}_${rowNum}`,
      title: title || `Untitled Test Case`,
      field: Utils.safeTrim(colIdx.field >= 0 ? r[colIdx.field] : ""),
      type: Utils.safeTrim(colIdx.type >= 0 ? r[colIdx.type] : ""),
      pre: Utils.safeTrim(colIdx.pre >= 0 ? r[colIdx.pre] : ""),
      steps: Utils.safeTrim(colIdx.steps >= 0 ? r[colIdx.steps] : ""),
      data: Utils.safeTrim(colIdx.data >= 0 ? r[colIdx.data] : ""),
      expected: Utils.safeTrim(colIdx.expected >= 0 ? r[colIdx.expected] : ""),
      isAutoGenerated: !testId
    };

    return row;
  },

  // Validate individual row data
  validateRowData(row, rowNum) {
    const rules = this.validationRules;
    
    for (const field of rules.required) {
      if (!row[field] || row[field].trim() === '') {
        return { 
          isValid: false, 
          message: `Missing required field: ${field}` 
        };
      }
    }

    for (const [field, maxLength] of Object.entries(rules.maxLengths)) {
      if (row[field] && row[field].length > maxLength) {
        this.addWarning(`Row ${rowNum}: ${field} exceeds ${maxLength} characters (truncated)`);
        row[field] = row[field].substring(0, maxLength) + '...';
      }
    }

    return { isValid: true };
  },

  // Enhanced sheet parsing with validation
  parseSheet(sheetName, ws) {
    this.showProgress(`Processing sheet: ${sheetName}...`);
    
    try {
      const map = CONFIG.SHEET_MAP[sheetName];
      const { headers, rows } = this.sheetToJsonWithHeaders(ws);
      
      if (headers.length === 0) {
        this.addWarning(`Sheet "${sheetName}" appears to be empty`);
        return [];
      }

      const headerIndex = this.makeHeaderIndex(headers);
      const colIdx = this.buildColumnIndex(map, headerIndex, sheetName);
      
      this.validateColumnMapping(colIdx, sheetName);

      const out = [];
      let rowNum = 2;

      for (const r of rows) {
        try {
          let parsedRow = this.parseRow(r, colIdx, sheetName, rowNum);
          if (parsedRow) {
            // Apply transformation rules
            parsedRow = this.applyTransformationRules(parsedRow);
            
            // Validate row data
            const validation = this.validateRowData(parsedRow, rowNum);
            if (validation.isValid) {
              out.push(parsedRow);
            } else {
              this.addWarning(`Row ${rowNum} in "${sheetName}": ${validation.message}`);
            }
          }
        } catch (error) {
          this.addError(`Error processing row ${rowNum} in "${sheetName}": ${error.message}`);
        }
        rowNum++;
      }

      return out;
      
    } catch (error) {
      this.addError(`Error processing sheet "${sheetName}": ${error.message}`);
      return [];
    }
  },

  // **FIXED: Proper Test ID comparison for sorting**
  compareTestIds(idA, idB) {
    // Extract the prefix and number parts
    const parseTestId = (id) => {
      const match = id.match(/^([A-Za-z-]*?)(\d+)(.*)$/);
      if (match) {
        return {
          prefix: match[1] || '',
          number: parseInt(match[1], 10),
          suffix: match[2] || ''
        };
      }
      return { prefix: id, number: 999999, suffix: '' };
    };

    const parsedA = parseTestId(idA);
    const parsedB = parseTestId(idB);

    // First, compare by prefix (TC-, EPM-, etc.)
    if (parsedA.prefix !== parsedB.prefix) {
      return parsedA.prefix.localeCompare(parsedB.prefix);
    }

    // Then, compare by number (1, 2, 3... not 1, 10, 2, 20...)
    if (parsedA.number !== parsedB.number) {
      return parsedA.number - parsedB.number;
    }

    // Finally, compare by suffix if needed
    return parsedA.suffix.localeCompare(parsedB.suffix);
  },

  // **FIXED: Enhanced build process with proper sorting within modules**
  async buildFromWorkbook(wb, sheetNames) {
    const t0 = Utils.nowMs();
    this.clearMessages();
    this.initializeDefaultRules();
    
    const state = window.AppState;
    state.rowsByGroup = {};
    state.flatRows = [];
    state.loadedCount = 0;

    let usedSheets = 0;
    let totalRows = 0;

    this.showProgress("Processing sheets...");

    // Process all sheets
    for (let i = 0; i < sheetNames.length; i++) {
      const name = sheetNames[i];
      if (!wb.Sheets[name]) {
        this.addWarning(`Sheet "${name}" not found in workbook`);
        continue;
      }

      this.showProgress(`Processing sheet ${i + 1}/${sheetNames.length}: ${name}...`);
      
      usedSheets++;
      const rows = this.parseSheet(name, wb.Sheets[name]);
      
      rows.forEach(row => {
        state.flatRows.push(row);
        totalRows++;
      });

      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // **STEP 1: Sort ALL test cases by ID FIRST (before grouping)**
    this.showProgress("Sorting test cases by ID...");
    state.flatRows.sort((a, b) => {
      return this.compareTestIds(a.id, b.id);
    });

    // **STEP 2: Detect and resolve duplicates after sorting**
    this.showProgress("Checking for duplicate IDs...");
    this.detectDuplicateIds(state.flatRows);

    // **STEP 3: Group rows AFTER sorting (maintains order within groups)**
    this.showProgress("Grouping test cases by modules...");
    state.rowsByGroup = {};
    
    state.flatRows.forEach(row => {
      const groupKey = (CONFIG.GROUP_BY === "module")
        ? (row.module || row.sheet || "General")
        : row.sheet;
        
      if (!state.rowsByGroup[groupKey]) {
        state.rowsByGroup[groupKey] = [];
      }
      state.rowsByGroup[groupKey].push(row);
    });

    state.loadedCount = state.flatRows.length;
    state.loadMs = Math.max(1, Utils.nowMs() - t0);
    
    // Save import history
    this.saveImportHistory(usedSheets, totalRows, state.loadMs);
    
    this.showProgress("Building user interface...");
    
    // Clear and rebuild UI
    state.els.sectionsRoot.innerHTML = "";
    UIRenderer.renderAllSectionsIncremental();
    
    // Show results with enhanced statistics
    const statusMsg = this.buildEnhancedStatusMessage(usedSheets, totalRows, state.loadMs);
    state.els.loadInfo.innerHTML = statusMsg;
    
    Summary.updateSummary();
    this.hideProgress();
    
    // Show any errors/warnings
    this.showMessages();
  },

  // Import history tracking
  saveImportHistory(usedSheets, totalRows, loadMs) {
    const importRecord = {
      timestamp: new Date().toISOString(),
      sheetsProcessed: usedSheets,
      totalRows: totalRows,
      processingTime: loadMs,
      errors: this.errors.length,
      warnings: this.warnings.length,
      duplicatesFound: this.duplicateIds.size,
      transformationsApplied: this.transformationRules.length
    };
    
    this.importHistory.unshift(importRecord);
    
    // Keep only last 10 imports
    if (this.importHistory.length > 10) {
      this.importHistory = this.importHistory.slice(0, 10);
    }
    
    // Save to localStorage
    try {
      localStorage.setItem('excel_import_history', JSON.stringify(this.importHistory));
    } catch(e) {
      console.warn('Failed to save import history:', e);
    }
  },

  // Load import history from localStorage
  loadImportHistory() {
    try {
      const saved = localStorage.getItem('excel_import_history');
      if (saved) {
        this.importHistory = JSON.parse(saved);
      }
    } catch(e) {
      console.warn('Failed to load import history:', e);
      this.importHistory = [];
    }
  },

  // Enhanced status message with more details
  buildEnhancedStatusMessage(usedSheets, totalRows, loadMs) {
    let msg = `✅ Loaded ${totalRows} tests from ${usedSheets} sheet(s) in ${loadMs.toFixed(0)}ms.`;
    
    if (this.duplicateIds.size > 0) {
      msg += ` <span style="color: blue;">🔄 ${this.duplicateIds.size} duplicates resolved</span>`;
    }
    
    if (this.warnings.length > 0) {
      msg += ` <span style="color: orange;">⚠️ ${this.warnings.length} warnings</span>`;
    }
    
    if (this.errors.length > 0) {
      msg += ` <span style="color: red;">❌ ${this.errors.length} errors</span>`;
    }
    
    // Add import history link
    msg += ` <a href="#" onclick="ExcelHandler.showImportHistory()" style="margin-left: 10px;">📊 View History</a>`;
    
    return msg;
  },

  // Show import history modal
  showImportHistory() {
    const history = this.importHistory;
    if (history.length === 0) {
      alert('No import history available.');
      return;
    }
    
    let content = 'Recent Import History:\n\n';
    history.forEach((record, index) => {
      const date = new Date(record.timestamp).toLocaleString();
      content += `${index + 1}. ${date}\n`;
      content += `   Sheets: ${record.sheetsProcessed}, Rows: ${record.totalRows}\n`;
      content += `   Time: ${record.processingTime.toFixed(0)}ms\n`;
      content += `   Issues: ${record.errors} errors, ${record.warnings} warnings\n`;
      if (record.duplicatesFound > 0) {
        content += `   Duplicates: ${record.duplicatesFound} resolved\n`;
      }
      content += '\n';
    });
    
    alert(content);
  },

  // Export processed data for backup/analysis
  exportProcessedData() {
    const state = window.AppState;
    if (!state.flatRows || state.flatRows.length === 0) {
      alert('No data to export. Please import a file first.');
      return;
    }
    
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      totalRows: state.flatRows.length,
      importHistory: this.importHistory[0] || null,
      testCases: state.flatRows.map(row => ({
        ...row,
        executionStatus: Storage.loadRowState(row.id)?.status || '',
        executionNotes: Storage.loadRowState(row.id)?.notes || ''
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test_cases_export_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Message management
  clearMessages() {
    this.errors = [];
    this.warnings = [];
  },

  addError(message) {
    this.errors.push(message);
    console.error('Excel Handler Error:', message);
  },

  addWarning(message) {
    this.warnings.push(message);
    console.warn('Excel Handler Warning:', message);
  },

  showMessages() {
    if (this.errors.length > 0 || this.warnings.length > 0) {
      const messages = [
        ...this.errors.map(e => `❌ ${e}`),
        ...this.warnings.map(w => `⚠️ ${w}`)
      ];
      
      alert(`Import completed with issues:\n\n${messages.slice(0, 10).join('\n')}${messages.length > 10 ? `\n\n... and ${messages.length - 10} more` : ''}`);
    }
  },

  // Progress indication
  showProgress(message) {
    const els = window.AppState?.els;
    if (els?.loadInfo) {
      els.loadInfo.textContent = message;
    }
  },

  hideProgress() {
    const els = window.AppState?.els;
    if (els?.loadInfo) {
      els.loadInfo.textContent = '';
    }
  },

  // Initialize Phase 2 features
  init() {
    this.loadImportHistory();
    this.initializeDefaultRules();
  }
};

// Initialize Excel Handler
ExcelHandler.init();

// Export enhanced handler
window.ExcelHandler = ExcelHandler;

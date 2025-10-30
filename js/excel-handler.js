
const ExcelHandler = {
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


  importHistory: [],
  duplicateIds: new Map(),
  transformationRules: [],
  
  errors: [],
  warnings: [],


  supportedFormats: {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
    '.tsv': 'text/tab-separated-values'
  },


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


  csvToWorkbook(text, delimiter, filename) {
    const lines = text.split('\n').filter(line => line.trim());
    const rows = lines.map(line => this.parseCsvLine(line, delimiter));
    

    const ws = XLSX.utils.aoa_to_sheet(rows);
    

    const wb = {
      Sheets: { [this.getFileBaseName(filename)]: ws },
      SheetNames: [this.getFileBaseName(filename)]
    };
    
    return wb;
  },


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


  getFileExtension(filename) {
    return filename.toLowerCase().substring(filename.lastIndexOf('.'));
  },


  getFileBaseName(filename) {
    return filename.substring(0, filename.lastIndexOf('.')) || filename;
  },

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


  detectDuplicateIds(flatRows) {
    this.duplicateIds.clear();
    const idMap = new Map();
    
    flatRows.forEach((row, index) => {
      if (idMap.has(row.id)) {

        const existingIndex = idMap.get(row.id);
        
        if (!this.duplicateIds.has(row.id)) {
          this.duplicateIds.set(row.id, [existingIndex]);
        }
        this.duplicateIds.get(row.id).push(index);
        
   
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


  makeHeaderIndex(headers) {
    const idx = {};
    headers.forEach((h, i) => {
      const norm = Utils.normalizeHeaderKey(h);
      if (!(norm in idx)) idx[norm] = i;
      idx[h] = i;
    });
    return idx;
  },


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
      // **NEW: Status and Actual Result patterns**
      status: /status|result|outcome|pass|fail|block/i,
      actualResult: /actual.?result|actual|actual.?output|observed.?result/i,
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
        // **NEW: Status and Actual Result columns**
        status: this.resolveColIndex(headerIndex, map.statusCol),
        actualResult: this.resolveColIndex(headerIndex, map.actualResultCol),
      };
    }
    return this.autoDetectColumns(headerIndex);
  },


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


  validateColumnMapping(colIdx, sheetName) {
    const missing = [];
    if (colIdx.id === -1) missing.push('Test ID');
    if (colIdx.title === -1) missing.push('Title/Description');

    if (missing.length > 0) {
      this.addWarning(`Sheet "${sheetName}": Could not find columns: ${missing.join(', ')}`);
    }
  },

  isNonDataRow(firstCell) {
    const t = Utils.normalizeHeaderKey(firstCell || "");
    if (!t) return false;
    if (t.includes("iraje pam test cases summary")) return true;
    if (t.startsWith("total:")) return true;
    if (t.startsWith("execution coverage:")) return true;
    return false;
  },


  parseRow(r, colIdx, sheetName, rowNum) {
    const firstCell = r[0];
    if (this.isNonDataRow(firstCell)) return null;

    const testId = Utils.safeTrim(colIdx.id >= 0 ? r[colIdx.id] : "");
    const title = Utils.safeTrim(colIdx.title >= 0 ? r[colIdx.title] : "");
    
    if (!testId && !title) return null;


    const statusRaw = Utils.safeTrim(colIdx.status >= 0 ? r[colIdx.status] : "");
    const actualResult = Utils.safeTrim(colIdx.actualResult >= 0 ? r[colIdx.actualResult] : "");

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
      
      // **NEW: Status and Actual Result fields**
      importedStatus: this.normalizeStatus(statusRaw),
      importedActualResult: actualResult,
      importedAttended: this.determineAttendance(statusRaw),
      
      isAutoGenerated: !testId
    };

    return row;
  },

  normalizeStatus(statusRaw) {
    if (!statusRaw || typeof statusRaw !== 'string') return '';
    
    const status = statusRaw.toLowerCase().trim();
    

    if (status === 'pass' || status === 'passed' || status === 'success' || status === 'ok') {
      return 'Pass';
    } else if (status === 'fail' || status === 'failed' || status === 'failure' || status === 'error') {
      return 'Fail';
    } else if (status === 'block' || status === 'blocked' || status === 'skip' || status === 'skipped') {
      return 'Blocked';
    }
    return '';
  },

  determineAttendance(statusRaw) {
    if (!statusRaw || typeof statusRaw !== 'string') return false;
    
    const status = statusRaw.toLowerCase().trim();

    return ['pass', 'passed', 'fail', 'failed', 'failure', 'block', 'blocked', 'skip', 'skipped'].includes(status);
  },

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

            parsedRow = this.applyTransformationRules(parsedRow);
            

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

  compareTestIds(idA, idB) {

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

    if (parsedA.prefix !== parsedB.prefix) {
      return parsedA.prefix.localeCompare(parsedB.prefix);
    }

    if (parsedA.number !== parsedB.number) {
      return parsedA.number - parsedB.number;
    }


    return parsedA.suffix.localeCompare(parsedB.suffix);
  },


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

    this.showProgress("Sorting test cases by ID...");
    state.flatRows.sort((a, b) => {
      return this.compareTestIds(a.id, b.id);
    });

    this.showProgress("Checking for duplicate IDs...");
    this.detectDuplicateIds(state.flatRows);

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

    this.showProgress("Storing imported status and actual results...");
    state.flatRows.forEach(row => {
      if (row.importedStatus || row.importedActualResult) {
        const stateData = {
          status: row.importedStatus || '',
          notes: row.importedActualResult || '', 
          attended: row.importedAttended || false,
          pending: !row.importedAttended,
          images: [],
          lastModified: new Date().toISOString(),
          imported: true
        };

        if (window.Storage && typeof Storage.saveRowState === 'function') {
          Storage.saveRowState(row.id, stateData);
        }
      }
    });

    this.saveImportHistory(usedSheets, totalRows, state.loadMs);
    this.showProgress("Building user interface...");

    state.els.sectionsRoot.innerHTML = "";
    UIRenderer.renderAllSectionsIncremental();

    const statusMsg = this.buildEnhancedStatusMessage(usedSheets, totalRows, state.loadMs);
    state.els.loadInfo.innerHTML = statusMsg;
    Summary.updateSummary();
    this.hideProgress();

    this.showMessages();

    setTimeout(() => {
      Storage.saveAppState();
      console.log('✅ Auto-saved after Excel import');
    }, 1000);

    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('ExcelImportComplete'));
    }, 500);
  },


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
    

    if (this.importHistory.length > 10) {
      this.importHistory = this.importHistory.slice(0, 10);
    }
    

    try {
      localStorage.setItem('excel_import_history', JSON.stringify(this.importHistory));
    } catch(e) {
      console.warn('Failed to save import history:', e);
    }
  },


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
    

    msg += ` <a href="#" onclick="ExcelHandler.showImportHistory()" style="margin-left: 10px;">📊 View History</a>`;
    
    return msg;
  },


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


  init() {
    this.loadImportHistory();
    this.initializeDefaultRules();
  }
};


ExcelHandler.init();


window.ExcelHandler = ExcelHandler;

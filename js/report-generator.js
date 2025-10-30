
const ReportGenerator = {
  currentReportType: null,
  reportHistory: [],
  previewConfig: null,
  previewTestCases: null,


  init() {
    this.loadReportHistory();
    this.updateReportCounts();
    this.createReportModal();
  },


  updateReportCounts() {
    const state = window.AppState;
    if (!state || !state.flatRows) return;

    const stats = this.calculateReportStats();
    
   
    const defectEl = document.getElementById('defectStats');
    if (defectEl) {
      const statNumber = defectEl.querySelector('.stat-number');
      if (statNumber) statNumber.textContent = stats.failed;
    }


    const fullEl = document.getElementById('fullStats');
    if (fullEl) {
      const statNumber = fullEl.querySelector('.stat-number');
      if (statNumber) statNumber.textContent = stats.total;
    }


    const securityEl = document.getElementById('securityStats');
    if (securityEl) {
      const statNumber = securityEl.querySelector('.stat-number');
      if (statNumber) statNumber.textContent = stats.security;
    }
  },


  calculateReportStats() {
    const state = window.AppState;
    let failed = 0, total = 0, security = 0;

    if (state.flatRows) {
      total = state.flatRows.length;
      
      state.flatRows.forEach(row => {
        const saved = window.Storage?.loadRowState(row.id) || {};
        if ((saved.status || '').toLowerCase() === 'fail') failed++;
        
        if (this.isSecurityTest(row)) security++;
      });
    }

    return { failed, total, security };
  },


  isSecurityTest(row) {
    const securityKeywords = [
      'security', 'authentication', 'authorization', 'login', 
      'password', 'access', 'privilege', 'permission', 'encryption',
      'vulnerability', 'injection', 'xss', 'csrf'
    ];
    
    const text = `${row.title} ${row.module} ${row.type} ${row.steps}`.toLowerCase();
    return securityKeywords.some(keyword => text.includes(keyword));
  },


  refreshReports() {
    console.log('🔄 Refreshing Reports...');
    
    const refreshBtn = document.getElementById('refreshReportsBtn');
    const refreshIcon = document.getElementById('refreshReportsIcon');
    
    if (refreshBtn && refreshIcon) {
      refreshBtn.classList.add('refreshing');
      refreshBtn.disabled = true;
      refreshIcon.classList.add('fa-spin');
      
      const originalText = refreshBtn.querySelector('span').textContent;
      refreshBtn.querySelector('span').textContent = 'Refreshing...';
    }

    setTimeout(() => {
      try {
        this.syncWithWorkspace();
        this.updateReportCounts();
        this.loadReportHistory();
        
        if (window.showSuccessNotification) {
          showSuccessNotification('Reports refreshed successfully!');
        }
        
      } catch (error) {
        console.error('❌ Error refreshing reports:', error);
        if (window.showErrorNotification) {
          showErrorNotification('Failed to refresh reports.');
        }
      } finally {
        if (refreshBtn && refreshIcon) {
          refreshBtn.classList.remove('refreshing');
          refreshBtn.disabled = false;
          refreshIcon.classList.remove('fa-spin');
          refreshBtn.querySelector('span').textContent = originalText;
        }
      }
    }, 1000);
  },

 
  syncWithWorkspace() {
    const state = window.AppState;
    
    if (!state || !state.flatRows || state.flatRows.length === 0) {
      console.warn('⚠️ No workspace data to sync');
      return false;
    }

    console.log(`📋 Syncing ${state.flatRows.length} test cases with reports`);
    const stats = this.calculateReportStats();
    console.log('📊 Updated report stats:', stats);
    
    return true;
  },


  generateDefectReport() { this.generateReport('defect'); },
  generateFullReport() { this.generateReport('full'); },
  generateSecurityReport() { this.generateReport('security'); },

  
  generateReport(reportType) {
    const state = window.AppState;
    if (!state.flatRows || state.flatRows.length === 0) {
      alert('No test data available. Please import test cases first.');
      return;
    }

    this.currentReportType = reportType;
    this.showReportModal(reportType);
  },

  
  createReportModal() {
    if (document.getElementById('enhancedReportModal')) return;

    const modalHTML = `
    <div class="enhanced-modal-overlay" id="enhancedReportModal" style="display: none;">
      <div class="enhanced-modal-content">
        <div class="enhanced-modal-header">
          <h3 id="enhancedReportTitle">Report Configuration</h3>
          <button class="enhanced-modal-close" onclick="ReportGenerator.closeReportModal()">&times;</button>
        </div>
        <div class="enhanced-modal-body">
          
          <!-- Report Format Selection -->
          <div class="enhanced-form-section">
            <h4>📄 Report Format</h4>
            <div class="format-selection">
              <div class="format-option">
                <input type="radio" id="formatPdf" name="reportFormat" value="pdf" checked>
                <label for="formatPdf" class="format-label">
                  <i class="fas fa-file-pdf"></i>
                  <span>PDF</span>
                  <small>Professional, print-ready format</small>
                </label>
              </div>
              <div class="format-option">
                <input type="radio" id="formatHtml" name="reportFormat" value="html">
                <label for="formatHtml" class="format-label">
                  <i class="fas fa-code"></i>
                  <span>HTML</span>
                  <small>Interactive, web-viewable format</small>
                </label>
              </div>
              <div class="format-option disabled">
                <input type="radio" id="formatDocx" name="reportFormat" value="docx" disabled>
                <label for="formatDocx" class="format-label">
                  <i class="fas fa-file-word"></i>
                  <span>DOCX</span>
                  <small>Coming Soon - Editable format</small>
                </label>
              </div>
            </div>
          </div>

          <!-- Report Information -->
          <div class="enhanced-form-section">
            <h4>📝 Report Information</h4>
            
            <div class="enhanced-form-row">
              <div class="enhanced-form-group">
                <label for="reportTitleInput">Report Title *</label>
                <input type="text" id="reportTitleInput" value="Iraje EPM Testing Report" required>
              </div>
            </div>
            
            <div class="enhanced-form-row">
              <div class="enhanced-form-group">
                <label for="testerNameInput">Tester Name *</label>
                <input type="text" id="testerNameInput" placeholder="e.g., John Doe" required>
              </div>
              <div class="enhanced-form-group">
                <label for="reportDateInput">Date (DD/MM/YYYY) *</label>
                <input type="text" id="reportDateInput" placeholder="23/08/2025" pattern="\\d{2}/\\d{2}/\\d{4}" required>
                <small class="date-help">Please enter date in DD/MM/YYYY format</small>
              </div>
            </div>
            
            <div class="enhanced-form-row">
              <div class="enhanced-form-group">
                <label for="buildVersionInput">Build/Version *</label>
                <input type="text" id="buildVersionInput" value="Alpha.v1_p1" required>
              </div>
              <div class="enhanced-form-group">
                <label for="projectNameInput">Project Name</label>
                <input type="text" id="projectNameInput" value="Iraje EPM">
              </div>
            </div>
            
            <div class="enhanced-form-row">
              <div class="enhanced-form-group full-width">
                <label for="additionalNotesInput">Additional Notes</label>
                <textarea id="additionalNotesInput" rows="3" placeholder="Any additional notes for this report..."></textarea>
              </div>
            </div>
          </div>

          <!-- Report Options -->
          <div class="enhanced-form-section">
            <h4>⚙️ Report Options</h4>
            <div class="options-grid">
              <label class="option-checkbox">
                <input type="checkbox" id="includeScreenshots" checked>
                <span class="checkmark"></span>
                Include Screenshots
              </label>
              <label class="option-checkbox">
                <input type="checkbox" id="includeDetailedSteps" checked>
                <span class="checkmark"></span>
                Include Detailed Steps
              </label>
              <label class="option-checkbox">
                <input type="checkbox" id="includeExecutionNotes" checked>
                <span class="checkmark"></span>
                Include Execution Notes
              </label>
              <label class="option-checkbox">
                <input type="checkbox" id="includeColorCoding" checked>
                <span class="checkmark"></span>
                Status Color Coding
              </label>
            </div>
          </div>
          
        </div>
        <div class="enhanced-modal-footer">
          <button type="button" class="enhanced-btn-secondary" onclick="ReportGenerator.closeReportModal()">Cancel</button>
          <button type="button" class="enhanced-btn-primary" onclick="ReportGenerator.generateEnhancedReport()">
            <i class="fas fa-eye"></i>
            Preview Report
          </button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.setupDateValidation();
    this.addModalStyles();
  },

  addModalStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      .enhanced-modal-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); z-index: 10000; display: flex;
        align-items: center; justify-content: center; backdrop-filter: blur(2px);
      }
      .enhanced-modal-content {
        background: white; border-radius: 15px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: enhancedSlideIn 0.3s ease-out; max-width: 800px; width: 90%;
        max-height: 90vh; overflow-y: auto;
      }
      .enhanced-modal-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white; padding: 2rem; border-radius: 15px 15px 0 0;
        display: flex; justify-content: space-between; align-items: center;
      }
      .enhanced-modal-close {
        background: none; border: none; color: white; font-size: 1.8rem;
        cursor: pointer; padding: 0.5rem; border-radius: 50%; transition: all 0.3s;
      }
      .enhanced-modal-close:hover { background: rgba(255,255,255,0.2); }
      .enhanced-modal-body { padding: 2.5rem; }
      
      .enhanced-form-section { margin-bottom: 2rem; }
      .enhanced-form-section h4 {
        margin: 0 0 1rem 0; color: #333; font-size: 1.1rem; font-weight: 600;
        border-bottom: 2px solid #f1f3f4; padding-bottom: 0.5rem;
      }
      
      .format-selection { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
      .format-option input[type="radio"] { display: none; }
      .format-label {
        display: flex; flex-direction: column; align-items: center; padding: 1.5rem;
        border: 2px solid #e1e5e9; border-radius: 8px; cursor: pointer; transition: all 0.3s;
        text-align: center;
      }
      .format-label i { font-size: 2rem; margin-bottom: 0.5rem; color: #667eea; }
      .format-label span { font-weight: 600; margin-bottom: 0.25rem; }
      .format-label small { color: #666; font-size: 0.8rem; }
      .format-option input[type="radio"]:checked + .format-label {
        border-color: #667eea; background: #f8f9ff;
      }
      .format-option.disabled .format-label {
        opacity: 0.6; cursor: not-allowed;
      }
      
      .enhanced-form-row { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; }
      .enhanced-form-group { flex: 1; }
      .enhanced-form-group.full-width { flex: 100%; }
      .enhanced-form-group label {
        display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333; font-size: 0.95rem;
      }
      .enhanced-form-group input, .enhanced-form-group textarea {
        width: 100%; padding: 1rem; border: 2px solid #e1e5e9; border-radius: 8px;
        font-size: 0.95rem; font-family: inherit; transition: all 0.3s; background: #f8f9fa;
      }
      .enhanced-form-group input:focus, .enhanced-form-group textarea:focus {
        outline: none; border-color: #667eea; background: white;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }
      
      .options-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
      .option-checkbox {
        display: flex; align-items: center; cursor: pointer; padding: 0.5rem;
        border-radius: 6px; transition: background 0.3s;
      }
      .option-checkbox:hover { background: #f8f9fa; }
      .option-checkbox input[type="checkbox"] { margin-right: 0.75rem; }
      
      .date-help { font-size: 0.8rem; color: #6c757d; margin-top: 0.25rem; display: block; }
      .enhanced-modal-footer {
        padding: 2rem 2.5rem; background: #f8f9fa; border-radius: 0 0 15px 15px;
        display: flex; gap: 1rem; justify-content: flex-end;
      }
      .enhanced-btn-secondary, .enhanced-btn-primary {
        padding: 0.75rem 2rem; border: none; border-radius: 8px; font-size: 0.95rem;
        font-weight: 600; cursor: pointer; transition: all 0.3s; text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .enhanced-btn-secondary { background: #6c757d; color: white; }
      .enhanced-btn-secondary:hover { background: #5a6268; }
      .enhanced-btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;
      }
      .enhanced-btn-primary:hover { transform: translateY(-2px); }
      
      @keyframes enhancedSlideIn {
        from { opacity: 0; transform: translateY(-50px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;
    document.head.appendChild(style);
  },


  setupDateValidation() {
    const dateInput = document.getElementById('reportDateInput');
    if (!dateInput) return;

    dateInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
      }
      if (value.length >= 5) {
        value = value.substring(0, 5) + '/' + value.substring(5, 9);
      }
      e.target.value = value;
    });
  },


  showReportModal(reportType) {
    const modal = document.getElementById('enhancedReportModal');
    const title = document.getElementById('enhancedReportTitle');
    
    const reportNames = {
      'defect': 'Defect Report Configuration',
      'full': 'Full Test Report Configuration',
      'security': 'Security Report Configuration'
    };
    
    title.textContent = reportNames[reportType] || 'Report Configuration';
    this.prefillReportForm();
    modal.style.display = 'flex';
  },


  prefillReportForm() {
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2,'0')}/${(today.getMonth()+1).toString().padStart(2,'0')}/${today.getFullYear()}`;
    
    document.getElementById('reportDateInput').value = formattedDate;
    
    const els = window.AppState?.els;
    if (els && els.testerName) {
      document.getElementById('testerNameInput').value = els.testerName.value || '';
    }
  },


  closeReportModal() {
    const modal = document.getElementById('enhancedReportModal');
    if (modal) {
      modal.style.display = 'none';
    }
    this.currentReportType = null;
  },

  generateEnhancedReport() {
    
    const formatRadios = document.querySelectorAll('input[name="reportFormat"]');
    let selectedFormat = 'pdf';
    formatRadios.forEach(radio => {
      if (radio.checked) selectedFormat = radio.value;
    });

    
    if (selectedFormat === 'docx') {
      alert('DOCX format is coming soon! Please select PDF or HTML format.');
      return;
    }


    const config = {
      type: this.currentReportType,
      format: selectedFormat,
      title: document.getElementById('reportTitleInput').value.trim(),
      tester: document.getElementById('testerNameInput').value.trim(),
      date: document.getElementById('reportDateInput').value.trim(),
      build: document.getElementById('buildVersionInput').value.trim(),
      project: document.getElementById('projectNameInput').value.trim(),
      notes: document.getElementById('additionalNotesInput').value.trim(),
      options: {
        includeScreenshots: document.getElementById('includeScreenshots')?.checked || false,
        includeDetailedSteps: document.getElementById('includeDetailedSteps')?.checked || false,
        includeExecutionNotes: document.getElementById('includeExecutionNotes')?.checked || false,
        includeColorCoding: document.getElementById('includeColorCoding')?.checked || false
      },
      timestamp: new Date().toISOString()
    };

    if (!config.title || !config.tester || !config.date || !config.build) {
      alert('Please fill in all required fields.');
      return;
    }


    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!datePattern.test(config.date)) {
      alert('Please enter date in DD/MM/YYYY format');
      return;
    }

    this.closeReportModal();
    this.showReportPreview(config);
  },

  showReportPreview(config) {
    try {
      const testCases = this.getFilteredTestCases(config.type);
      
      if (testCases.length === 0) {
        alert(`No test cases found for ${config.type} report.`);
        return;
      }

      const reportHTML = this.buildReportHTML(config, testCases);
      this.createPreviewModal(reportHTML, config, testCases);
      
    } catch (error) {
      console.error('Error generating preview:', error);
      alert('Failed to generate preview. Please try again.');
    }
  },


  createPreviewModal(reportHTML, config, testCases) {

    const existingModal = document.getElementById('reportPreviewModal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalHTML = `
    <div class="modal" id="reportPreviewModal" style="display: flex;">
      <div class="modal-content preview-modal">
        <div class="modal-header">
          <h3><i class="fas fa-eye"></i> Report Preview - ${config.type.toUpperCase()} (${config.format.toUpperCase()})</h3>
          <button class="modal-close" onclick="ReportGenerator.closePreview()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="preview-container">
            <iframe id="reportPreviewFrame" style="width: 100%; height: 500px; border: 1px solid #ddd; border-radius: 8px;"></iframe>
          </div>
          <div class="preview-info">
            <p><strong>Report Type:</strong> ${config.type} Report</p>
            <p><strong>Format:</strong> ${config.format.toUpperCase()}</p>
            <p><strong>Test Cases:</strong> ${testCases.length}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="ReportGenerator.closePreview()">
            <i class="fas fa-times"></i>
            Cancel
          </button>
          <button class="btn-primary" onclick="ReportGenerator.downloadFromPreview()">
            <i class="fas fa-download"></i>
            Download ${config.format.toUpperCase()}
          </button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);


    const iframe = document.getElementById('reportPreviewFrame');
    if (iframe) {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(reportHTML);
      iframeDoc.close();
    }

    this.previewConfig = config;
    this.previewTestCases = testCases;
  },

 
  closePreview() {
    const modal = document.getElementById('reportPreviewModal');
    if (modal) {
      modal.remove();
    }
    this.previewConfig = null;
    this.previewTestCases = null;
  },


  downloadFromPreview() {
    if (this.previewConfig && this.previewTestCases) {
      this.createMultiFormatReport(this.previewConfig);
      this.closePreview();
      this.saveReportToHistory(this.previewConfig, this.previewTestCases.length);
    }
  },


  createMultiFormatReport(config) {
    try {
      const testCases = this.getFilteredTestCases(config.type);
      
      
      switch (config.format) {
        case 'pdf':
          this.generatePDFReport(config, testCases);
          break;
        case 'html':
          this.generateHTMLReport(config, testCases);
          break;
        default:
          this.generatePDFReport(config, testCases);
      }
      
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    }
  },


  generatePDFReport(config, testCases) {
    console.log('🔄 Generating PDF report with enhanced image support...');
    
    const reportHTML = this.buildReportHTML(config, testCases);
    

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = reportHTML;
    tempDiv.style.cssText = `
      position: absolute !important;
      left: -99999px !important;
      top: -99999px !important;
      width: 794px !important;
      background: white !important;
      font-family: Arial, sans-serif !important;
      z-index: -1 !important;
      visibility: hidden !important;
    `;
    
    document.body.appendChild(tempDiv);

   
    const images = tempDiv.querySelectorAll('img');
    console.log(`📸 Found ${images.length} images to process for PDF`);

  
    const imagePromises = Array.from(images).map((img, index) => {
      return new Promise((resolve) => {
  
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const processImage = () => {
          try {
            
            const maxWidth = 500;
            const maxHeight = 400;
            
            let { width, height } = img;
            
      
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = width * ratio;
              height = height * ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
  
            ctx.drawImage(img, 0, 0, width, height);
            
 
            const optimizedDataURL = canvas.toDataURL('image/jpeg', 0.85);
            img.src = optimizedDataURL;
            
            console.log(`✅ Image ${index + 1} optimized: ${width}x${height}`);
            resolve();
            
          } catch (error) {
            console.warn(`⚠️ Failed to optimize image ${index + 1}:`, error);
            resolve(); 
          }
        };

        if (img.complete && img.naturalWidth > 0) {
          processImage();
        } else {
          img.onload = processImage;
          img.onerror = () => {
            console.warn(`⚠️ Failed to load image ${index + 1}`);
            resolve();
          };
          

          setTimeout(() => {
            console.warn(`⏰ Image ${index + 1} load timeout`);
            resolve();
          }, 5000);
        }
      });
    });

 
    Promise.all(imagePromises)
      .then(() => {
        console.log('🎨 All images processed, generating PDF...');
        
        const opt = {
          margin: [15, 15, 15, 15],
          filename: `${config.type}_report_${config.date.replace(/\//g, '-')}.pdf`,
          image: { 
            type: 'jpeg', 
            quality: 0.92
          },
          html2canvas: { 
            scale: 1.5, 
            useCORS: true,
            allowTaint: true,
            scrollX: 0,
            scrollY: 0,
            width: 794, 
            height: null, 
            backgroundColor: '#ffffff',
            logging: false, 
            imageTimeout: 15000, 
            removeContainer: true,
            foreignObjectRendering: false, 
          },
          jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait',
            compress: true,
            precision: 2
          },
          pagebreak: { 
            mode: ['avoid-all'], 
            before: '.test-page',
            after: '.test-page'
          }
        };

        return html2pdf()
          .set(opt)
          .from(tempDiv)
          .save();
      })
      .then(() => {
        console.log('✅ PDF generated successfully');
        document.body.removeChild(tempDiv);
        showSuccessNotification('PDF report with images generated successfully!');
      })
      .catch((error) => {
        console.error('❌ PDF generation failed:', error);
        document.body.removeChild(tempDiv);
        showErrorNotification('Failed to generate PDF. Please try again.');
      });
  },

  
  generateHTMLReport(config, testCases) {
    console.log('🔄 Generating HTML report with embedded images...');
    
    const reportHTML = this.buildEnhancedHTMLReport(config, testCases);
    
    const blob = new Blob([reportHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.type}_report_${config.date.replace(/\//g, '-')}.html`;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSuccessNotification('HTML report with embedded images generated successfully!');
  },


  buildEnhancedHTMLReport(config, testCases) {
    const totalPages = testCases.length + 1;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title}</title>
  <style>
    ${this.getEnhancedHTMLReportCSS(config)}
  </style>
  <script>
    // Add interactivity to HTML report
    document.addEventListener('DOMContentLoaded', function() {
      // Add click handlers for image zoom
      const images = document.querySelectorAll('.screenshot-image');
      images.forEach(img => {
        img.addEventListener('click', function() {
          const modal = document.getElementById('imageModal');
          const modalImg = document.getElementById('modalImage');
          modal.style.display = 'flex';
          modalImg.src = this.src;
        });
      });
      
      // Close modal functionality
      const modal = document.getElementById('imageModal');
      const closeBtn = document.querySelector('.modal-close');
      
      closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
      });
      
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
      
      // Print functionality
      const printBtn = document.getElementById('printBtn');
      if (printBtn) {
        printBtn.addEventListener('click', function() {
          window.print();
        });
      }
    });
  </script>
</head>
<body>
  <!-- Enhanced Header with Print Button -->
  <div class="report-header no-print">
    <div class="header-content">
      <h1>📄 ${config.title}</h1>
      <button id="printBtn" class="print-btn">🖨️ Print Report</button>
    </div>
  </div>

  <!-- Cover Page -->
  ${this.generateEnhancedCoverPage(config, testCases.length, totalPages)}
  
  <!-- Test Cases -->
  ${testCases.map((testCase, index) => this.generateEnhancedHTMLTestCasePage(testCase, index + 2, totalPages, config)).join('')}
  
  <!-- Image Modal for Full-size View -->
  <div id="imageModal" class="image-modal no-print">
    <span class="modal-close">&times;</span>
    <img id="modalImage" class="modal-content">
  </div>
  
  <!-- Enhanced Footer -->
  <div class="report-footer">
    <p>Generated by Iraje EPM Testing System on ${new Date().toLocaleString()}</p>
    <p>Report Type: ${config.type.toUpperCase()} | Format: HTML | Test Cases: ${testCases.length}</p>
  </div>
</body>
</html>`;
  },


  getEnhancedHTMLReportCSS(config) {
    return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      line-height: 1.6; 
      color: #2c3e50; 
      background: #f8f9fa;
      padding: 0;
    }
    
    .report-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .print-btn {
      background: rgba(255,255,255,0.2);
      color: white;
      border: 2px solid rgba(255,255,255,0.3);
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s;
    }
    
    .print-btn:hover {
      background: rgba(255,255,255,0.3);
      transform: translateY(-2px);
    }
    
    .report-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      background: white;
      min-height: calc(100vh - 200px);
    }
    
    .cover-page { 
      display: flex; 
      flex-direction: column; 
      justify-content: center; 
      align-items: center; 
      min-height: 80vh; 
      text-align: center; 
      padding: 4rem 2rem; 
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      border-radius: 15px;
      margin: 2rem 0;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    
    .cover-title { 
      font-size: 3rem; 
      color: #2c3e50; 
      margin-bottom: 2rem; 
      font-weight: 700; 
    }
    
    .cover-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-top: 2rem;
      width: 100%;
      max-width: 600px;
    }
    
    .cover-detail-item {
      background: rgba(255,255,255,0.9);
      padding: 1rem;
      border-radius: 8px;
      text-align: left;
    }
    
    .test-page { 
      background: white;
      margin: 2rem 0; 
      padding: 2rem; 
      border-radius: 15px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.1);
      border-left: 5px solid #667eea;
    }
    
    .page-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 2rem; 
      padding-bottom: 1rem;
      border-bottom: 2px solid #e9ecef;
    }
    
    .test-content { 
      margin: 2rem 0;
    }
    
    .test-id-title { 
      font-size: 1.8rem; 
      color: #2c3e50; 
      margin-bottom: 1.5rem; 
      font-weight: 600;
    }
    
    .status-badge { 
      display: inline-block;
      padding: 0.75rem 1.5rem; 
      border-radius: 25px; 
      color: white; 
      font-weight: 700; 
      text-transform: uppercase; 
      font-size: 0.9rem;
      margin: 0.5rem 0;
    }
    
    .status-pass { background: linear-gradient(45deg, #27ae60, #2ecc71); }
    .status-fail { background: linear-gradient(45deg, #e74c3c, #c0392b); }
    .status-blocked { background: linear-gradient(45deg, #f39c12, #e67e22); }
    .status-not-executed { background: linear-gradient(45deg, #95a5a6, #7f8c8d); }
    
    .content-section {
      margin: 1.5rem 0;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    
    .content-section strong {
      color: #667eea;
      font-size: 1.1rem;
    }
    
    /* ENHANCED: Screenshot styling for HTML reports */
    .screenshots-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: #f8f9fa;
      border-radius: 12px;
      border: 2px dashed #667eea;
    }
    
    .screenshots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-top: 1rem;
    }
    
    .screenshot-container {
      background: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      transition: transform 0.3s, box-shadow 0.3s;
    }
    
    .screenshot-container:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 20px rgba(0,0,0,0.15);
    }
    
    .screenshot-image {
      width: 100%;
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
      border: 2px solid #e9ecef;
    }
    
    .screenshot-image:hover {
      border-color: #667eea;
      transform: scale(1.02);
    }
    
    .screenshot-title {
      font-weight: 600;
      color: #667eea;
      margin-bottom: 0.5rem;
      text-align: center;
    }
    
    /* Image Modal Styles */
    .image-modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      align-items: center;
      justify-content: center;
    }
    
    .modal-content {
      max-width: 90%;
      max-height: 90%;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    
    .modal-close {
      position: absolute;
      top: 20px;
      right: 35px;
      color: white;
      font-size: 40px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s;
    }
    
    .modal-close:hover {
      color: #667eea;
      transform: scale(1.1);
    }
    
    .report-footer {
      background: #2c3e50;
      color: white;
      text-align: center;
      padding: 2rem;
      margin-top: 3rem;
    }
    
    /* Print Styles */
    @media print {
      .no-print { display: none !important; }
      body { background: white; }
      .test-page { 
        page-break-inside: avoid; 
        margin: 1rem 0;
        box-shadow: none;
      }
      .screenshot-container { 
        page-break-inside: avoid; 
        margin: 1rem 0;
      }
    }
    
    /* Responsive Design */
    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }
      
      .cover-title {
        font-size: 2rem;
      }
      
      .screenshots-grid {
        grid-template-columns: 1fr;
      }
      
      .page-header {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }
    }
  `;
  },

  // Generate enhanced cover page for HTML
  generateEnhancedCoverPage(config, testCaseCount, totalPages) {
    return `
    <div class="report-content">
      <div class="cover-page">
        <h1 class="cover-title">${config.title}</h1>
        <div class="cover-details">
          <div class="cover-detail-item">
            <strong>📁 Project:</strong><br>${config.project}
          </div>
          <div class="cover-detail-item">
            <strong>🏗️ Build:</strong><br>${config.build}
          </div>
          <div class="cover-detail-item">
            <strong>📅 Date:</strong><br>${config.date}
          </div>
          <div class="cover-detail-item">
            <strong>👨‍💻 Tester:</strong><br>${config.tester}
          </div>
          <div class="cover-detail-item">
            <strong>📄 Format:</strong><br>${config.format.toUpperCase()}
          </div>
          <div class="cover-detail-item">
            <strong>🧪 Test Cases:</strong><br>${testCaseCount}
          </div>
        </div>
        ${config.notes ? `
        <div class="cover-detail-item" style="grid-column: 1 / -1; margin-top: 2rem;">
          <strong>📝 Notes:</strong><br>${config.notes}
        </div>
        ` : ''}
      </div>
    </div>`;
  },


  generateEnhancedHTMLTestCasePage(testCase, pageNum, totalPages, config) {
    const statusClass = testCase.status ? `status-${testCase.status.toLowerCase().replace(/\s+/g, '-')}` : 'status-not-executed';
    
    let html = `
    <div class="report-content">
      <div class="test-page">
        <div class="page-header">
          <h2>📁 ${testCase.module || 'General'}</h2>
          <span class="page-number">Page ${pageNum} of ${totalPages}</span>
        </div>
        
        <div class="test-content">
          <h3 class="test-id-title">${testCase.id} — ${testCase.title}</h3>
          <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${testCase.status}</span></p>
    `;

    if (config.options.includeDetailedSteps && testCase.steps) {
      html += `
      <div class="content-section">
        <strong>📋 Test Steps:</strong>
        <p>${testCase.steps.replace(/\n/g, '<br>')}</p>
      </div>`;
    }

    html += `
    <div class="content-section">
      <strong>✅ Expected Result:</strong>
      <p>${(testCase.expectedResult || 'Not specified').replace(/\n/g, '<br>')}</p>
    </div>`;

    if (config.options.includeExecutionNotes && testCase.notes) {
      html += `
      <div class="content-section">
        <strong>📝 Execution Notes:</strong>
        <p>${testCase.notes.replace(/\n/g, '<br>')}</p>
      </div>`;
    }


    if (config.options.includeScreenshots && testCase.images && testCase.images.length > 0) {
      html += `
      <div class="screenshots-section">
        <strong>📸 Screenshots (${testCase.images.length}):</strong>
        <div class="screenshots-grid">`;
        
      testCase.images.forEach((img, index) => {
        // Ensure proper image data format
        let imageData = img.data || img;
        if (typeof imageData === 'string' && !imageData.startsWith('data:image/')) {
          imageData = `data:image/png;base64,${imageData}`;
        }
        
        html += `
        <div class="screenshot-container">
          <div class="screenshot-title">Screenshot ${index + 1}</div>
          <img 
            src="${imageData}" 
            alt="Screenshot ${index + 1}" 
            class="screenshot-image"
            loading="lazy"
            title="Click to view full size"
          />
        </div>`;
      });
      
      html += `</div></div>`;
    }

    html += `
        </div>
        
        <div class="page-footer">
          <div>Generated on ${new Date().toLocaleString()}</div>
          <div>👨‍💻 ${config.tester}</div>
        </div>
      </div>
    </div>`;
    
    return html;
  },


  getFilteredTestCases(reportType) {
    const state = window.AppState;
    let testCases = [...state.flatRows];

    testCases = testCases.map(testCase => {
      const saved = window.Storage?.loadRowState(testCase.id) || {};
      return {
        ...testCase,
        status: saved.status || 'Not Executed',
        notes: saved.notes || '',
        images: saved.images || [],
        attended: saved.attended || false,
        expectedResult: saved.expectedResult || testCase.expected || ''
      };
    });

    switch (reportType) {
      case 'defect':
        testCases = testCases.filter(tc => tc.status.toLowerCase() === 'fail');
        break;
      case 'security':
        testCases = testCases.filter(tc => this.isSecurityTest(tc));
        break;
      case 'full':
        break;
      default:
        testCases = [];
    }

    return testCases;
  },


  buildReportHTML(config, testCases) {
    const totalPages = testCases.length + 1;
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${config.title}</title>
  <style>
    ${this.getReportCSS(config)}
  </style>
</head>
<body>
  ${this.generateCoverPage(config, testCases.length, totalPages)}
  ${testCases.map((testCase, index) => this.generateTestCasePage(testCase, index + 2, totalPages, config)).join('')}
</body>
</html>`;
  },


  getReportCSS(config) {
    return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Arial', sans-serif; 
      line-height: 1.5; 
      color: #2c3e50; 
      background: white; 
    }
    
    .cover-page { 
      display: flex; 
      flex-direction: column; 
      justify-content: center; 
      align-items: center; 
      min-height: 100vh; 
      text-align: center; 
      page-break-after: always; 
      padding: 60px 40px; 
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); 
    }
    
    .cover-title { 
      font-size: 48px; 
      color: #2c3e50; 
      margin-bottom: 20px; 
      font-weight: 700; 
    }
    
    .test-page { 
      min-height: 100vh; 
      page-break-before: always; 
      page-break-after: always; 
      padding: 40px; 
      display: flex; 
      flex-direction: column; 
    }
    
    .page-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 30px; 
      border-bottom: 2px solid #e9ecef;
      padding-bottom: 10px;
    }
    
    .test-content { 
      flex: 1; 
    }
    
    .test-id-title { 
      font-size: 24px; 
      color: #2c3e50; 
      margin-bottom: 20px; 
    }
    
    .status-badge { 
      padding: 12px 24px; 
      border-radius: 25px; 
      color: white; 
      font-weight: 700; 
      text-transform: uppercase; 
    }
    
    .status-pass { background: #27ae60; }
    .status-fail { background: #e74c3c; }
    .status-blocked { background: #f39c12; }
    .status-not-executed { background: #95a5a6; }
    
    /* OPTIMIZED: Image styling for PDF generation */
    img {
      max-width: 100% !important;
      height: auto !important;
      display: block !important;
      margin: 10px 0 !important;
      border: 1px solid #ddd !important;
      border-radius: 4px !important;
      page-break-inside: avoid !important;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: optimize-contrast;
      -ms-interpolation-mode: nearest-neighbor;
    }
    
    .screenshot-container {
      margin: 15px 0 !important;
      page-break-inside: avoid !important;
      text-align: center;
    }
    
    .screenshots-section {
      margin: 20px 0 !important;
      padding: 10px;
      border: 1px solid #e9ecef;
      border-radius: 8px;
    }
    
    .page-footer { 
      margin-top: auto; 
      padding-top: 20px; 
      border-top: 1px solid #ddd; 
      font-size: 12px; 
      color: #666; 
      display: flex;
      justify-content: space-between;
    }
    
    /* Print optimization */
    @media print {
      .test-page {
        page-break-before: always;
        page-break-after: always;
      }
      
      .screenshot-container {
        page-break-inside: avoid;
      }
      
      img {
        max-width: 100% !important;
        height: auto !important;
      }
    }
  `;
  },

  generateCoverPage(config, testCaseCount, totalPages) {
    return `
    <div class="cover-page">
      <h1 class="cover-title">${config.title}</h1>
      <div class="cover-details">
        <p><strong>Project:</strong> ${config.project}</p>
        <p><strong>Build:</strong> ${config.build}</p>
        <p><strong>Date:</strong> ${config.date}</p>
        <p><strong>Tester:</strong> ${config.tester}</p>
        <p><strong>Format:</strong> ${config.format.toUpperCase()}</p>
        <p><strong>Test Cases:</strong> ${testCaseCount}</p>
        ${config.notes ? `<p><strong>Notes:</strong> ${config.notes}</p>` : ''}
      </div>
    </div>`;
  },

  // Generate test case page (for PDF)
  generateTestCasePage(testCase, pageNum, totalPages, config) {
    const statusClass = testCase.status ? `status-${testCase.status.toLowerCase().replace(/\s+/g, '-')}` : 'status-not-executed';
    
    let html = `
    <div class="test-page">
      <div class="page-header">
        <h2>${testCase.module || 'General'}</h2>
        <span class="page-number">Page ${pageNum} of ${totalPages}</span>
      </div>
      <div class="test-content">
        <h3 class="test-id-title">${testCase.id} — ${testCase.title}</h3>
        <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${testCase.status}</span></p>
    `;

    if (config.options.includeDetailedSteps && testCase.steps) {
      html += `<div><strong>Steps:</strong><p>${testCase.steps}</p></div>`;
    }

    html += `<div><strong>Expected Result:</strong><p>${testCase.expectedResult || 'Not specified'}</p></div>`;

    if (config.options.includeExecutionNotes && testCase.notes) {
      html += `<div><strong>Notes:</strong><p>${testCase.notes}</p></div>`;
    }

    // ENHANCED: Optimized screenshots for PDF
    if (config.options.includeScreenshots && testCase.images && testCase.images.length > 0) {
      html += `<div class="screenshots-section"><strong>Screenshots:</strong>`;
      testCase.images.forEach((img, index) => {
        // Ensure proper image data format
        let imageData = img.data || img;
        if (typeof imageData === 'string' && !imageData.startsWith('data:image/')) {
          imageData = `data:image/png;base64,${imageData}`;
        }
        
        html += `
        <div class="screenshot-container">
          <p style="font-weight: bold; margin-bottom: 5px;">Screenshot ${index + 1}:</p>
          <img 
            src="${imageData}" 
            alt="Screenshot ${index + 1}" 
            style="
              max-width: 400px; 
              max-height: 300px; 
              width: auto; 
              height: auto;
              border: 1px solid #ddd; 
              border-radius: 4px;
              display: block;
              margin: 5px auto;
            "
            crossorigin="anonymous"
          />
        </div>`;
      });
      html += `</div>`;
    }

    html += `
      </div>
      <div class="page-footer">
        <div>Generated on ${new Date().toLocaleString()}</div>
        <div>${config.tester}</div>
      </div>
    </div>`;
    
    return html;
  },

  // Save report to history
  saveReportToHistory(config, testCount) {
    const historyItem = {
      ...config,
      testCount: testCount,
      generatedAt: new Date().toLocaleString()
    };

    this.reportHistory.unshift(historyItem);
    
    if (this.reportHistory.length > 10) {
      this.reportHistory = this.reportHistory.slice(0, 10);
    }

    try {
      localStorage.setItem('report_history', JSON.stringify(this.reportHistory));
    } catch(e) {
      console.warn('Failed to save report history:', e);
    }
  },

  // Load report history
  loadReportHistory() {
    try {
      const saved = localStorage.getItem('report_history');
      if (saved) {
        this.reportHistory = JSON.parse(saved);
      }
    } catch(e) {
      console.warn('Failed to load report history:', e);
    }
  }
};

// Export globally
window.ReportGenerator = ReportGenerator;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ReportGenerator.init());
} else {
  ReportGenerator.init();
}

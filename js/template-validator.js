
const TemplateValidator = {
  

  validateSheet(headers) {
    const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
    const missingColumns = [];
    

    CONFIG.REQUIRED_COLUMNS.forEach(col => {
      const found = normalizedHeaders.some(header => 
        header.includes(col.toLowerCase()) || 
        this.fuzzyMatch(header, col.toLowerCase())
      );
      
      if (!found) {
        missingColumns.push(col);
      }
    });
    
    return {
      isValid: missingColumns.length === 0,
      missingColumns: missingColumns
    };
  },
  
  fuzzyMatch(str1, str2) {
    const clean1 = str1.replace(/[\s\-\_\/]/g, '').toLowerCase();
    const clean2 = str2.replace(/[\s\-\_\/]/g, '').toLowerCase();
    
    return clean1.includes(clean2) || clean2.includes(clean1);
  },
  

  showValidationError(missingColumns) {
    const modal = document.createElement('div');
    modal.className = 'validation-modal-overlay';
    modal.innerHTML = `
      <div class="validation-modal">
        <div class="modal-header">
          <h3>❌ Invalid Test Case Sheet</h3>
        </div>
        <div class="modal-body">
          <p>The test case sheet you uploaded is not a valid template.</p>
          <p><strong>Download the valid Template for Test cases</strong></p>
          ${missingColumns.length > 0 ? `
            <div class="missing-columns">
              <h4>Missing Required Columns:</h4>
              <ul>
                ${missingColumns.map(col => `<li>${col}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="TemplateValidator.closeModal()">
            No, Thanks
          </button>
          <button class="btn-primary" onclick="TemplateValidator.downloadTemplate()">
            📥 Download Template
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  },
  

  closeModal() {
    const modal = document.querySelector('.validation-modal-overlay');
    if (modal) {
      modal.remove();
    }
  },
  

  downloadTemplate() {
    const link = document.createElement('a');
    link.href = CONFIG.TEMPLATE_FILE_PATH;
    link.download = 'Iraje_Testcase_Template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.closeModal();
    this.showMessage('Template download started! Check your downloads folder.', 'success');
  },
  

  showMessage(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
};


window.TemplateValidator = TemplateValidator;

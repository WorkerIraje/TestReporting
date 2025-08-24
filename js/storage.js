// Enhanced Storage with proper project dialog handling
const Storage = {
  saveRowState(testId, data) {
    localStorage.setItem(`test_${testId}`, JSON.stringify(data));
  },

  loadRowState(testId) {
    const data = localStorage.getItem(`test_${testId}`);
    return data ? JSON.parse(data) : null;
  },

  removeRowState(testId) {
    localStorage.removeItem(`test_${testId}`);
  },

  saveHeader() {
    const header = {
      date: document.getElementById('reportDate')?.value || '',
      tester: document.getElementById('testerName')?.value || '',
      signature: document.getElementById('signature')?.value || ''
    };
    localStorage.setItem('iraje_header', JSON.stringify(header));
  },

  loadHeaderFromStorage() {
    const header = localStorage.getItem('iraje_header');
    if (header) {
      const data = JSON.parse(header);
      if (document.getElementById('reportDate')) document.getElementById('reportDate').value = data.date || '';
      if (document.getElementById('testerName')) document.getElementById('testerName').value = data.tester || '';
      if (document.getElementById('signature')) document.getElementById('signature').value = data.signature || '';
    }
  },

  saveProject(name, description) {
    const project = {
      name,
      description,
      data: window.AppState.flatRows,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(`project_${name}`, JSON.stringify(project));
    return true;
  },

  loadProject(name) {
    const project = localStorage.getItem(`project_${name}`);
    if (project) {
      const data = JSON.parse(project);
      window.AppState.flatRows = data.data || [];
      window.AppState.loadedCount = data.data?.length || 0;
      return true;
    }
    return false;
  },

  clearStorage() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('test_') || key.startsWith('project_') || key === 'iraje_header') {
        localStorage.removeItem(key);
      }
    });
  },

  showProjectDialog(filename, callback) {
    // Check if project exists
    const existingProject = localStorage.getItem(`project_${filename}`);
    
    if (existingProject) {
      const projectData = JSON.parse(existingProject);
      
      // Create modal HTML
      const modal = document.createElement('div');
      modal.className = 'project-dialog-overlay';
      modal.innerHTML = `
        <div class="project-dialog">
          <div class="project-header">
            <h3>🗂️ file://</h3>
          </div>
          <div class="project-body">
            <p><strong>Project "${filename}" already exists!</strong></p>
            <p>Last modified: ${new Date(projectData.timestamp).toLocaleString()}</p>
            <p>Test cases: ${projectData.data?.length || 0}</p>
            <br>
            <p>Click OK to continue with saved progress</p>
            <p>Click Cancel for fresh start</p>
          </div>
          <div class="project-footer">
            <button class="btn-primary" onclick="handleProjectChoice('continue', '${filename}')">
              OK
            </button>
            <button class="btn-secondary" onclick="handleProjectChoice('fresh', '${filename}')">
              Cancel
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Store callback for later use
      window.projectDialogCallback = callback;
      
    } else {
      // No existing project, proceed with fresh import
      callback('fresh');
    }
  }
};

// Global function to handle project choice
window.handleProjectChoice = function(choice, filename) {
  // Remove modal
  const modal = document.querySelector('.project-dialog-overlay');
  if (modal) {
    modal.remove();
  }
  
  // Execute callback
  if (window.projectDialogCallback) {
    window.projectDialogCallback(choice);
    window.projectDialogCallback = null;
  }
};

window.Storage = Storage;

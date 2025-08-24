// Project Manager - Handles project saving, loading, and resume functionality
const ProjectManager = {
    currentProject: null,
    projectCallback: null,
  
    // Initialize project manager
    init() {
      this.setupAutoSave();
    },
  
    // Check if project exists and show resume dialog
    checkExistingProject(filename, callback) {
      this.projectCallback = callback;
      const savedProject = this.getProjectData(filename);
      
      if (savedProject && savedProject.testCases && savedProject.testCases.length > 0) {
        this.showProjectResumeDialog(filename, savedProject);
      } else {
        // No existing project, proceed with fresh start
        callback('fresh');
      }
    },
  
    // Show project resume dialog
    showProjectResumeDialog(filename, projectData) {
      const modal = document.getElementById('projectResumeModal');
      const projectFileName = document.getElementById('projectFileName');
      const projectLastModified = document.getElementById('projectLastModified');
      const projectTestCount = document.getElementById('projectTestCount');
  
      if (projectFileName) projectFileName.textContent = filename;
      if (projectLastModified) projectLastModified.textContent = `Last modified: ${projectData.lastModified || 'Unknown'}`;
      if (projectTestCount) projectTestCount.textContent = `Test cases: ${projectData.testCases?.length || 0}`;
  
      modal.style.display = 'block';
      modal.classList.add('show');
    },
  
    // Resume existing project
    resumeProject() {
      this.closeProjectDialog();
      if (this.projectCallback) {
        this.projectCallback('resume');
      }
    },
  
    // Start fresh project
    chooseFreshStart() {
      this.closeProjectDialog();
      if (this.projectCallback) {
        this.projectCallback('fresh');
      }
    },
  
    // Close project dialog
    closeProjectDialog() {
      const modal = document.getElementById('projectResumeModal');
      modal.style.display = 'none';
      modal.classList.remove('show');
    },
  
    // Save current project
    saveProject(projectName) {
      const state = window.AppState;
      if (!state.flatRows || state.flatRows.length === 0) {
        showErrorNotification('No test cases to save. Please import data first.');
        return false;
      }
  
      try {
        const projectData = {
          name: projectName,
          lastModified: new Date().toLocaleString(),
          created: new Date().toISOString(),
          testCases: state.flatRows,
          groupedData: state.rowsByGroup,
          selectedSheets: state.selectedSheets,
          workbookInfo: {
            sheetNames: state.sheets
          },
          // Save all test case states
          testCaseStates: {}
        };
  
        // Collect all test case states
        state.flatRows.forEach(testCase => {
          const saved = window.Storage?.loadRowState(testCase.id);
          if (saved) {
            projectData.testCaseStates[testCase.id] = saved;
          }
        });
  
        // Save to localStorage
        localStorage.setItem(`project_${projectName}`, JSON.stringify(projectData));
        
        // Update current project
        this.currentProject = projectName;
        
        showSuccessNotification(`Project "${projectName}" saved successfully!`);
        return true;
      } catch (error) {
        console.error('Error saving project:', error);
        showErrorNotification('Failed to save project. Please try again.');
        return false;
      }
    },
  
    // Load project data
    loadProject(projectName) {
      try {
        const projectData = this.getProjectData(projectName);
        if (!projectData) {
          showErrorNotification('Project not found.');
          return false;
        }
  
        const state = window.AppState;
        
        // Restore project data
        state.flatRows = projectData.testCases || [];
        state.rowsByGroup = projectData.groupedData || {};
        state.selectedSheets = projectData.selectedSheets || [];
        state.sheets = projectData.workbookInfo?.sheetNames || [];
        state.loadedCount = state.flatRows.length;
  
        // Restore test case states
        if (projectData.testCaseStates) {
          Object.entries(projectData.testCaseStates).forEach(([testId, savedState]) => {
            window.Storage?.saveRowState(testId, savedState);
          });
        }
  
        this.currentProject = projectName;
        
        console.log(`Project "${projectName}" loaded successfully:`, {
          testCases: state.flatRows.length,
          groups: Object.keys(state.rowsByGroup).length
        });
  
        return true;
      } catch (error) {
        console.error('Error loading project:', error);
        showErrorNotification('Failed to load project. Please try again.');
        return false;
      }
    },
  
    // Get project data from localStorage
    getProjectData(projectName) {
      try {
        const data = localStorage.getItem(`project_${projectName}`);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('Error reading project data:', error);
        return null;
      }
    },
  
    // Auto-save current project
    autoSaveProject() {
      if (this.currentProject && window.AppState.flatRows.length > 0) {
        this.saveProject(this.currentProject);
      }
    },
  
    // Setup auto-save functionality
    setupAutoSave() {
      // Auto-save every 30 seconds if there are changes
      setInterval(() => {
        this.autoSaveProject();
      }, 30000);
  
      // Auto-save before page unload
      window.addEventListener('beforeunload', () => {
        this.autoSaveProject();
      });
    },
  
    // Mark test case as attended when changed
    markTestCaseAttended(testId) {
      const currentState = window.Storage?.loadRowState(testId) || {};
      currentState.attended = true;
      currentState.lastModified = new Date().toISOString();
      window.Storage?.saveRowState(testId, currentState);
      
      // Auto-save project
      this.autoSaveProject();
    },
  
    // Allow user to manually mark as unattended
    markTestCaseUnattended(testId) {
      const currentState = window.Storage?.loadRowState(testId) || {};
      currentState.attended = false;
      currentState.lastModified = new Date().toISOString();
      window.Storage?.saveRowState(testId, currentState);
      
      // Auto-save project
      this.autoSaveProject();
    }
  };
  
  // Export globally
  window.ProjectManager = ProjectManager;
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ProjectManager.init());
  } else {
    ProjectManager.init();
  }
  
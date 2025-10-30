
const ProjectManager = {
    currentProject: null,
    projectCallback: null,
  

    init() {
      this.setupAutoSave();
    },
  

    checkExistingProject(filename, callback) {
      this.projectCallback = callback;
      const savedProject = this.getProjectData(filename);
      
      if (savedProject && savedProject.testCases && savedProject.testCases.length > 0) {
        this.showProjectResumeDialog(filename, savedProject);
      } else {
  
        callback('fresh');
      }
    },
  

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
  

    resumeProject() {
      this.closeProjectDialog();
      if (this.projectCallback) {
        this.projectCallback('resume');
      }
    },
  

    chooseFreshStart() {
      this.closeProjectDialog();
      if (this.projectCallback) {
        this.projectCallback('fresh');
      }
    },
  

    closeProjectDialog() {
      const modal = document.getElementById('projectResumeModal');
      modal.style.display = 'none';
      modal.classList.remove('show');
    },
  

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

          testCaseStates: {}
        };
  
      
        state.flatRows.forEach(testCase => {
          const saved = window.Storage?.loadRowState(testCase.id);
          if (saved) {
            projectData.testCaseStates[testCase.id] = saved;
          }
        });
  
     
        localStorage.setItem(`project_${projectName}`, JSON.stringify(projectData));
        
 
        this.currentProject = projectName;
        
        showSuccessNotification(`Project "${projectName}" saved successfully!`);
        return true;
      } catch (error) {
        console.error('Error saving project:', error);
        showErrorNotification('Failed to save project. Please try again.');
        return false;
      }
    },
  

    loadProject(projectName) {
      try {
        const projectData = this.getProjectData(projectName);
        if (!projectData) {
          showErrorNotification('Project not found.');
          return false;
        }
  
        const state = window.AppState;
        
      
        state.flatRows = projectData.testCases || [];
        state.rowsByGroup = projectData.groupedData || {};
        state.selectedSheets = projectData.selectedSheets || [];
        state.sheets = projectData.workbookInfo?.sheetNames || [];
        state.loadedCount = state.flatRows.length;
  
       
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
  
  
    getProjectData(projectName) {
      try {
        const data = localStorage.getItem(`project_${projectName}`);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('Error reading project data:', error);
        return null;
      }
    },
  

    autoSaveProject() {
      if (this.currentProject && window.AppState.flatRows.length > 0) {
        this.saveProject(this.currentProject);
      }
    },
  

    setupAutoSave() {

      setInterval(() => {
        this.autoSaveProject();
      }, 30000);
  

      window.addEventListener('beforeunload', () => {
        this.autoSaveProject();
      });
    },
  

    markTestCaseAttended(testId) {
      const currentState = window.Storage?.loadRowState(testId) || {};
      currentState.attended = true;
      currentState.lastModified = new Date().toISOString();
      window.Storage?.saveRowState(testId, currentState);
      

      this.autoSaveProject();
    },
  

    markTestCaseUnattended(testId) {
      const currentState = window.Storage?.loadRowState(testId) || {};
      currentState.attended = false;
      currentState.lastModified = new Date().toISOString();
      window.Storage?.saveRowState(testId, currentState);
      
 
      this.autoSaveProject();
    }
  };
  

  window.ProjectManager = ProjectManager;
  

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ProjectManager.init());
  } else {
    ProjectManager.init();
  }
  

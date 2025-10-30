
const Navigation = {
  currentPage: 'workspace',
  

  init() {
    this.bindEvents();
    this.showPage('workspace'); 
  },


  bindEvents() {
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const page = e.target.getAttribute('data-page');
        this.showPage(page);
      });
    });
  },


  showPage(pageId) {

    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');

    document.querySelectorAll('.page').forEach(page => {
      page.style.display = 'none';
    });
    const targetPage = document.getElementById(`${pageId}Page`);
    if (targetPage) {
      targetPage.style.display = 'block';
    }
    
    const toolbar = document.getElementById('workspaceToolbar');
    if (toolbar) {
      toolbar.style.display = pageId === 'workspace' ? 'flex' : 'none';
    }
    this.currentPage = pageId;
  
    if (pageId === 'workspace') {
      setTimeout(() => {
        this.handleWorkspaceActivation();
      }, 100);
    }

    this.onPageChanged(pageId);
  },


  handleWorkspaceActivation() {
    console.log('🎯 Workspace activated - checking for data...');
    const state = window.AppState;

    if (state.flatRows && state.flatRows.length > 0) {
      const sectionsRoot = document.getElementById('sectionsRoot');

      if (!sectionsRoot || sectionsRoot.innerHTML.trim() === '' || sectionsRoot.style.display === 'none') {
        console.log('🔄 Workspace has data but UI is empty - rebuilding...');
        if (window.App && App.rebuildWorkspaceUI) {
          App.rebuildWorkspaceUI();
        }
      }
    }
  },


onPageChanged(pageId) {
  switch(pageId) {
    case 'status':
      if (window.Dashboard) {
        Dashboard.refreshStatus();
      }
      break;
      
    case 'summary':
      if (window.Summary) {
        Summary.updateSummary();
      }
      break;
      
    case 'reports':

      if (window.ReportGenerator) {
        ReportGenerator.updateReportStats();
      }
      break;
      
    case 'workspace':
      break;
  }
},



  getCurrentPage() {
    return this.currentPage;
  }
};

window.Navigation = Navigation;

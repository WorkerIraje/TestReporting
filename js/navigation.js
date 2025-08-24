// Navigation management module
const Navigation = {
  currentPage: 'workspace',
  
  // Initialize navigation
  init() {
    this.bindEvents();
    this.showPage('workspace'); // Default to workspace
  },

  // Bind navigation events
  bindEvents() {
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const page = e.target.getAttribute('data-page');
        this.showPage(page);
      });
    });
  },

  // Show specific page
  showPage(pageId) {
    // Update active tab
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

    // Show/hide pages
    document.querySelectorAll('.page').forEach(page => {
      page.style.display = 'none';
    });
    
    const targetPage = document.getElementById(`${pageId}Page`);
    if (targetPage) {
      targetPage.style.display = 'block';
    }

    // Show/hide toolbar based on page
    const toolbar = document.getElementById('workspaceToolbar');
    if (toolbar) {
      toolbar.style.display = pageId === 'workspace' ? 'flex' : 'none';
    }

    this.currentPage = pageId;

    // Trigger page-specific updates
    this.onPageChanged(pageId);
  },

  // Handle page change events
  // Update the onPageChanged method to include reports
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
      // Update report statistics when switching to reports page
      if (window.ReportGenerator) {
        ReportGenerator.updateReportStats();
      }
      break;
      
    case 'workspace':
      break;
  }
},


  // Get current page
  getCurrentPage() {
    return this.currentPage;
  }
};

// Export globally
window.Navigation = Navigation;

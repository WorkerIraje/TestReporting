// Enhanced Dashboard Module with Better UI
const Dashboard = {
  
  // Initialize dashboard
  init() {
    this.updateDashboard();
  },

  // Refresh dashboard data
  refreshStatus() {
    console.log('🔄 Refreshing Dashboard...');
    
    const refreshBtn = document.getElementById('refreshStatusBtn');
    const refreshIcon = document.getElementById('refreshIcon');
    
    if (refreshBtn && refreshIcon) {
      // Show loading state
      refreshBtn.classList.add('refreshing');
      refreshBtn.disabled = true;
      refreshIcon.classList.add('fa-spin');
      
      const originalText = refreshBtn.querySelector('span').textContent;
      refreshBtn.querySelector('span').textContent = 'Refreshing...';
    }

    // Simulate async operation
    setTimeout(() => {
      try {
        this.updateDashboard();
        
        if (window.showSuccessNotification) {
          showSuccessNotification('Dashboard refreshed successfully!');
        }
        
        console.log('✅ Dashboard refreshed successfully');
        
      } catch (error) {
        console.error('❌ Error refreshing dashboard:', error);
        if (window.showErrorNotification) {
          showErrorNotification('Failed to refresh dashboard. Please try again.');
        }
      } finally {
        // Reset button state
        if (refreshBtn && refreshIcon) {
          refreshBtn.classList.remove('refreshing');
          refreshBtn.disabled = false;
          refreshIcon.classList.remove('fa-spin');
          refreshBtn.querySelector('span').textContent = originalText;
        }
      }
    }, 1000);
  },

  // Update dashboard with current data
  updateDashboard() {
    const state = window.AppState;
    if (!state || !state.flatRows || state.flatRows.length === 0) {
      this.showEmptyState();
      return;
    }

    // Calculate overall statistics
    const overallStats = this.calculateOverallStats(state.flatRows);
    this.updateOverviewCards(overallStats);

    // Calculate module-wise statistics
    const moduleStats = this.calculateModuleStats(state.flatRows);
    this.renderModuleDashboard(moduleStats);
  },

  // Calculate overall statistics
  calculateOverallStats(testCases) {
    const stats = {
      total: testCases.length,
      passed: 0,
      failed: 0,
      blocked: 0,
      notExecuted: 0,
      attended: 0,
      pending: 0
    };

    testCases.forEach(testCase => {
      const saved = window.Storage?.loadRowState(testCase.id) || {};
      const status = (saved.status || '').toLowerCase();
      
      switch (status) {
        case 'pass':
          stats.passed++;
          break;
        case 'fail':
          stats.failed++;
          break;
        case 'blocked':
          stats.blocked++;
          break;
        default:
          stats.notExecuted++;
      }
      
      if (saved.attended) {
        stats.attended++;
      } else {
        stats.pending++;
      }
    });

    return stats;
  },

  // Calculate module-wise statistics
  calculateModuleStats(testCases) {
    const moduleStats = {};
    
    testCases.forEach(testCase => {
      const module = testCase.module || testCase.sheet || 'General';
      const saved = window.Storage?.loadRowState(testCase.id) || {};
      const status = (saved.status || '').toLowerCase();
      
      if (!moduleStats[module]) {
        moduleStats[module] = {
          name: module,
          total: 0,
          passed: 0,
          failed: 0,
          blocked: 0,
          notExecuted: 0,
          attended: 0,
          pending: 0,
          passRate: 0,
          completionRate: 0
        };
      }
      
      const stats = moduleStats[module];
      stats.total++;
      
      switch (status) {
        case 'pass':
          stats.passed++;
          break;
        case 'fail':
          stats.failed++;
          break;
        case 'blocked':
          stats.blocked++;
          break;
        default:
          stats.notExecuted++;
      }
      
      if (saved.attended) {
        stats.attended++;
      } else {
        stats.pending++;
      }
    });

    // Calculate rates
    Object.values(moduleStats).forEach(stats => {
      const executed = stats.passed + stats.failed + stats.blocked;
      stats.passRate = executed > 0 ? Math.round((stats.passed / executed) * 100) : 0;
      stats.completionRate = Math.round((executed / stats.total) * 100);
    });

    return Object.values(moduleStats);
  },

  // Update overview cards
  updateOverviewCards(stats) {
    const totalCard = document.getElementById('totalTestsCard');
    const passedCard = document.getElementById('passedTestsCard');
    const failedCard = document.getElementById('failedTestsCard');
    const blockedCard = document.getElementById('blockedTestsCard');

    if (totalCard) this.animateNumber(totalCard, stats.total);
    if (passedCard) this.animateNumber(passedCard, stats.passed);
    if (failedCard) this.animateNumber(failedCard, stats.failed);
    if (blockedCard) this.animateNumber(blockedCard, stats.blocked);
  },

  // Animate number changes
  animateNumber(element, targetValue) {
    const currentValue = parseInt(element.textContent) || 0;
    const increment = targetValue > currentValue ? 1 : -1;
    const duration = 1000; // 1 second
    const steps = 20;
    const stepValue = Math.abs(targetValue - currentValue) / steps;
    
    let current = currentValue;
    const timer = setInterval(() => {
      if ((increment > 0 && current >= targetValue) || (increment < 0 && current <= targetValue)) {
        element.textContent = targetValue;
        clearInterval(timer);
      } else {
        current += increment * stepValue;
        element.textContent = Math.round(current);
      }
    }, duration / steps);
  },

  // Render module dashboard
  renderModuleDashboard(moduleStats) {
    const container = document.getElementById('statusDashboard');
    if (!container) return;

    if (moduleStats.length === 0) {
      this.showEmptyState();
      return;
    }

    const html = `
      <div class="modules-grid">
        ${moduleStats.map(module => this.renderModuleCard(module)).join('')}
      </div>
    `;

    container.innerHTML = html;
  },

  // Render individual module card
  renderModuleCard(module) {
    const statusColor = this.getModuleStatusColor(module.passRate, module.completionRate);
    
    return `
      <div class="module-card" style="border-left-color: ${statusColor}">
        <div class="module-header">
          <div class="module-info">
            <h3 class="module-name">${module.name}</h3>
            <div class="module-meta">
              <span class="test-count">${module.total} test${module.total !== 1 ? 's' : ''}</span>
              <span class="completion-rate">${module.completionRate}% complete</span>
            </div>
          </div>
          <div class="module-status-indicator" style="background-color: ${statusColor}">
            ${module.passRate}%
          </div>
        </div>
        
        <div class="module-stats">
          <div class="stat-row">
            <div class="stat-item passed">
              <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
              <div class="stat-details">
                <span class="stat-number">${module.passed}</span>
                <span class="stat-label">Passed</span>
              </div>
            </div>
            
            <div class="stat-item failed">
              <div class="stat-icon"><i class="fas fa-times-circle"></i></div>
              <div class="stat-details">
                <span class="stat-number">${module.failed}</span>
                <span class="stat-label">Failed</span>
              </div>
            </div>
            
            <div class="stat-item blocked">
              <div class="stat-icon"><i class="fas fa-ban"></i></div>
              <div class="stat-details">
                <span class="stat-number">${module.blocked}</span>
                <span class="stat-label">Blocked</span>
              </div>
            </div>
            
            <div class="stat-item pending">
              <div class="stat-icon"><i class="fas fa-clock"></i></div>
              <div class="stat-details">
                <span class="stat-number">${module.notExecuted}</span>
                <span class="stat-label">Pending</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="module-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${module.completionRate}%; background-color: ${statusColor}"></div>
          </div>
          <div class="progress-labels">
            <span>Completion: ${module.completionRate}%</span>
            <span>Pass Rate: ${module.passRate}%</span>
          </div>
        </div>
      </div>
    `;
  },

  // Get module status color based on pass rate and completion
  getModuleStatusColor(passRate, completionRate) {
    if (completionRate < 50) {
      return '#95a5a6'; // Gray - Low completion
    } else if (passRate >= 80) {
      return '#27ae60'; // Green - High pass rate
    } else if (passRate >= 60) {
      return '#f39c12'; // Orange - Medium pass rate
    } else {
      return '#e74c3c'; // Red - Low pass rate
    }
  },

  // Show empty state
  showEmptyState() {
    const container = document.getElementById('statusDashboard');
    if (!container) return;

    // Reset overview cards
    this.updateOverviewCards({ total: 0, passed: 0, failed: 0, blocked: 0 });

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <i class="fas fa-chart-bar"></i>
        </div>
        <h3>No Test Data Available</h3>
        <p>Import test cases to view detailed module status and progress analytics.</p>
        <button class="btn-primary" onclick="Navigation.showPage('workspace')">
          <i class="fas fa-plus"></i>
          Import Test Cases
        </button>
      </div>
    `;
  }
};

// Export globally
window.Dashboard = Dashboard;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Dashboard.init());
} else {
  Dashboard.init();
}


const Summary = {
  updateTimeout: null,
  isUpdating: false,
  

  init() {
    this.updateSummary();
    this.setupOptimizedAutoRefresh();
  },

  setupOptimizedAutoRefresh() {

    setInterval(() => {
      if (!this.isUpdating && window.AppState && window.AppState.flatRows && window.AppState.flatRows.length > 0) {
        this.updateSummary();
      }
    }, 20000); 
  },


  refreshSummary() {
    if (this.isUpdating) return;
    
    console.log('🔄 Refreshing Summary Report...');
    this.isUpdating = true;
    
    const refreshBtn = document.getElementById('refreshSummaryBtn');
    const refreshIcon = document.getElementById('refreshSummaryIcon');
    
    if (refreshBtn && refreshIcon) {
      refreshBtn.classList.add('refreshing');
      refreshBtn.disabled = true;
      refreshIcon.classList.add('fa-spin');
      
      const originalText = refreshBtn.querySelector('span').textContent;
      refreshBtn.querySelector('span').textContent = 'Refreshing...';
    }


    requestIdleCallback(() => {
      try {
        this.syncWithWorkspace();
        this.updateSummary();
        
        if (window.showSuccessNotification) {
          showSuccessNotification('Summary refreshed successfully!');
        }
        
      } catch (error) {
        console.error('❌ Error refreshing summary:', error);
        if (window.showErrorNotification) {
          showErrorNotification('Failed to refresh summary.');
        }
      } finally {
        this.isUpdating = false;
        
        if (refreshBtn && refreshIcon) {
          refreshBtn.classList.remove('refreshing');
          refreshBtn.disabled = false;
          refreshIcon.classList.remove('fa-spin');
          refreshBtn.querySelector('span').textContent = originalText;
        }
      }
    });
  },


  syncWithWorkspace() {
    const state = window.AppState;
    
    if (!state || !state.flatRows || state.flatRows.length === 0) {
      return false;
    }

    const summaryData = this.calculateSummaryDataOptimized(state.flatRows);
    this.renderSummaryTableOptimized(summaryData);
    
    return true;
  },


  calculateSummaryDataOptimized(testCases) {
    const moduleStats = new Map(); 
    
    // Single loop for better performance
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const module = testCase.module || testCase.sheet || 'General';
      const saved = window.Storage?.loadRowState(testCase.id) || {};
      const status = (saved.status || '').toLowerCase();
      const attended = saved.attended || false;
      
      let stats = moduleStats.get(module);
      if (!stats) {
        stats = {
          module: module,
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
        moduleStats.set(module, stats);
      }
      
      stats.total++;
      
      switch (status) {
        case 'pass': stats.passed++; break;
        case 'fail': stats.failed++; break;
        case 'blocked': stats.blocked++; break;
        default: stats.notExecuted++;
      }
      
      if (attended) {
        stats.attended++;
      } else {
        stats.pending++;
      }
    }

   
    const results = Array.from(moduleStats.values());
    for (let i = 0; i < results.length; i++) {
      const stats = results[i];
      const executed = stats.passed + stats.failed + stats.blocked;
      stats.passRate = executed > 0 ? Math.round((stats.passed / executed) * 100) : 0;
      stats.completionRate = Math.round((executed / stats.total) * 100);
    }

    return results;
  },


  updateSummary() {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      const state = window.AppState;
      if (!state || !state.flatRows) {
        this.showEmptyState();
        return;
      }

      const summaryData = this.calculateSummaryDataOptimized(state.flatRows);
      this.renderSummaryTableOptimized(summaryData);
    }, 300); 
  },


  showEmptyState() {
    const tbody = document.querySelector('#summaryTable tbody');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-summary">
          <div class="empty-icon"><i class="fas fa-chart-line"></i></div>
          <h3>No Test Data Available</h3>
          <p>Import test cases to view execution summary</p>
        </td>
      </tr>
    `;
  },

  renderSummaryTableOptimized(summaryData) {
    const tbody = document.querySelector('#summaryTable tbody');
    if (!tbody) return;

    if (summaryData.length === 0) {
      this.showEmptyState();
      return;
    }


    const fragment = document.createDocumentFragment();


    summaryData.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = 'summary-row optimized';
      tr.innerHTML = this.renderSummaryRowHTMLOptimized(row);
      fragment.appendChild(tr);
    });


    const totalRow = this.createOptimizedTotalRow(summaryData);
    fragment.appendChild(totalRow);


    requestAnimationFrame(() => {
      tbody.innerHTML = '';
      tbody.appendChild(fragment);
    });
  },


  renderSummaryRowHTMLOptimized(row) {
    const passRate = row.passRate;
    const completionRate = row.completionRate;
    const progressColor = this.getProgressColor(passRate, completionRate);
    const passRateClass = this.getPassRateClass(passRate);
    
    return `
      <td class="module-name">
        <div class="module-info">
          <span class="module-title">${row.module}</span>
          <span class="module-stats">${row.total} test${row.total !== 1 ? 's' : ''}</span>
        </div>
      </td>
      <td class="total-count">${row.total}</td>
      <td class="status-pass">${row.passed}</td>
      <td class="status-fail">${row.failed}</td>
      <td class="status-blocked">${row.blocked}</td>
      <td class="pass-rate ${passRateClass}">${passRate}%</td>
      <td class="attended-count">${row.attended}</td>
      <td class="pending-count">${row.pending}</td>
      <td class="progress-cell">
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill optimized" style="width: ${completionRate}%; background-color: ${progressColor}; transition: width 0.5s ease;"></div>
          </div>
          <span class="progress-text">${completionRate}%</span>
        </div>
      </td>
    `;
  },

  
  createOptimizedTotalRow(summaryData) {
    const totals = {
      total: 0, passed: 0, failed: 0, blocked: 0, attended: 0, pending: 0
    };

   
    for (let i = 0; i < summaryData.length; i++) {
      const row = summaryData[i];
      totals.total += row.total;
      totals.passed += row.passed;
      totals.failed += row.failed;
      totals.blocked += row.blocked;
      totals.attended += row.attended;
      totals.pending += row.pending;
    }

    const executed = totals.passed + totals.failed + totals.blocked;
    const totalPassRate = executed > 0 ? Math.round((totals.passed / executed) * 100) : 0;
    const totalCompletionRate = totals.total > 0 ? Math.round((executed / totals.total) * 100) : 0;
    const progressColor = this.getProgressColor(totalPassRate, totalCompletionRate);
    const passRateClass = this.getPassRateClass(totalPassRate);

    const totalRow = document.createElement('tr');
    totalRow.className = 'summary-total enhanced-total optimized';
    totalRow.innerHTML = `
      <td class="module-name">
        <div class="module-info">
          <span class="module-title"><strong>OVERALL SUMMARY</strong></span>
          <span class="module-stats">Total Project Status</span>
        </div>
      </td>
      <td class="total-count"><strong>${totals.total}</strong></td>
      <td class="status-pass"><strong>${totals.passed}</strong></td>
      <td class="status-fail"><strong>${totals.failed}</strong></td>
      <td class="status-blocked"><strong>${totals.blocked}</strong></td>
      <td class="pass-rate ${passRateClass}"><strong>${totalPassRate}%</strong></td>
      <td class="attended-count"><strong>${totals.attended}</strong></td>
      <td class="pending-count"><strong>${totals.pending}</strong></td>
      <td class="progress-cell">
        <div class="progress-container">
          <div class="progress-bar enhanced-progress">
            <div class="progress-fill optimized" style="width: ${totalCompletionRate}%; background-color: ${progressColor}; transition: width 0.5s ease;"></div>
          </div>
          <span class="progress-text"><strong>${totalCompletionRate}%</strong></span>
        </div>
      </td>
    `;

    return totalRow;
  },


  getPassRateClass(passRate) {
    if (passRate >= 90) return 'excellent';
    if (passRate >= 80) return 'good';
    if (passRate >= 60) return 'average';
    if (passRate >= 40) return 'poor';
    return 'critical';
  },


  getProgressColor(passRate, completionRate) {
    if (completionRate < 30) return '#95a5a6';
    if (passRate >= 90) return '#27ae60';
    if (passRate >= 80) return '#2ecc71';
    if (passRate >= 60) return '#f39c12';
    if (passRate >= 40) return '#e67e22';
    return '#e74c3c';
  },

 
  getSummaryData() {
    const state = window.AppState;
    if (!state || !state.flatRows) return [];
    
    return this.calculateSummaryDataOptimized(state.flatRows);
  }
};


window.Summary = Summary;


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Summary.init());
} else {
  Summary.init();
}

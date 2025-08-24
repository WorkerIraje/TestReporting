// Notifications System
function showSuccessNotification(message) {
    showNotification(message, 'success');
  }
  
  function showErrorNotification(message) {
    showNotification(message, 'error');
  }
  
  function showNotification(message, type = 'success') {
    const notification = Utils.$(`#${type}Notification`);
    const messageElement = Utils.$(`#${type}Message`);
    
    if (notification && messageElement) {
      messageElement.textContent = message;
      notification.classList.add('show');
      
      // Auto hide after 5 seconds
      setTimeout(() => {
        closeNotification(type);
      }, 5000);
    }
  }
  
  function closeNotification(type) {
    const notification = Utils.$(`#${type}Notification`);
    if (notification) {
      notification.classList.remove('show');
    }
  }
  
  // Global exports
  window.showSuccessNotification = showSuccessNotification;
  window.showErrorNotification = showErrorNotification;
  window.showNotification = showNotification;
  window.closeNotification = closeNotification;
  

const Utils = {

  $(sel) { 
    try {
      return document.querySelector(sel); 
    } catch (error) {
      console.warn(`Invalid selector: ${sel}`, error);
      return null;
    }
  },


  $$(sel) {
    try {
      return Array.from(document.querySelectorAll(sel));
    } catch (error) {
      console.warn(`Invalid selector: ${sel}`, error);
      return [];
    }
  },


  create(tag, attrs = {}, children = []) {
    try {
      const el = document.createElement(tag);
      
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === "class") {
          el.className = v;
        } else if (k === "for") {
          el.htmlFor = v;
        } else if (k === "style" && typeof v === "object") {
          Object.assign(el.style, v);
        } else if (k.startsWith("on") && typeof v === "function") {
          el.addEventListener(k.substring(2), v);
        } else if (k.startsWith("data-")) {
          el.setAttribute(k, v);
        } else if (v !== null && v !== undefined) {
          el.setAttribute(k, String(v));
        }
      });
      
      const childArray = Array.isArray(children) ? children : [children];
      childArray.forEach(c => {
        if (c == null) return;
        if (typeof c === "string" || typeof c === "number") {
          el.appendChild(document.createTextNode(String(c)));
        } else if (c instanceof Node) {
          el.appendChild(c);
        }
      });
      
      return el;
    } catch (error) {
      console.error('Failed to create element:', { tag, attrs, children, error });
      return document.createElement('div'); 
    }
  },


  isElementVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && 
           window.getComputedStyle(el).visibility !== 'hidden';
  },


  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = this.$(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = this.$(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  },



  safeTrim(s) { 
    if (s == null || s === undefined) return "";
    return String(s).trim(); 
  },


  normalizeHeaderKey(s) { 
    return String(s || "").toLowerCase().replace(/\s+/g, '').replace(/[^\w]/g, ''); 
  },


  sanitizeString(str, maxLength = 1000) {
    if (!str) return "";
    
    const sanitized = String(str)
      .trim()
      .replace(/[\x00-\x1F\x7F]/g, '') 
      .substring(0, maxLength);
    
    return sanitized;
  },


  generateId(prefix = 'id') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${random}`;
  },

  
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (obj instanceof Object) {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
    return obj;
  },


  deepMerge(target, source) {
    const result = this.deepClone(target);
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  },

  nowMs() { 
    return performance.now ? performance.now() : Date.now(); 
  },

  
  measurePerformance(name, fn) {
    const start = this.nowMs();
    const result = fn();
    const end = this.nowMs();
    const duration = end - start;
    
    if (window.CONFIG?.DEVELOPMENT?.logging?.performance) {
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    }
    
    return { result, duration };
  },

  async measureAsync(name, asyncFn) {
    const start = this.nowMs();
    const result = await asyncFn();
    const end = this.nowMs();
    const duration = end - start;
    
    if (window.CONFIG?.DEVELOPMENT?.logging?.performance) {
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    }
    
    return { result, duration };
  },

 
  debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(this, args);
    };
  },

  
  throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  
  nextFrame(callback) {
    return requestAnimationFrame(callback);
  },


  whenIdle(callback, timeout = 5000) {
    if (window.requestIdleCallback) {
      return requestIdleCallback(callback, { timeout });
    } else {
      return setTimeout(callback, 16); 
    }
  },


  

  fmtPct(pct, decimals = 1) { 
    if (!isFinite(pct) || pct === null || pct === undefined) return "0%";
    return `${Number(pct).toFixed(decimals)}%`; 
  },


  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },


  formatTimestamp(timestamp, includeTime = true) {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      };
      
      if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
      }
      
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      console.warn('Failed to format timestamp:', timestamp, error);
      return 'Unknown';
    }
  },

  formatDuration(ms) {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  },

  
  
  
  fileToDataURL(file, onProgress = null) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }

  
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validImageTypes.includes(file.type.toLowerCase())) {
        reject(new Error(`Invalid file type: ${file.type}`));
        return;
      }

     
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        reject(new Error(`File too large: ${this.formatFileSize(file.size)} (max: ${this.formatFileSize(maxSize)})`));
        return;
      }

      const reader = new FileReader();
      
      reader.onprogress = (e) => {
        if (onProgress && e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      };
      
      reader.onload = e => {
        try {
          resolve(e.target.result);
        } catch (error) {
          reject(new Error('Failed to process file data'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  },


  async fetchDataUrlAsBlob(dataUrl) {
    try {
      const response = await fetch(dataUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.blob();
    } catch (error) {
      console.error('Failed to convert data URL to blob:', error);
      throw new Error('Failed to process image data');
    }
  },


  compressImage(dataUrl, maxWidth = 800, maxHeight = 600, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          
          let { width, height } = img;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          
        
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          resolve({
            dataUrl: compressedDataUrl,
            originalSize: dataUrl.length,
            compressedSize: compressedDataUrl.length,
            compressionRatio: (1 - compressedDataUrl.length / dataUrl.length) * 100
          });
          
        } catch (error) {
          reject(new Error('Failed to compress image'));
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  },


  

  validateTestCaseData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Invalid data structure'] };
    }

    const errors = [];
    const requiredFields = window.CONFIG?.TESTING?.validation?.requiredFields || ['id', 'title'];
    

    requiredFields.forEach(field => {
      if (!data[field] || String(data[field]).trim() === '') {
        errors.push(`Missing required field: ${field}`);
      }
    });

  
    const maxLengths = window.CONFIG?.TESTING?.validation?.maxFieldLengths || {};
    Object.entries(maxLengths).forEach(([field, maxLength]) => {
      if (data[field] && String(data[field]).length > maxLength) {
        errors.push(`Field ${field} exceeds maximum length of ${maxLength} characters`);
      }
    });


    if (data.lastModified && isNaN(new Date(data.lastModified).getTime())) {
      errors.push('Invalid lastModified timestamp');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },


  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },


  validateTestId(id) {
    if (!id || typeof id !== 'string') return false;
    
  
    const testIdRegex = /^[A-Za-z]{1,10}[-_]?\d{1,6}$/;
    return testIdRegex.test(id.trim());
  },


  

  safeJsonParse(jsonString, defaultValue = null) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('Failed to parse JSON:', error);
      return defaultValue;
    }
  },


  safeJsonStringify(obj, defaultValue = '{}') {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      console.warn('Failed to stringify object:', error);
      return defaultValue;
    }
  },

 
  compressData(data) {
    try {
      const jsonString = this.safeJsonStringify(data);
 
      return jsonString.replace(/\s+/g, ' ').trim();
    } catch (error) {
      console.warn('Failed to compress data:', error);
      return data;
    }
  },


  getDataSize(data) {
    try {
      return new Blob([this.safeJsonStringify(data)]).size;
    } catch (error) {
      return 0;
    }
  },

  

  checkBrowserSupport() {
    const support = {
      localStorage: typeof Storage !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined',
      webWorkers: typeof Worker !== 'undefined',
      broadcastChannel: typeof BroadcastChannel !== 'undefined',
      requestIdleCallback: typeof requestIdleCallback !== 'undefined',
      intersection: typeof IntersectionObserver !== 'undefined'
    };

    const unsupported = Object.entries(support)
      .filter(([_, supported]) => !supported)
      .map(([feature, _]) => feature);

    if (unsupported.length > 0) {
      console.warn('⚠️ Unsupported browser features:', unsupported);
    }

    return support;
  },


  getBrowserInfo() {
    const ua = navigator.userAgent;
    const browser = {
      name: 'Unknown',
      version: 'Unknown',
      mobile: /Mobile|Android|iPhone|iPad/.test(ua)
    };

    if (ua.includes('Chrome')) {
      browser.name = 'Chrome';
      browser.version = ua.match(/Chrome\/([0-9.]+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Firefox')) {
      browser.name = 'Firefox';
      browser.version = ua.match(/Firefox\/([0-9.]+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      browser.name = 'Safari';
      browser.version = ua.match(/Version\/([0-9.]+)/)?.[1] || 'Unknown';
    }

    return browser;
  },


  isLocalhost() {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname === '';
  },

  logError(error, context = {}) {
    const errorInfo = {
      message: error.message || String(error),
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      context
    };

    console.error('🚨 Application Error:', errorInfo);

   
    if (window.CONFIG?.DEVELOPMENT?.debug) {
      const errorLog = this.safeJsonParse(localStorage.getItem('iraje_error_log'), []);
      errorLog.unshift(errorInfo);
      
   
      if (errorLog.length > 50) {
        errorLog.length = 50;
      }
      
      localStorage.setItem('iraje_error_log', this.safeJsonStringify(errorLog));
    }

    return errorInfo;
  },


  getErrorLog() {
    return this.safeJsonParse(localStorage.getItem('iraje_error_log'), []);
  },


  clearErrorLog() {
    localStorage.removeItem('iraje_error_log');
  },


  

  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key] || 'Unknown';
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  },


  multiSort(array, sortCriteria) {
    return array.sort((a, b) => {
      for (const criterion of sortCriteria) {
        const { key, direction = 'asc' } = criterion;
        const valueA = a[key];
        const valueB = b[key];
        
        let comparison = 0;
        if (valueA > valueB) comparison = 1;
        if (valueA < valueB) comparison = -1;
        
        if (direction === 'desc') comparison *= -1;
        
        if (comparison !== 0) return comparison;
      }
      return 0;
    });
  },


  unique(array, key = null) {
    if (key) {
      const seen = new Set();
      return array.filter(item => {
        const keyValue = item[key];
        if (seen.has(keyValue)) return false;
        seen.add(keyValue);
        return true;
      });
    }
    return [...new Set(array)];
  },


  
 
  delegate(selector, eventType, handler, context = document) {
    context.addEventListener(eventType, (event) => {
      if (event.target.matches(selector)) {
        handler.call(event.target, event);
      }
    });
  },


  ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  },


  

  init() {
    console.log('🔧 Initializing Enhanced Utilities...');
    

    const support = this.checkBrowserSupport();
    if (!support.localStorage) {
      console.error('❌ LocalStorage not supported - persistence features disabled');
    }
    
 
    const browserInfo = this.getBrowserInfo();
    console.log(`🌐 Browser: ${browserInfo.name} ${browserInfo.version}${browserInfo.mobile ? ' (Mobile)' : ''}`);
    
   
    window.addEventListener('error', (event) => {
      this.logError(event.error || event, {
        type: 'javascript_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
    
   
    window.addEventListener('unhandledrejection', (event) => {
      this.logError(event.reason, {
        type: 'unhandled_promise_rejection'
      });
    });
    
    console.log('✅ Enhanced Utilities initialized');
  }
};


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    Utils.init();
  });
} else {
  Utils.init();
}

window.Utils = Utils;

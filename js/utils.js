// Utility functions module
const Utils = {
  // DOM helper
  $(sel) { 
    return document.querySelector(sel); 
  },

  // Create DOM element with attributes and children
  create(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") el.className = v;
      else if (k === "for") el.htmlFor = v;
      else if (k.startsWith("on") && typeof v === "function") {
        el.addEventListener(k.substring(2), v);
      } else {
        el.setAttribute(k, v);
      }
    });
    
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      if (typeof c === "string") {
        el.appendChild(document.createTextNode(c));
      } else {
        el.appendChild(c);
      }
    });
    
    return el;
  },

  // String utilities
  safeTrim(s) { 
    return (s == null) ? "" : String(s).trim(); 
  },

  normalizeHeaderKey(s) { 
    return String(s || "").toLowerCase(); 
  },

  // Performance utilities
  nowMs() { 
    return performance.now ? performance.now() : Date.now(); 
  },

  // Format percentage
  fmtPct(pct) { 
    return isFinite(pct) ? `${pct.toFixed(1)}%` : "0%"; 
  },

  // Convert file to data URL
  // Enhanced file to data URL conversion
fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = e => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
},

  // Fetch data URL as blob for DOCX export
  async fetchDataUrlAsBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return await res.blob();
  }
};

// Export utilities globally
window.Utils = Utils;

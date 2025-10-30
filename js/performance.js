
const PerformanceOptimizer = {
    debounceTimers: {},
    updateQueue: [],
    isUpdating: false,
  

    debounce(fn, delay, key) {
      if (this.debounceTimers[key]) {
        clearTimeout(this.debounceTimers[key]);
      }
      this.debounceTimers[key] = setTimeout(() => {
        fn();
        delete this.debounceTimers[key];
      }, delay);
    },
  

    throttle(fn, limit) {
      let inThrottle;
      return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          fn.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },
  

    batchDOMUpdates(updates) {
      if (window.requestIdleCallback) {
        requestIdleCallback(() => this.executeBatch(updates));
      } else {
        requestAnimationFrame(() => this.executeBatch(updates));
      }
    },
  
    executeBatch(updates) {
      updates.forEach(update => update());
    },
  

    lazyLoadImages() {
      if (!('IntersectionObserver' in window)) return;
  
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              img.classList.add('loaded');
              imageObserver.unobserve(img);
            }
          }
        });
      }, { rootMargin: '50px' });
  
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    },
  

    virtualizeTestCases() {
      const container = document.getElementById('sectionsRoot');
      if (!container) return;
  
      const testCases = window.AppState?.flatRows || [];
      if (testCases.length < 50) return; 
  
      this.renderVirtualizedList(container, testCases);
    },
  
    renderVirtualizedList(container, items) {
      const itemHeight = 200; 
      const visibleCount = Math.ceil(window.innerHeight / itemHeight) + 2;
      
      let startIndex = 0;
      let endIndex = Math.min(visibleCount, items.length);
  
      const renderVisible = () => {
        const visibleItems = items.slice(startIndex, endIndex);
        container.innerHTML = visibleItems.map((item, index) => 
          this.renderTestCaseHTML(item, startIndex + index)
        ).join('');
      };
  

      renderVisible();
  

      const handleScroll = this.throttle(() => {
        const scrollTop = container.scrollTop;
        const newStartIndex = Math.floor(scrollTop / itemHeight);
        const newEndIndex = Math.min(newStartIndex + visibleCount, items.length);
  
        if (newStartIndex !== startIndex || newEndIndex !== endIndex) {
          startIndex = newStartIndex;
          endIndex = newEndIndex;
          renderVisible();
        }
      }, 16);
  
      container.addEventListener('scroll', handleScroll);
    },
  

    optimizeAnimations() {
      const style = document.createElement('style');
      style.textContent = `
        .optimized {
          will-change: transform;
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        
        .fade-in {
          opacity: 0;
          animation: fadeInOptimized 0.3s ease-out forwards;
        }
        
        @keyframes fadeInOptimized {
          to { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    },

    cleanupEventListeners() {
   
      document.querySelectorAll('[data-cleanup]').forEach(element => {
        element.removeEventListener('click', element._clickHandler);
        element.removeEventListener('input', element._inputHandler);
      });
    },
  

    init() {
      console.log('🚀 Performance optimization initialized');
      this.optimizeAnimations();
      this.lazyLoadImages();
      

      this.optimizeScrolling();
      

      window.addEventListener('beforeunload', () => {
        this.cleanupEventListeners();
      });
    },
  
    optimizeScrolling() {
      let ticking = false;
      
      const handleScroll = () => {
        if (!ticking) {
          requestAnimationFrame(() => {
     
            ticking = false;
          });
          ticking = true;
        }
      };
  
      window.addEventListener('scroll', handleScroll, { passive: true });
    }
  };
  
  window.PerformanceOptimizer = PerformanceOptimizer;
  

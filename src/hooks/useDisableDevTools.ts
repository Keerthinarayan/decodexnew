import { useEffect, useRef } from "react";

export function useDisableDevTools() {
  const detectionRef = useRef<{
    devToolsOpen: boolean;
    detectionCount: number;
    lastCheck: number;
  }>({
    devToolsOpen: false,
    detectionCount: 0,
    lastCheck: Date.now()
  });

  useEffect(() => {
    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Block DevTools keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const ctrl = e.ctrlKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // Block common DevTools shortcuts
      if (
        key === "F12" ||
        (ctrl && shift && ["I", "J", "C", "K"].includes(key)) ||
        (ctrl && key === "U") || // View source
        (ctrl && shift && key === "DELETE") || // Clear storage
        (alt && key === "F4") || // Close window
        (e.metaKey && alt && ["I", "J", "C"].includes(key)) || // Mac shortcuts
        (ctrl && key === "R" && shift) || // Hard refresh
        (key === "F5" && ctrl) // Refresh with cache clear
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    };

    // Multiple DevTools detection methods
    const detectDevTools = () => {
      const now = Date.now();
      
      // Throttle detection to prevent performance issues
      if (now - detectionRef.current.lastCheck < 500) return;
      detectionRef.current.lastCheck = now;

      let devToolsDetected = false;

      try {
        // Method 1: Window size difference detection
        const heightThreshold = 160;
        const widthThreshold = 160;
        
        if (
          (window.outerHeight - window.innerHeight > heightThreshold) ||
          (window.outerWidth - window.innerWidth > widthThreshold)
        ) {
          devToolsDetected = true;
        }

        // Method 2: Console detection trick
        let devtools = { open: false };
        const element = document.createElement('div');
        (element as any).__defineGetter__('id', function() {
          devtools.open = true;
        });
        console.log('%c', element);
        console.clear();
        
        if (devtools.open) {
          devToolsDetected = true;
        }

        // Method 3: Performance timing detection
        const start = performance.now();
        debugger; // This will pause if DevTools is open
        const end = performance.now();
        
        if (end - start > 100) {
          devToolsDetected = true;
        }

        // Method 4: Check for common DevTools global variables
        if (
          (window as any).chrome?.runtime ||
          (window as any).devtools ||
          typeof (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined'
        ) {
          devToolsDetected = true;
        }

        // Method 5: Screen resolution vs available space
        if (
          screen.availHeight < window.screen.height - 100 ||
          screen.availWidth < window.screen.width - 100
        ) {
          devToolsDetected = true;
        }

        // Handle detection
        if (devToolsDetected && !detectionRef.current.devToolsOpen) {
          detectionRef.current.devToolsOpen = true;
          detectionRef.current.detectionCount++;
          
          // Progressive response based on detection count
          if (detectionRef.current.detectionCount === 1) {
            console.warn('⚠️ Developer tools detected. Please close them for security reasons.');
            alert('For security purposes, please close developer tools and refresh the page.');
          } else if (detectionRef.current.detectionCount >= 2) {
            // More aggressive response
            document.body.innerHTML = '<div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;"><h1>Access Restricted</h1><p>This application cannot be accessed with developer tools open.</p><button onclick="location.reload()">Reload Page</button></div>';
            
            // Redirect after a delay
            setTimeout(() => {
              window.location.href = '/';
            }, 3000);
          }
        } else if (!devToolsDetected && detectionRef.current.devToolsOpen) {
          // Reset if DevTools are closed
          detectionRef.current.devToolsOpen = false;
        }

      } catch (error) {
        // Silent fail to avoid console errors that might reveal detection logic
      }
    };

    // Disable text selection and drag
    const disableSelect = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Disable image dragging
    const disableDrag = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    // Override console methods (basic obfuscation)
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};
    console.debug = () => {};

    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu, { passive: false });
    document.addEventListener('keydown', handleKeyDown, { passive: false });
    document.addEventListener('selectstart', disableSelect, { passive: false });
    document.addEventListener('dragstart', disableDrag, { passive: false });

    // Start detection with multiple intervals for redundancy
    const intervals = [
      setInterval(detectDevTools, 1000),
      setInterval(detectDevTools, 1500),
      setInterval(detectDevTools, 2000)
    ];

    // Immediate detection
    detectDevTools();

    // Disable common inspection methods
    (window as any).addEventListener = new Proxy(window.addEventListener, {
      apply: function(target, thisArg, argumentsList) {
        if (argumentsList[0] === 'devtools-opened') {
          return;
        }
        return target.apply(thisArg, argumentsList as [string, EventListenerOrEventListenerObject, (boolean | AddEventListenerOptions)?]);
      }
    });

    // Cleanup function
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', disableSelect);
      document.removeEventListener('dragstart', disableDrag);
      
      intervals.forEach(interval => clearInterval(interval));
      
      // Restore console methods
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  // Additional component-level protections
  useEffect(() => {
    // Disable text selection via CSS
    const style = document.createElement('style');
    style.textContent = `
      * {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      
      input, textarea {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, []);
}
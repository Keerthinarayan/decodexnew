// utils/disableDevTools.ts
export function disableDevTools() {
  // Disable right-click
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // Block common devtools key shortcuts
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) ||
      (e.ctrlKey && e.key.toUpperCase() === "U") // prevent view-source
    ) {
      e.preventDefault();
    }
  });

  // Detect if DevTools is open (basic check)
  const detectDevTools = () => {
    const threshold = 160;
    if (
      window.outerWidth - window.innerWidth > threshold ||
      window.outerHeight - window.innerHeight > threshold
    ) {
      console.warn("⚠️ DevTools detected!");
      // Optional: Redirect or reload
      window.location.href = "/"; // or: window.location.reload();
    }
  };

  setInterval(detectDevTools, 1000);
}

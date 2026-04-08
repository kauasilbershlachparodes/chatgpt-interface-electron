(() => {
  const versionTarget = document.getElementById('version');
  if (versionTarget && window.electronAPI && window.electronAPI.version) {
    versionTarget.textContent = window.electronAPI.version;
  }
  console.log('Renderer script loaded.');
})();

(() => {
  try {
    const choice = localStorage.getItem('captivia.theme');
    const dark = choice === 'dark' || (choice !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => { meta.content = dark ? '#121714' : '#f6f3ec'; });
  } catch {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => { meta.content = dark ? '#121714' : '#f6f3ec'; });
  }
})();

const toggleThemeIcon = document.getElementById('toggle-theme-icon');

function setColorScheme(theme) {
  switch (theme) {
    case 'dark':
      jtd.setTheme('dark');
      toggleThemeIcon.innerHTML = '<use xlink:href="#svg-moon"></use>';
      break;
    case 'light':
    default:
      jtd.setTheme('light');
      toggleThemeIcon.innerHTML = '<use xlink:href="#svg-sun"></use>';
      break;
  }
}

function getPreferredColorScheme() {
  if (window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    } else {
      return 'light';
    }
  }
  return 'light';
}

function updateColorScheme() {
  setColorScheme(getPreferredColorScheme());
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',
      updateColorScheme);
}

updateColorScheme();

jtd.addEvent(toggleThemeIcon, 'click',
    () => setColorScheme(jtd.getTheme() === 'dark' ? 'light' : 'dark'));
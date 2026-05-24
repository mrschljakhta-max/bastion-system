(function(){
  var theme = 'dark';
  try { theme = localStorage.getItem('bastion_theme') || localStorage.getItem('bastion:start-theme') || 'dark'; } catch(e) {}
  if (theme !== 'light') theme = 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  if (document.body) document.body.setAttribute('data-theme', theme);
})();

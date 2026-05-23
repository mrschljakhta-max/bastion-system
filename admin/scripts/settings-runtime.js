/* BASTION Settings Runtime v112 */
(() => {
  const defaults = {
    palette: 'crimson', glowStrength: 75, animationLevel: 70, particleDensity: 70,
    blurAmount: 45, performanceMode: 'balanced', minimalMotion: false, debugMode: false
  };
  const palettes = {
    crimson: ['#ff3445','#ff7980'], ice: ['#36dfff','#95f1ff'], emerald: ['#23ff9c','#89ffd0'],
    gold: ['#ffc451','#ffe0a3'], violet: ['#a36bff','#d2b4ff']
  };
  function read(){ try{return {...defaults, ...JSON.parse(localStorage.getItem('bastion_ui_settings')||'{}')}}catch{return {...defaults}} }
  function apply(){
    const s = read(); const [accent,soft]=palettes[s.palette]||palettes.crimson;
    document.documentElement.style.setProperty('--bastion-accent', accent);
    document.documentElement.style.setProperty('--bastion-accent-soft', soft);
    document.documentElement.style.setProperty('--bastion-glow-scale', String((Number(s.glowStrength)||0)/100));
    document.documentElement.style.setProperty('--bastion-blur-scale', String((Number(s.blurAmount)||0)/100));
    document.body?.setAttribute('data-bastion-palette', s.palette);
    document.body?.setAttribute('data-performance-mode', s.performanceMode || 'balanced');
    document.body?.toggleAttribute('data-minimal-motion', !!s.minimalMotion);
    if (s.debugMode) console.info('[BASTION settings]', s);
  }
  window.BastionSettings = { read, apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();

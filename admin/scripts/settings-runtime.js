/* BASTION Settings Runtime v125 */
(() => {
  const defaults = {
    palette: 'crimson', glowStrength: 75, animationLevel: 70, particleDensity: 70,
    blurAmount: 45, performanceMode: 'balanced', minimalMotion: false, debugMode: false
  };

  const palettes = {
    crimson: { accent: '#ff3158', soft: '#ff7980', line: 'rgba(255,49,88,.42)', glow: 'rgba(255,49,88,.18)', gold: '#ffc21a' },
    ice: { accent: '#36dfff', soft: '#95f1ff', line: 'rgba(54,223,255,.44)', glow: 'rgba(54,223,255,.17)', gold: '#95f1ff' },
    emerald: { accent: '#27e9b5', soft: '#89ffd0', line: 'rgba(39,233,181,.42)', glow: 'rgba(39,233,181,.16)', gold: '#89ffd0' },
    gold: { accent: '#fde235', soft: '#fff06b', line: 'rgba(253,226,53,.44)', glow: 'rgba(253,226,53,.16)', gold: '#fde235' },
    violet: { accent: '#a56abd', soft: '#d8a4ff', line: 'rgba(165,106,189,.44)', glow: 'rgba(165,106,189,.18)', gold: '#d8a4ff' },
    marsala: { accent: '#dc586d', soft: '#ffb894', line: 'rgba(220,88,109,.44)', glow: 'rgba(220,88,109,.18)', gold: '#ffb894' },
    polar: { accent: '#048db7', soft: '#d0ecf7', line: 'rgba(4,141,183,.44)', glow: 'rgba(4,141,183,.18)', gold: '#0a5f83' }
  };

  function read() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem('bastion_ui_settings') || '{}') }; }
    catch { return { ...defaults }; }
  }

  function apply() {
    const s = read();
    const paletteKey = palettes[s.palette] ? s.palette : 'crimson';
    const p = palettes[paletteKey];
    const root = document.documentElement;
    const body = document.body;

    root.style.setProperty('--bastion-accent', p.accent);
    root.style.setProperty('--bastion-accent-soft', p.soft);
    root.style.setProperty('--bastion-glow-scale', String((Number(s.glowStrength) || 0) / 100));
    root.style.setProperty('--bastion-blur-scale', String((Number(s.blurAmount) || 0) / 100));

    root.style.setProperty('--admin-red', p.accent);
    root.style.setProperty('--admin-red-soft', p.glow);
    root.style.setProperty('--admin-red-line', p.line);
    root.style.setProperty('--admin-gold', p.gold || p.soft);

    if (body) {
      body.dataset.palette = paletteKey;
      body.dataset.bastionPalette = paletteKey;
      body.dataset.performanceMode = s.performanceMode || 'balanced';
      body.toggleAttribute('data-minimal-motion', !!s.minimalMotion);
    }

    localStorage.setItem('BASTION_ADMIN_PALETTE', paletteKey);
    if (s.debugMode) console.info('[BASTION settings v125]', s);
  }

  window.BastionSettings = { read, apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();

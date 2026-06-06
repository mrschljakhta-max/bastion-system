/* BASTION Settings Runtime v115 */
(() => {
  const defaults = {
    palette: 'crimson', glowStrength: 75, animationLevel: 70, particleDensity: 70,
    blurAmount: 45, performanceMode: 'balanced', minimalMotion: false, debugMode: false
  };

  const palettes = {
    crimson: {
      accent: '#ff3158', soft: '#ff7980', line: 'rgba(255, 49, 88, 0.42)', glow: 'rgba(255, 49, 88, 0.18)', gold: '#ffc21a'
    },
    ice: {
      accent: '#36dfff', soft: '#95f1ff', line: 'rgba(54, 223, 255, 0.44)', glow: 'rgba(54, 223, 255, 0.17)', gold: '#ff3158'
    },
    emerald: {
      accent: '#23ff9c', soft: '#89ffd0', line: 'rgba(35, 255, 156, 0.42)', glow: 'rgba(35, 255, 156, 0.15)', gold: '#ff3158'
    },
    gold: {
      accent: '#ffc451', soft: '#ffe0a3', line: 'rgba(255, 196, 81, 0.44)', glow: 'rgba(255, 196, 81, 0.16)', gold: '#ffc451'
    },
    violet: { accent: '#a36bff', soft: '#d2b4ff', line: 'rgba(163, 107, 255, 0.42)', glow: 'rgba(163, 107, 255, 0.16)', gold: '#ff3158' },
    marsala: { accent: '#dc586d', soft: '#ff9cab', line: 'rgba(220,88,109,.45)', glow: 'rgba(220,88,109,.18)', gold: '#ffc1a1' },
    polar: { accent: '#048db7', soft: '#d0ecf7', line: 'rgba(4,141,183,.38)', glow: 'rgba(4,141,183,.14)', gold: '#048db7' }
  };

  function read() {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem('bastion_ui_settings') || '{}') };
    } catch {
      return { ...defaults };
    }
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

    if (s.debugMode) console.info('[BASTION settings v115]', s);
  }

  window.BastionSettings = { read, apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();

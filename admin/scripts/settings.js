/* BASTION Settings Page v112 */
(() => {
  const defaults = {
    palette:'crimson', glowStrength:75, animationLevel:70, particleDensity:70, blurAmount:45,
    performanceMode:'balanced', defaultLanding:'app', sidebarMode:'compact', minimalMotion:false,
    debugMode:false, aiPersonality:'analyst', aiResponseStyle:'detailed', allowAiAnalysis:true,
    nickname:'', avatar:''
  };
  const $ = (id) => document.getElementById(id);
  function read(){ try{return {...defaults, ...JSON.parse(localStorage.getItem('bastion_ui_settings')||'{}')}}catch{return {...defaults}} }
  function write(s){ localStorage.setItem('bastion_ui_settings', JSON.stringify(s)); window.BastionSettings?.apply?.(); setState('SAVED'); }
  function setState(text){ const el=$('settingsSaveState'); if(el){ el.textContent=text; clearTimeout(setState.t); setState.t=setTimeout(()=>el.textContent='READY',1400); } }
  function fill(){
    const s=read();
    document.querySelectorAll('.palette-card').forEach(b=>b.classList.toggle('is-active', b.dataset.palette===s.palette));
    document.querySelectorAll('#performanceMode button').forEach(b=>b.classList.toggle('is-active', b.dataset.mode===s.performanceMode));
    ['glowStrength','animationLevel','particleDensity','blurAmount','defaultLanding','sidebarMode','aiPersonality','aiResponseStyle'].forEach(id=>{ if($(id)) $(id).value=s[id]; });
    if($('minimalMotion')) $('minimalMotion').checked=!!s.minimalMotion;
    if($('debugMode')) $('debugMode').checked=!!s.debugMode;
    if($('allowAiAnalysis')) $('allowAiAnalysis').checked=!!s.allowAiAnalysis;
    if($('settingsNickname')) $('settingsNickname').value=s.nickname || localStorage.getItem('bastion_profile_nickname') || localStorage.getItem('bastion_login') || '';
    if($('settingsAvatar')) $('settingsAvatar').value=s.avatar || localStorage.getItem('bastion_profile_avatar') || '';
  }
  function collect(){
    const s=read();
    ['glowStrength','animationLevel','particleDensity','blurAmount'].forEach(id=>{ if($(id)) s[id]=Number($(id).value); });
    ['defaultLanding','sidebarMode','aiPersonality','aiResponseStyle'].forEach(id=>{ if($(id)) s[id]=$(id).value; });
    if($('minimalMotion')) s.minimalMotion=$('minimalMotion').checked;
    if($('debugMode')) s.debugMode=$('debugMode').checked;
    if($('allowAiAnalysis')) s.allowAiAnalysis=$('allowAiAnalysis').checked;
    if($('settingsNickname')) s.nickname=$('settingsNickname').value.trim().slice(0,32);
    if($('settingsAvatar')) s.avatar=$('settingsAvatar').value.trim();
    return s;
  }
  function bind(){
    document.querySelectorAll('.palette-card').forEach(btn=>btn.addEventListener('click',()=>{ const s=collect(); s.palette=btn.dataset.palette; write(s); fill(); }));
    document.querySelectorAll('#performanceMode button').forEach(btn=>btn.addEventListener('click',()=>{ const s=collect(); s.performanceMode=btn.dataset.mode; write(s); fill(); }));
    document.querySelectorAll('input,select').forEach(el=>el.addEventListener('change',()=>write(collect())));
    $('saveSettings')?.addEventListener('click',()=>write(collect()));
    $('applyProfileSettings')?.addEventListener('click',()=>{ const s=collect(); localStorage.setItem('bastion_profile_nickname',s.nickname||''); localStorage.setItem('bastion_profile_avatar',s.avatar||''); write(s); alert('Профіль оновлено. Перезавантаж сторінку або повернись у меню.'); });
    $('clearUiCache')?.addEventListener('click',()=>{ ['bastion_profile_nickname','bastion_profile_avatar'].forEach(k=>localStorage.removeItem(k)); setState('CACHE CLEARED'); });
    $('reloadAssets')?.addEventListener('click',()=>location.reload());
    $('resetSettings')?.addEventListener('click',()=>{ if(confirm('Скинути локальні налаштування BASTION?')){ localStorage.removeItem('bastion_ui_settings'); fill(); window.BastionSettings?.apply?.(); } });
  }
  document.addEventListener('DOMContentLoaded',()=>{ fill(); bind(); });
})();


(() => {
  const folders = Array.from(document.querySelectorAll('.dict-folder'));
  const prev = document.querySelector('.dicts-arrow--left');
  const next = document.querySelector('.dicts-arrow--right');
  if (!folders.length) return;
  let active = folders.findIndex(f => f.classList.contains('dict-folder--active'));
  if (active < 0) active = 0;
  function render(){
    folders.forEach((f,i)=>{
      f.classList.remove('dict-folder--active','dict-folder--mid','dict-folder--side','dict-folder--mini');
      const d = i - active;
      if (d === 0) f.classList.add('dict-folder--active');
      else if (Math.abs(d) === 1) f.classList.add('dict-folder--mid');
      else if (Math.abs(d) === 2) f.classList.add('dict-folder--side');
      else f.classList.add('dict-folder--mini');
    });
  }
  folders.forEach((f,i)=>f.addEventListener('click',()=>{active=i; render();}));
  prev?.addEventListener('click',()=>{active=(active-1+folders.length)%folders.length; render();});
  next?.addEventListener('click',()=>{active=(active+1)%folders.length; render();});
  render();
})();

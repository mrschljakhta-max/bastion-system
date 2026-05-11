
document.querySelectorAll('.segment').forEach(segment=>{
  segment.addEventListener('mousemove',()=>{
    segment.style.filter='brightness(1.15)';
  });

  segment.addEventListener('mouseleave',()=>{
    segment.style.filter='brightness(1)';
  });
});

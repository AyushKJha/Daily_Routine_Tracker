(()=>{
  const root=document.documentElement,media=matchMedia('(prefers-color-scheme: dark)');
  let preference=null;
  try{const saved=localStorage.getItem('daily_theme');if(saved==='dark'||saved==='light')preference=saved;}catch{}
  function apply(theme){
    root.dataset.theme=theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#101b19':'#f5f6f2');
    document.querySelectorAll('.theme-toggle').forEach(button=>{const dark=theme==='dark';button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label','Dark theme');button.title=dark?'Switch to light theme':'Switch to dark theme';button.querySelector('.theme-label').textContent=dark?'Light theme':'Dark theme';});
  }
  apply(preference||(media.matches?'dark':'light'));
  document.addEventListener('DOMContentLoaded',()=>{apply(root.dataset.theme);document.querySelectorAll('.theme-toggle').forEach(button=>button.addEventListener('click',()=>{preference=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('daily_theme',preference);}catch{}apply(preference);}));});
  media.addEventListener('change',()=>{if(!preference)apply(media.matches?'dark':'light');});
  window.addEventListener('storage',event=>{if(event.key==='daily_theme'){preference=['dark','light'].includes(event.newValue)?event.newValue:null;apply(preference||(media.matches?'dark':'light'));}});
})();

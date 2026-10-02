/* Android adapter: bundled assets, platform file chooser, and explicit export results. */
(()=>{
 if(!window.DailyAndroid)return;
 const originalClick=HTMLAnchorElement.prototype.click;
 let waiting=false;
 function status(message){const el=document.querySelector('#report-status');if(el)el.textContent=message;if(typeof toast==='function')toast(message);}
 DailyAndroid.onmessage=event=>{waiting=false;status(String(event.data));};
 HTMLAnchorElement.prototype.click=function(){
  if(!this.download||!this.href.startsWith('blob:'))return originalClick.call(this);
  if(waiting){status('Finish saving the current file first.');return;}
  waiting=true;const filename=this.download;
  fetch(this.href).then(r=>r.blob()).then(blob=>{
   if(blob.size>10*1024*1024)throw new Error('This export is too large. Keep it under 10 MB.');
   const reader=new FileReader();reader.onerror=()=>{waiting=false;status('Could not prepare the file. Try again.');};reader.onload=()=>{DailyAndroid.postMessage(JSON.stringify({action:'save',filename,mime:blob.type||'application/octet-stream',data:String(reader.result).split(',')[1]}));};reader.readAsDataURL(blob);
  }).catch(e=>{waiting=false;status(e.message);});
 };
 window.print=()=>DailyAndroid.postMessage(JSON.stringify({action:'print'}));
 document.addEventListener('DOMContentLoaded',()=>{
  const install=document.querySelector('#install-app');if(install)install.hidden=true;
  const text=document.querySelector('#install-status');if(text)text.textContent='Daily for Android · 1.0.0 · works offline';
  document.querySelector('#local-data-help').textContent='Your records stay inside this app on this phone. They do not sync with the website. Export a JSON backup before uninstalling or clearing app data. You can restore a website backup in My routine.';
  const panel=document.querySelector('#account-summary')?.parentElement;
  if(panel){const p=document.createElement('p');p.className='field-help';p.textContent='To move records from the website, download its JSON backup and choose Restore backup here. Keep your backups and recovery keys private.';panel.append(p);}
  if(!crypto.subtle||!navigator.locks)status('Update Android System WebView to use protected workspaces. You can still open an unprotected workspace.');
 });
})();

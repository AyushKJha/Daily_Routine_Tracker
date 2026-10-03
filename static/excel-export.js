/* Populate an artifact-tool-authored workbook; charts remain native Excel charts. */
(()=>{
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 let loader;
 async function zipLibrary(){if(window.JSZip)return window.JSZip;if(!loader)loader=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./vendor/jszip.min.js';s.onload=()=>resolve(window.JSZip);s.onerror=()=>{loader=null;reject(new Error('Could not load Excel tools. Connect once and try again.'));};document.head.append(s);});return loader;}
 async function xlsx(model){
  const Zip=await zipLibrary(),response=await fetch('./vendor/weekly-template.xlsx?v=release11');if(!response.ok)throw new Error('Could not load the Excel report template.');
  const zip=await Zip.loadAsync(await response.arrayBuffer()),parse=t=>new DOMParser().parseFromString(t,'application/xml'),serialize=d=>new XMLSerializer().serializeToString(d);
  const column=n=>{let value='';while(n){n--;value=String.fromCharCode(65+n%26)+value;n=Math.floor(n/26);}return value;};const helper=Math.max(9,model.labels.length+4),helperDate=column(helper),helperScore=column(helper+1),last=column(model.labels.length+2);
  const sheet=parse(await zip.file('xl/worksheets/sheet1.xml').async('string'));
  for(const c of [...sheet.getElementsByTagNameNS(ns,'c')]){const ref=c.getAttribute('r');if(/^I(12|1[3-9])$/.test(ref))c.setAttribute('r',helperDate+ref.slice(1));if(/^J(12|1[3-9])$/.test(ref))c.setAttribute('r',helperScore+ref.slice(1));}
  for(const f of sheet.getElementsByTagNameNS(ns,'f'))if(f.textContent.includes('COUNTIF(C13:G19'))f.textContent=f.textContent.replace('C13:G19','C13:'+last+'19');
  const cols=sheet.getElementsByTagNameNS(ns,'cols')[0];for(let n=8;n<=model.labels.length+2;n++){const c=sheet.createElementNS(ns,'col');c.setAttribute('min',n);c.setAttribute('max',n);c.setAttribute('width','22');c.setAttribute('customWidth','1');cols.append(c);}
  function cell(ref,value,cached){let c=[...sheet.getElementsByTagNameNS(ns,'c')].find(c=>c.getAttribute('r')===ref);if(!c){const row=[...sheet.getElementsByTagNameNS(ns,'row')].find(r=>r.getAttribute('r')===ref.match(/\d+/)[0]);c=sheet.createElementNS(ns,'c');c.setAttribute('r',ref);c.setAttribute('s',ref.endsWith('12')?'7':'10');row.append(c);}const formula=c.getElementsByTagNameNS(ns,'f')[0];if(formula){[...c.children].filter(n=>n!==formula).forEach(n=>n.remove());const result=cached===undefined?value:cached,v=sheet.createElementNS(ns,'v');v.textContent=result===null?'':String(result);c.append(v);if(typeof result==='string'||result===null)c.setAttribute('t','str');else c.removeAttribute('t');return;}
   c.replaceChildren();c.removeAttribute('t');if(value===null)return;
   if(typeof value==='number'){const v=sheet.createElementNS(ns,'v');v.textContent=String(value);c.append(v);}else{c.setAttribute('t','inlineStr');const is=sheet.createElementNS(ns,'is'),t=sheet.createElementNS(ns,'t');t.textContent=String(value);is.append(t);c.append(is);}
  }
  const saved=model.rows.filter(r=>r.saved),average=saved.length?saved.reduce((n,r)=>n+r.score,0)/saved.length/100:null;
  cell('A3',`Week beginning ${model.start}`);cell('B5',null,saved.length);cell('E5',null,average);
  const states=['Complete','Skipped','Not completed'],counts=states.map(s=>model.rows.reduce((n,r)=>n+r.states.filter(x=>x===s).length,0));counts.forEach((n,i)=>cell('B'+(8+i),null,n));
  for(let n=3;n<=7;n++){cell(column(n)+'12',null);for(let r=13;r<=19;r++)cell(column(n)+r,null);}
  cell('A38','Notes excluded. Paused/unscheduled habits do not count. Missing dates are unknown.');
  model.labels.forEach((h,i)=>cell(column(3+i)+'12',h));
  model.rows.forEach((r,i)=>{const row=i+13;cell('A'+row,(Date.parse(r.date+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000);cell('B'+row,r.score===null?null:r.score/100);cell(helperDate+row,r.date.slice(5));cell(helperScore+row,r.score===null?null:r.score/100);r.states.forEach((s,j)=>cell(column(3+j)+row,s));});
  // Keep cell order valid even when the template omits blank cells.
  for(const row of sheet.getElementsByTagNameNS(ns,'row')){const nodes=[...row.children];nodes.sort((a,b)=>{const col=s=>s.match(/^[A-Z]+/)[0].split('').reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);return col(a.getAttribute('r'))-col(b.getAttribute('r'));});row.replaceChildren(...nodes);}
  zip.file('xl/worksheets/sheet1.xml',serialize(sheet));
  const cns='http://schemas.openxmlformats.org/drawingml/2006/chart';
  for(const path of Object.keys(zip.files).filter(p=>/^xl\/(?:drawings\/)?charts\/chart\d+\.xml$/.test(p))){const d=parse(await zip.file(path).async('string')),bar=!!d.getElementsByTagNameNS(cns,'barChart').length;const ser=d.getElementsByTagNameNS(cns,'ser')[0];
   function cache(parentName,values,string=false){const parent=ser.getElementsByTagNameNS(cns,parentName)[0];parent.replaceChildren();const ref=d.createElementNS(cns,string?'c:strRef':'c:numRef'),f=d.createElementNS(cns,'c:f');f.textContent=bar?`'Weekly report'!$${parentName==='cat'?helperDate:helperScore}$13:$${parentName==='cat'?helperDate:helperScore}$19`:`'Weekly report'!$${parentName==='cat'?'A':'B'}$8:$${parentName==='cat'?'A':'B'}$10`;ref.append(f);const cached=d.createElementNS(cns,string?'c:strCache':'c:numCache');if(!string){const fmt=d.createElementNS(cns,'c:formatCode');fmt.textContent=bar?'0%':'0';cached.append(fmt);}const count=d.createElementNS(cns,'c:ptCount');count.setAttribute('val',values.length);cached.append(count);values.forEach((v,i)=>{if(v===null)return;const pt=d.createElementNS(cns,'c:pt');pt.setAttribute('idx',i);const n=d.createElementNS(cns,'c:v');n.textContent=String(v);pt.append(n);cached.append(pt);});ref.append(cached);parent.append(ref);}
   cache('cat',bar?model.rows.map(r=>r.date.slice(5)):states,true);cache('val',bar?model.rows.map(r=>r.score===null?null:r.score/100):counts);
   if(bar){const axis=d.getElementsByTagNameNS(cns,'valAx')[0],scaling=axis.getElementsByTagNameNS(cns,'scaling')[0];for(const [name,value] of [['max',1],['min',0]]){let node=scaling.getElementsByTagNameNS(cns,name)[0];if(!node){node=d.createElementNS(cns,'c:'+name);scaling.append(node);}node.setAttribute('val',value);}}
   zip.file(path,serialize(d));
  }
  const workbook=parse(await zip.file('xl/workbook.xml').async('string'));let calc=workbook.getElementsByTagNameNS(ns,'calcPr')[0];if(!calc){calc=workbook.createElementNS(ns,'calcPr');workbook.documentElement.append(calc);}calc.setAttribute('calcMode','auto');calc.setAttribute('fullCalcOnLoad','1');zip.file('xl/workbook.xml',serialize(workbook));
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
 }
 window.DailyExcel={xlsx};
})();

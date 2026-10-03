/* Optional encrypted, device-local workspaces. Keys live only in this tab. */
(()=>{
 const legacy=DailyStorage,enc=new TextEncoder(),dec=new TextDecoder();
 let session=null,pending=null,closed=false;
 const db=new Promise((resolve,reject)=>{const r=indexedDB.open('daily-personal-workspace',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const error=(message,status=400)=>Object.assign(new Error(message),{status});
 async function tx(mode,fn){const d=await db;return new Promise((resolve,reject)=>{const t=d.transaction('records',mode);let result;t.oncomplete=()=>resolve(result);t.onerror=t.onabort=()=>reject(t.error||error('Storage could not be updated.'));try{fn(t.objectStore('records'),v=>result=v,t);}catch(e){t.abort();reject(e);}});}
 const read=key=>tx('readonly',(s,done)=>{const r=s.get(key);r.onsuccess=()=>done(r.result);});
 const write=(key,value)=>tx('readwrite',(s,done)=>{s.put(value,key);done(value);});
 const all=()=>tx('readonly',(s,done)=>{const out={};const r=s.openCursor();r.onsuccess=()=>{const c=r.result;if(c){out[c.key]=c.value;c.continue();}else done(out);};});
 const b64=b=>{const a=new Uint8Array(b);let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);},bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const rawKey=b=>crypto.subtle.importKey('raw',b,'AES-GCM',false,['encrypt','decrypt']);
 async function passwordKey(password,salt){const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(salt),iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
 async function seal(key,data,id){const iv=crypto.getRandomValues(new Uint8Array(12));return {iv:b64(iv),data:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(id)},key,data))};}
 const open=(key,value,id)=>crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(value.iv),additionalData:enc.encode(id)},key,bytes(value.data));
 const validPassword=p=>{if(typeof p!=='string'||p.length<10||p.length>200)throw error('Use a password with 10–200 characters.');};
 const keyName=id=>'vault:'+id;
 const locked=async(id,fn)=>{if(!navigator.locks)throw error('This browser cannot safely update protected workspaces. Use a current browser.');return navigator.locks.request('daily-vault:'+id,fn);};
 const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const ids=legacy.defaults.map(h=>h.id),score=d=>DailyRoutine.score(d);
 async function prepare(body){validPassword(body.password);const username=String(body.username||'').trim();if(!username||username.length>60)throw error('Enter a name up to 60 characters.');
  const id='daily-'+crypto.randomUUID(),salt=b64(crypto.getRandomValues(new Uint8Array(16))),secret=crypto.getRandomValues(new Uint8Array(32)),recoveryBytes=crypto.getRandomValues(new Uint8Array(32));
  const recovery=[...recoveryBytes].map(x=>x.toString(16).padStart(2,'0')).join(''),key=await rawKey(secret),pw=await passwordKey(body.password,salt);
  let snapshot=null,backup={profile:{id,username},habits:legacy.defaults,days:[],receipts:{}};
  if(body.migrate){snapshot=await all();if(!snapshot.profile)throw error('There is no unprotected workspace to move.');backup={profile:{id,username:snapshot.profile.username},habits:snapshot.habits||legacy.defaults,days:Object.entries(snapshot).filter(([k])=>k.startsWith('day:')).map(([,v])=>v),receipts:Object.fromEntries(Object.entries(snapshot).filter(([k])=>k.startsWith('reportlog:')).map(([k,v])=>[k.slice(10),v]))};legacy.validateBackup(backup);}
  const row={version:1,id,salt,password:await seal(pw,secret,id+':password'),recovery:await seal(await rawKey(recoveryBytes),secret,id+':recovery'),payload:await seal(key,enc.encode(JSON.stringify(backup)),id)};
  pending={id,key,row,snapshot};return {id,recovery,username:backup.profile.username};
 }
 async function finish(){if(!pending)throw error('Start workspace setup again.');const p=pending;
  await locked(p.id,()=>tx('readwrite',(s,done,t)=>{const r=s.openCursor(),current={};r.onsuccess=()=>{const c=r.result;if(c){current[c.key]=c.value;c.continue();return;}if(p.snapshot){const legacyKeys=o=>Object.keys(o).filter(k=>k==='profile'||k==='habits'||k.startsWith('day:')||k.startsWith('reportlog:')).sort();const old=legacyKeys(p.snapshot),now=legacyKeys(current);if(JSON.stringify(old.map(k=>[k,p.snapshot[k]]))!==JSON.stringify(now.map(k=>[k,current[k]]))){done(false);return;}old.forEach(k=>s.delete(k));}s.add(p.row,keyName(p.id));done(true);};})).then(ok=>{if(!ok)throw error('Another tab changed your workspace during setup. Start again to include those changes.');});
  session={id:p.id,key:p.key};pending=null;closed=false;return {user:JSON.parse(dec.decode(await open(session.key,p.row.payload,p.id))).profile};
 }
 async function login(body,recover=false){const id=String(body.id||'').trim().toLowerCase(),row=await read(keyName(id));if(!row)throw error('ID or password is incorrect, or this workspace is on another browser.',401);
  try{let secret;if(recover){validPassword(body.password);const text=String(body.recovery||'').replace(/\s|-/g,'');if(!/^[a-f0-9]{64}$/i.test(text))throw error('Invalid recovery key.');secret=await open(await rawKey(Uint8Array.from(text.match(/../g),h=>parseInt(h,16))),row.recovery,id+':recovery');const salt=b64(crypto.getRandomValues(new Uint8Array(16)));row.salt=salt;row.password=await seal(await passwordKey(body.password,salt),secret,id+':password');await locked(id,async()=>{const current=await read(keyName(id));current.salt=row.salt;current.password=row.password;await write(keyName(id),current);});}else secret=await open(await passwordKey(String(body.password||''),row.salt),row.password,id+':password');const key=await rawKey(secret),data=JSON.parse(dec.decode(await open(key,row.payload,id)));session={id,key};closed=false;return {user:data.profile};}catch(e){if(e.status)throw e;throw error(recover?'ID or recovery key is incorrect.':'ID or password is incorrect.',401);}
 }
 async function vaultRequest(path,method,body){const current=session;if(!current)throw error('Unlock your workspace to continue.',401);
  return locked(current.id,async()=>{if(session!==current)throw error('Workspace is locked.',401);const row=await read(keyName(current.id)),data=JSON.parse(dec.decode(await open(current.key,row.payload,current.id)));let changed=false,result;
   const days=data.days.sort((a,b)=>b.date.localeCompare(a.date));
   if(path==='/auth/me')result=data.profile;
   else if(path==='/preferences'){if(method==='PUT'){legacy.validateBackup({days:[],habits:body.habits});data.habits=body.habits;changed=true;}result=data.habits;}
   else if(path==='/habits/today'){const date=today(),old=days.find(d=>d.date===date);if(method==='GET')result=old||{date,habits:{},crosses:{},details:{},score:0,save_count:0,revision:null};else{legacy.validateBackup({days:[body]});if(body.date!==date)throw error('The date changed. Refresh before saving.');if((old?.revision??null)!==body.revision)throw error('Another tab changed this day. Reload before editing.',409);const next={...body,score:score(body),revision:crypto.randomUUID(),saved_at:new Date().toISOString(),save_count:(old?.save_count||0)+1};data.days=days.filter(d=>d.date!==date).concat(next);changed=true;result={ok:true,score:next.score,revision:next.revision};}}
   else if(path==='/habits/history')result=days.slice(0,90);
   else if(path==='/export')result={format:'daily-backup',version:1,exported_at:new Date().toISOString(),profile:data.profile,habits:data.habits,days:[...days].reverse()};
   else if(path==='/restore'){legacy.validateBackup(body);const imported=new Set(body.days.map(d=>d.date));data.days=days.filter(d=>!imported.has(d.date)).concat(body.days.map(d=>({...d,score:d.score??score(d),revision:crypto.randomUUID()})));if(body.habits)data.habits=body.habits;if(body.profile)data.profile.username=body.profile.username;changed=true;result=true;}
   else if(path==='/cloud/snapshot')result=JSON.parse(JSON.stringify(row));
   else if(path==='/reports/log'){if(!/^[a-f0-9]{64}$/.test(body?.fingerprint||'')||!['pdf','xlsx'].includes(body.kind))throw error('Invalid report receipt.');data.receipts??={};const key=body.kind+':'+body.fingerprint;if(method==='POST'){data.receipts[key]={attempted_at:new Date().toISOString(),filename:String(body.filename||'').slice(0,160)};changed=true;}result=data.receipts[key]||null;}
   else if(path==='/stats')result=DailyRoutine.metrics(days);
   else if(path==='/coach'){const recent=days.slice(0,7),counts=ids.map(id=>({id,count:recent.filter(d=>d.habits[id]&&!d.crosses[id]).length})).sort((a,b)=>a.count-b.count);result=recent.length?{habit_id:counts[0].id,message:`You completed this intention on ${counts[0].count} of your last ${recent.length} saved days. Choose a smaller step you can repeat tomorrow.`}:{message:'Save your first check-in, then choose one small step for tomorrow.'};}
   else if(path==='/chat/status')result={configured:false};else throw error('Not found',404);
   if(changed){if(session!==current)throw error('Workspace was locked before saving.',401);row.payload=await seal(current.key,enc.encode(JSON.stringify(data)),current.id);await write(keyName(current.id),row);}return result;
  });
 }
 DailyStorage={validateBackup:legacy.validateBackup,restore:b=>session?vaultRequest('/restore','POST',b):legacy.restore(b),async request(path,method='GET',body){
  if(path==='/cloud/import'){const row=body?.envelope;if(!row||row.version!==1||!/^daily-[a-f0-9-]{36}$/.test(row.id)||typeof row.salt!=='string'||!['password','recovery','payload'].every(k=>row[k]&&typeof row[k].iv==='string'&&typeof row[k].data==='string')||JSON.stringify(row).length>14000000)throw error('Invalid encrypted backup.');await locked(row.id,()=>write(keyName(row.id),row));if(session?.id===row.id)session=null;return {id:row.id};}
  if(path==='/auth/create')return prepare(body);
  if(path==='/auth/finish')return finish();
  if(path==='/auth/cancel'){pending=null;return {ok:true};}
  if(path==='/auth/login')return login(body);
  if(path==='/auth/recover')return login(body,true);
  if(path==='/auth/logout'){session=null;pending=null;closed=true;await legacy.request(path,method,body);return {ok:true};}
  if(session)return vaultRequest(path,method,body);
  if(closed&&path!=='/auth/register')throw error('Open your workspace to continue.',401);
  if(path==='/auth/register')closed=false;
  return legacy.request(path,method,body);
 }};
})();

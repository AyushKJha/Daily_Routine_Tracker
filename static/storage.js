/* Private browser storage. No network API and no credentials. */
const DailyStorage=(()=>{
 const defaults=[{id:'exercise',label:'Move your body',goal:'60 minutes of movement',category:'Wellbeing'},{id:'diet',label:'Eat with intention',goal:'Balanced meals & hydration',category:'Wellbeing'},{id:'study',label:'Make time to learn',goal:'A focused study session',category:'Learning'},{id:'dsa',label:'Solve a problem',goal:'Practice algorithms & thinking',category:'Learning'},{id:'project',label:'Build something',goal:'One meaningful step forward',category:'Creating'}];
 const ids=defaults.map(h=>h.id);let active=true;
 const dayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('daily-personal-workspace',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('Browser storage is unavailable. Enable site storage or use a regular browsing window.'));});
 async function transaction(mode,fn){const db=await dbPromise;return new Promise((resolve,reject)=>{const tx=db.transaction('records',mode);let result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||new Error('Storage failed. Export a backup and check browser space.'));tx.onabort=()=>reject(tx.error||new Error('Could not save. Please try again.'));try{fn(tx.objectStore('records'),v=>result=v,tx);}catch(e){tx.abort();reject(e);}});}
 const get=key=>transaction('readonly',(s,done)=>{const r=s.get(key);r.onsuccess=()=>done(r.result);});
 const put=(key,value)=>transaction('readwrite',(s,done)=>{s.put(value,key);done(value);});
 async function records(){return transaction('readonly',(s,done)=>{const r=s.openCursor();const days=[];r.onsuccess=()=>{const c=r.result;if(c){if(String(c.key).startsWith('day:'))days.push(c.value);c.continue();}else done(days.sort((a,b)=>b.date.localeCompare(a.date)));};});}
 function failure(message,status=400){const e=new Error(message);e.status=status;return e;}
 function validateDay(d){if(!d||typeof d!=='object'||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||Number.isNaN(Date.parse(d.date+'T12:00:00Z'))||new Date(d.date+'T12:00:00Z').toISOString().slice(0,10)!==d.date)throw new Error('Invalid day in backup');for(const key of ['habits','crosses','details']){if(!d[key]||typeof d[key]!=='object'||Array.isArray(d[key])||Object.keys(d[key]).some(k=>!ids.includes(k)))throw new Error('Invalid habit records');}for(const key of ['habits','crosses'])if(Object.values(d[key]).some(v=>typeof v!=='boolean'))throw new Error('Invalid habit state');if(Object.values(d.details).some(v=>!v||typeof v!=='object'||Array.isArray(v)||JSON.stringify(v).length>4000))throw new Error('Invalid notes');}
 function score(d){return ids.filter(id=>d.habits[id]&&!d.crosses[id]).length*20;}
 function validatePrefs(p){if(!Array.isArray(p)||p.length!==5||p.some((h,i)=>!h||h.id!==ids[i]||typeof h.label!=='string'||!h.label.trim()||h.label.length>60||typeof h.goal!=='string'||!h.goal.trim()||h.goal.length>120))throw new Error('Invalid routine preferences');}
 function validateBackup(b){if(!b||!Array.isArray(b.days)||b.days.length>10000)throw new Error('Choose a Daily JSON backup');b.days.forEach(validateDay);if(b.habits)validatePrefs(b.habits);if(b.profile&&(typeof b.profile.username!=='string'||!b.profile.username.trim()||b.profile.username.length>60))throw new Error('Invalid profile');}
 async function restore(b){validateBackup(b);await transaction('readwrite',(s,done)=>{for(const d of b.days)s.put({...d,score:score(d),revision:crypto.randomUUID()},'day:'+d.date);if(b.habits)s.put(b.habits,'habits');if(b.profile)s.put({id:'local',username:b.profile.username},'profile');done(true);});active=true;}
 async function request(path,method='GET',body){
  if(path==='/auth/register'){const name=String(body?.username||'').trim();if(!name||name.length>60)throw failure('Enter your name (up to 60 characters).');const profile={id:'local',username:name};await put('profile',profile);active=true;return {user:profile};}
  if(path==='/auth/logout'){active=false;return {ok:true};}
  const profile=await get('profile');if(!profile||!active)throw failure('Open your local workspace to continue.',401);
  if(path==='/auth/me')return profile;
  if(path==='/preferences'){if(method==='PUT'){validatePrefs(body.habits);return put('habits',body.habits);}return await get('habits')||defaults;}
  if(path==='/habits/today'){
   const date=dayKey();if(method==='GET')return await get('day:'+date)||{date,habits:{},crosses:{},details:{},score:0,save_count:0,revision:null};
   validateDay(body);if(body.date!==date)throw failure('The date changed. Refresh before saving.');
   return transaction('readwrite',(s,done)=>{const r=s.get('day:'+date);r.onsuccess=()=>{const old=r.result;if((old?.revision??null)!==body.revision){done({conflict:true});return;}const next={...body,score:score(body),revision:crypto.randomUUID(),saved_at:new Date().toISOString(),save_count:(old?.save_count||0)+1};s.put(next,'day:'+date);done({ok:true,score:next.score,revision:next.revision});};}).then(result=>{if(result.conflict)throw failure('Another tab changed this day. Reload the saved day before editing.',409);return result;});
  }
  const days=await records();
  if(path==='/habits/history')return days.slice(0,90);
  if(path==='/stats'){let streak=0;const dates=new Set(days.map(d=>d.date)),d=new Date();if(!dates.has(dayKey()))d.setDate(d.getDate()-1);while(dates.has(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)){streak++;d.setDate(d.getDate()-1);}return {days:days.length,avg:days.length?Math.round(days.reduce((n,d)=>n+d.score,0)/days.length):0,streak,perfect:days.filter(d=>d.score===100).length,best:Math.max(0,...days.map(d=>d.score))};}
  if(path==='/export')return {format:'daily-backup',version:1,exported_at:new Date().toISOString(),profile,habits:await get('habits')||defaults,days:days.reverse()};
  if(path==='/coach'){if(!days.length)return {message:'Save your first check-in, then look for one small step you can repeat tomorrow.'};const recent=days.slice(0,7),counts=ids.map(id=>({id,count:recent.filter(d=>d.habits[id]&&!d.crosses[id]).length})).sort((a,b)=>a.count-b.count);return {habit_id:counts[0].id,message:`You completed this intention on ${counts[0].count} of your last ${recent.length} saved days. Choose a smaller, specific next step and decide when you will do it. Consistency starts with something manageable.`};}
  if(path==='/chat/status')return {configured:false};
  if(path==='/chat')throw failure('This device-only edition does not send messages to an AI provider.',503);
  throw failure('Not found',404);
 }
 return {request,restore,validateBackup};
})();

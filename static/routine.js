/* Shared rules: historical plans are snapshots, not today's edited preferences. */
const DailyRoutine=(()=>{
 const legacy=['exercise','diet','study','dsa','project'];
 const validId=id=>typeof id==='string'&&!['constructor','prototype','__proto__'].includes(id)&&/^[a-z][a-z0-9_-]{0,60}$/.test(id);
 function validate(p){if(!Array.isArray(p)||p.length<1||p.length>12||new Set(p.map(h=>h?.id)).size!==p.length||p.some(h=>!h||!validId(h.id)||typeof h.label!=='string'||!h.label.trim()||h.label.length>60||typeof h.goal!=='string'||!h.goal.trim()||h.goal.length>120||(h.paused!==undefined&&typeof h.paused!=='boolean')||(h.days!==undefined&&(!Array.isArray(h.days)||!h.days.length||new Set(h.days).size!==h.days.length||h.days.some(d=>!Number.isInteger(d)||d<0||d>6)))))throw new Error('Use 1–12 unique habits, each with a name, goal, and at least one scheduled day.');}
 const plan=(routine,date)=>routine.filter(h=>!h.paused&&(h.days||[0,1,2,3,4,5,6]).includes(new Date(date+'T12:00:00').getDay()));
 function eligible(day){return day.routine?plan(day.routine,day.date).map(h=>h.id):legacy;}
 function score(day){const ids=eligible(day);return ids.length?Math.round(ids.filter(id=>day.habits[id]&&!day.crosses[id]).length/ids.length*100):0;}
 const labels=(day,routine)=>day.routine||routine;
 function metrics(days){const tracked=days.filter(d=>!d.routine||eligible(d).length),dates=new Set(tracked.map(d=>d.date));const now=new Date(),key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;let streak=0;if(!dates.has(key(now)))now.setDate(now.getDate()-1);while(dates.has(key(now))){streak++;now.setDate(now.getDate()-1);}return {days:tracked.length,avg:tracked.length?Math.round(tracked.reduce((n,d)=>n+d.score,0)/tracked.length):0,streak,perfect:tracked.filter(d=>d.score===100).length,best:Math.max(0,...tracked.map(d=>d.score))};}
 return {validate,validId,plan,eligible,score,labels,metrics};
})();

/* QR Attendance — local-first PWA */
const DB_NAME='qr-attendance-db', DB_VERSION=1;
let db, currentSessionId=null, scanner=null, scanning=false, supabaseClient=null, user=null;
const $=id=>document.getElementById(id);
const uid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const dateLabel=s=>new Date(s).toLocaleString();
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('students',{keyPath:'id'});d.createObjectStore('sessions',{keyPath:'id'});d.createObjectStore('attendance',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function all(store){return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function put(store,obj){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(obj);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
function del(store,id){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function get(store,id){return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function qrPayload(student){return 'QRA:'+student.id}
async function render(){
 const [students,sessions,records]=await Promise.all([all('students'),all('sessions'),all('attendance')]);
 $('totalStudents').textContent=students.length;$('dashStudents').textContent=students.length;$('dashSessions').textContent=sessions.length;
 const today=new Date().toDateString();$('dashPresent').textContent=records.filter(r=>new Date(r.timestamp).toDateString()===today).length;
 $('studentList').className=students.length?'student-list':'student-list empty';
 const search=$('studentSearch').value.toLowerCase();
 const filtered=students.filter(s=>(s.name+' '+s.number).toLowerCase().includes(search)).sort((a,b)=>a.name.localeCompare(b.name));
 $('studentList').innerHTML=filtered.length?filtered.map(s=>`<div class="student-row"><div><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.number)}</small></div><button data-delete="${s.id}">Remove</button></div>`).join(''):'No matching students.';
 $('studentList').querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(confirm('Remove this student? Past attendance records are kept.')){await del('students',b.dataset.delete);render()}});
 const sorted=sessions.sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
 $('reportSession').innerHTML=sorted.length?sorted.map(s=>`<option value="${s.id}">${escapeHtml(s.name)} — ${dateLabel(s.startedAt)}</option>`).join(''):'<option value="">No lectures</option>';
 const active=sessions.find(s=>s.id===currentSessionId&&!s.endedAt);
 $('currentSessionText').textContent=active?active.name:'No active lecture';
 $('sessionBadge').textContent=active?'In progress':'Not started';$('sessionBadge').className='badge '+(active?'':'neutral');
 $('sessionStatus').textContent=active?'Taking attendance for '+active.name:'Start a lecture before scanning.';
 $('startCameraBtn').disabled=!active;$('endSessionBtn').disabled=!active;
 $('scanCount').textContent=records.filter(r=>r.sessionId===currentSessionId).length+' scanned';
 $('recentScans').innerHTML=records.filter(r=>r.sessionId===currentSessionId).sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,8).map(r=>`<div class="recent-item"><span>${escapeHtml(r.studentName)} <small>(${escapeHtml(r.studentNumber)})</small></span><span>${new Date(r.timestamp).toLocaleTimeString()}</span></div>`).join('')||'No students scanned yet.';
 renderReport();
}
async function renderReport(){
 const sid=$('reportSession').value;const [students,sessions,records]=await Promise.all([all('students'),all('sessions'),all('attendance')]);
 const session=sessions.find(s=>s.id===sid), present=records.filter(r=>r.sessionId===sid);
 $('reportPresent').textContent=present.length;$('reportAbsent').textContent=Math.max(0,students.length-present.length);
 $('reportRate').textContent=students.length?Math.round(present.length/students.length*100)+'%':'0%';
 if(!session){$('reportTable').textContent='No lectures yet.';return}
 const ids=new Set(present.map(r=>r.studentId));
 $('reportTable').innerHTML=`<h3>${escapeHtml(session.name)}</h3><table><thead><tr><th>Student</th><th>Student number</th><th>Status</th><th>Time</th></tr></thead><tbody>${students.sort((a,b)=>a.name.localeCompare(b.name)).map(s=>{const rec=present.find(r=>r.studentId===s.id);return `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.number)}</td><td class="${ids.has(s.id)?'present':'absent'}">${ids.has(s.id)?'Present':'Absent'}</td><td>${rec?new Date(rec.timestamp).toLocaleTimeString():'—'}</td></tr>`}).join('')}</tbody></table>`;
}
function switchTab(id){document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===id));document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));if(id==='reports')renderReport()}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$('studentForm').onsubmit=async e=>{e.preventDefault();const name=$('studentName').value.trim(),number=$('studentNumber').value.trim();const students=await all('students');if(students.some(s=>s.number.toLowerCase()===number.toLowerCase()))return toast('That student number already exists.');await put('students',{id:uid(),name,number,createdAt:now()});$('studentForm').reset();toast('Student added.');render()};
$('studentSearch').oninput=render;
$('newSessionBtn').onclick=()=>switchTab('scan');$('goScanBtn').onclick=()=>switchTab('scan');
$('startSessionBtn').onclick=async()=>{const name=$('sessionName').value.trim()||'Lecture '+new Date().toLocaleDateString();if(currentSessionId){const old=await get('sessions',currentSessionId);if(old&&!old.endedAt){toast('Finish the current lecture first.');return}}const s={id:uid(),name,startedAt:now(),endedAt:null};await put('sessions',s);currentSessionId=s.id;toast('Lecture started.');render()};
$('endSessionBtn').onclick=async()=>{if(!currentSessionId)return;const s=await get('sessions',currentSessionId);if(s){s.endedAt=now();await put('sessions',s)}await stopCamera();currentSessionId=null;toast('Lecture finished.');render()};
async function startCamera(){if(!window.Html5Qrcode){toast('Scanner library is not available. Connect to the internet once and reload.');return}try{if(!currentSessionId){toast('Start a lecture first.');return}scanner=new Html5Qrcode('reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:240,height:240}},onDecoded,()=>{});scanning=true;$('startCameraBtn').disabled=true;$('stopCameraBtn').disabled=false;toast('Camera started.')}catch(e){console.error(e);toast('Could not start camera. Check Safari camera permission and HTTPS.')}}
async function stopCamera(){if(scanner&&scanning){try{await scanner.stop();await scanner.clear()}catch(e){} }scanner=null;scanning=false;$('startCameraBtn').disabled=!currentSessionId;$('stopCameraBtn').disabled=true}
$('startCameraBtn').onclick=startCamera;$('stopCameraBtn').onclick=stopCamera;
let lastScan='',lastScanAt=0;
async function onDecoded(decoded){
 if(decoded===lastScan&&Date.now()-lastScanAt<1800)return;lastScan=decoded;lastScanAt=Date.now();
 const id=decoded.startsWith('QRA:')?decoded.slice(4):decoded;
 const student=await get('students',id);
 if(!student){$('scanResult').className='scan-result bad';$('scanResult').textContent='QR code not recognized. Make sure this student is in your roster.';return}
 const records=await all('attendance');if(records.some(r=>r.sessionId===currentSessionId&&r.studentId===student.id)){$('scanResult').className='scan-result';$('scanResult').textContent=student.name+' was already marked present.';return}
 const record={id:uid(),sessionId:currentSessionId,studentId:student.id,studentName:student.name,studentNumber:student.number,timestamp:now(),syncedAt:null};
 await put('attendance',record);$('scanResult').className='scan-result good';$('scanResult').textContent='✓ '+student.name+' — attendance recorded.';render();
}
$('reportSession').onchange=renderReport;
function download(name,content,type='text/plain'){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function csv(rows){return rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')}
$('exportStudentsBtn').onclick=async()=>{const s=await all('students');download('students.csv',csv([['name','student_number'],...s.map(x=>[x.name,x.number])]),'text/csv')};
$('exportReportBtn').onclick=async()=>{const sid=$('reportSession').value,[students,records,sessions]=await Promise.all([all('students'),all('attendance'),all('sessions')]);const s=sessions.find(x=>x.id===sid);if(!s)return toast('No lecture selected.');const rs=records.filter(r=>r.sessionId===sid),set=new Map(rs.map(r=>[r.studentId,r]));download('attendance-'+s.name.replace(/[^a-z0-9]+/gi,'-')+'.csv',csv([['student_name','student_number','status','timestamp'],...students.map(x=>{const r=set.get(x.id);return [x.name,x.number,r?'Present':'Absent',r?.timestamp||'']})]),'text/csv')};
$('exportAllBtn').onclick=async()=>{const [students,sessions,records]=await Promise.all([all('students'),all('sessions'),all('attendance')]);download('all-attendance.csv',csv([['lecture','student_name','student_number','timestamp'],...records.map(r=>[sessions.find(s=>s.id===r.sessionId)?.name||'',r.studentName,r.studentNumber,r.timestamp])]),'text/csv')};
$('printCardsBtn').onclick=async()=>{const students=await all('students');if(!students.length)return toast('Add students first.');if(!window.QRCode)return toast('QR generator unavailable. Connect once and reload.');const root=document.createElement('div');root.id='printRoot';root.innerHTML=students.map(s=>`<div class="id-card"><div><h2>${escapeHtml(s.name)}</h2><p>Student No. ${escapeHtml(s.number)}</p><p>STUDENT ID</p></div><div class="qr" id="qr-${s.id}"></div></div>`).join('');document.body.appendChild(root);students.forEach(s=>new QRCode(document.getElementById('qr-'+s.id),{text:qrPayload(s),width:180,height:180,correctLevel:QRCode.CorrectLevel.M}));setTimeout(()=>{window.print();root.remove()},700)};
$('importStudents').onchange=async e=>{const f=e.target.files[0];if(!f)return;const text=await f.text(),lines=text.split(/\r?\n/).filter(Boolean);let count=0;for(let i=1;i<lines.length;i++){const cols=lines[i].match(/("([^"]|"")*"|[^,]*)(,|$)/g)||[];const vals=cols.map(x=>x.replace(/,$/,'').replace(/^"|"$/g,'').replace(/""/g,'"'));const name=(vals[0]||'').trim(),number=(vals[1]||'').trim();if(name&&number){const old=(await all('students')).some(s=>s.number.toLowerCase()===number.toLowerCase());if(!old){await put('students',{id:uid(),name,number,createdAt:now()});count++}}}e.target.value='';toast(count+' students imported.');render()};
$('backupBtn').onclick=async()=>{const data={version:1,exportedAt:now(),students:await all('students'),sessions:await all('sessions'),attendance:await all('attendance')};download('qr-attendance-backup.json',JSON.stringify(data,null,2),'application/json')};
$('restoreBackup').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d.students||!d.sessions||!d.attendance)throw Error('Invalid backup');for(const x of d.students)await put('students',x);for(const x of d.sessions)await put('sessions',x);for(const x of d.attendance)await put('attendance',x);toast('Backup restored. Existing records were kept.');render()}catch(err){toast('Could not restore that backup.')}e.target.value=''};
function updateConnection(){$('connection').textContent=navigator.onLine?'Online':'Offline';$('connection').className='badge '+(navigator.onLine?'':'neutral')}
window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);
function cloudConfig(){return {url:localStorage.getItem('sb-url')||'',key:localStorage.getItem('sb-key')||''}}
function initCloud(){const c=cloudConfig();$('supabaseUrl').value=c.url;$('supabaseKey').value=c.key;if(c.url&&c.key&&window.supabase){supabaseClient=window.supabase.createClient(c.url,c.key);$('cloudStatus').textContent='Cloud configured. Sign in to sync.'}}
$('saveCloudBtn').onclick=()=>{localStorage.setItem('sb-url',$('supabaseUrl').value.trim());localStorage.setItem('sb-key',$('supabaseKey').value.trim());initCloud();toast('Cloud settings saved on this device.')};
$('signInBtn').onclick=async()=>{if(!supabaseClient)return toast('Save your Supabase URL and key first.');const email=prompt('Enter your account email:');if(!email)return;const password=prompt('Enter your password (or use a new password to create an account):');if(!password)return;let res=await supabaseClient.auth.signInWithPassword({email,password});if(res.error&&/invalid login credentials/i.test(res.error.message)){const create=confirm('Login failed. Create an account with this email and password?');if(create)res=await supabaseClient.auth.signUp({email,password})}if(res.error){$('cloudStatus').textContent=res.error.message;return}user=res.data.user;$('cloudStatus').textContent='Signed in as '+email+'. You can sync now.';toast('Signed in.')};
$('signOutBtn').onclick=async()=>{if(supabaseClient)await supabaseClient.auth.signOut();user=null;$('cloudStatus').textContent='Signed out.'};
$('syncBtn').onclick=async()=>{if(!supabaseClient)return toast('Configure Supabase first.');const {data}=await supabaseClient.auth.getUser();user=data.user;if(!user)return toast('Sign in before syncing.');try{
 const tables=[['students',await all('students')],['sessions',await all('sessions')],['attendance',await all('attendance')]];
 for(const [table,items] of tables){const rows=items.map(x=>({...x,user_id:user.id}));if(rows.length){const {error}=await supabaseClient.from(table).upsert(rows,{onConflict:'id'});if(error)throw error}}
 $('cloudStatus').textContent='Sync complete at '+new Date().toLocaleTimeString()+'.';toast('Cloud sync complete.');
 }catch(e){console.error(e);$('cloudStatus').textContent='Sync failed: '+e.message;toast('Sync failed. Check SETUP.md and database policies.') }};
(async()=>{db=await openDB();updateConnection();initCloud();if('serviceWorker'in navigator){try{await navigator.serviceWorker.register('./sw.js')}catch(e){console.warn('SW registration failed',e)}}await render()})();


const API = (typeof browser !== 'undefined') ? browser : chrome;
async function getActiveTabId(){ const tabs = await API.tabs.query({active:true, currentWindow:true}); return tabs[0] && tabs[0].id; }
function renderList(el, arr){ el.innerHTML=''; if(!arr||!arr.length){ el.innerHTML='<div class="muted">Nenhum</div>'; return; } arr.forEach(s=>{ const span=document.createElement('span'); span.className='pill'; span.textContent=s; el.appendChild(span); }); }
(async function init(){
  const tabId = await getActiveTabId();
  const st = await API.runtime.sendMessage({type:'GET_BLOCKING_STATE', tabId});
  document.getElementById('toggleBlocking').checked = !!(st && st.enabled);
  document.getElementById('toggleBlocking').addEventListener('change', async (e)=>{ await API.runtime.sendMessage({type:'TOGGLE_BLOCKING', tabId, enabled:e.target.checked}); load(); });
  async function load(){
    const res = await API.runtime.sendMessage({type:'GET_TAB_REPORT', tabId}); if(!res||!res.ok) return;
    const r = res.report;
    document.getElementById('score').textContent = r.score;
    document.getElementById('thirdCount').textContent = r.thirdParties.length; document.getElementById('firstCount').textContent = (r.trackers && r.trackers.first ? r.trackers.first.length : 0);
    document.getElementById('thirdTrackCount').textContent = (r.trackers && r.trackers.third ? r.trackers.third.length : 0);
    document.getElementById('blockedCount').textContent = r.blocked.length; document.getElementById('cookieCount').textContent = r.cookies.length;
    renderList(document.getElementById('thirdList'), r.thirdParties); renderList(document.getElementById('firstList'), (r.trackers && r.trackers.first) || []);
    renderList(document.getElementById('thirdTrackList'), (r.trackers && r.trackers.third) || []);
    renderList(document.getElementById('blockedList'), r.blocked);
    renderList(document.getElementById('cookieList'), r.cookies.map(c=> (c.hostOnly?'[1P] ':'[?] ')+c.domain+' • '+c.name+(c.session?' • sessão':'')));
    document.getElementById('storageInfo').textContent = `localStorage: ${r.storage.local} chaves • sessionStorage: ${r.storage.session} • indexedDB: ${r.storage.indexeddb?'sim':'não'}`;
    const cf = document.getElementById('canvasFlag'); cf.textContent = 'Canvas FP: ' + (r.canvasFingerprint?'suspeito':'não observado'); cf.className='pill '+(r.canvasFingerprint?'bad':'ok');
    const cs = document.getElementById('cookieSync'); cs.textContent = 'Cookie Sync: ' + (r.cookieSync?'suspeito':'não observado'); cs.className='pill '+(r.cookieSync?'warn':'ok');
  }
  load(); setInterval(load, 1200);
})();
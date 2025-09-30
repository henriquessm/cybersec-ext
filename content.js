
(function(){
  const API = (typeof browser !== 'undefined') ? browser : chrome;

  try {
    const s = document.createElement('script');
    s.src = API.runtime.getURL('injected.js');
    (document.head || document.documentElement).appendChild(s);
    s.remove();
  } catch(e) {}

  window.addEventListener('cybersecext-canvas', ()=>{
    try { API.runtime.sendMessage({type:'SET_CANVAS_FLAG'}); } catch(e){}
  }, {capture:false, passive:true});

  function snapshotStorage(){
    let localCount = 0, sessionCount = 0, keys = [];
    try { localCount = localStorage ? localStorage.length : 0; for (let i=0;i<localCount;i++) keys.push('local:'+localStorage.key(i)); } catch(_){}
    try { sessionCount = sessionStorage ? sessionStorage.length : 0; for (let i=0;i<sessionCount;i++) keys.push('session:'+sessionStorage.key(i)); } catch(_){}
    let hasIndexedDB = false; try { hasIndexedDB = !!window.indexedDB; } catch(_){}
    API.runtime.sendMessage({ type:'SET_STORAGE_INFO', payload:{ local: localCount, session: sessionCount, indexeddb: hasIndexedDB, keys } });
  }
  snapshotStorage();
  document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'visible') snapshotStorage(); });
})();

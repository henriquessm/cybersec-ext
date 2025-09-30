
const API = (function(){
  if (typeof browser !== 'undefined') return browser;
  const wrap = (fn) => (...args) => new Promise((resolve)=> fn(...args, (res)=> resolve(res)));
  return {
    storage: { local: { get: wrap(chrome.storage.local.get), set: wrap(chrome.storage.local.set) } },
    cookies: { getAll: wrap(chrome.cookies.getAll) },
    tabs: { query: wrap(chrome.tabs.query) },
    runtime: chrome.runtime,
    webRequest: chrome.webRequest
  };
})();

const DEFAULT_BLOCKLIST = `
google-analytics.com
www.google-analytics.com
ssl.google-analytics.com
googletagmanager.com
www.googletagmanager.com
facebook.net
connect.facebook.net
doubleclick.net
stats.g.doubleclick.net
adservice.google.com
criteo.com
bidr.io
quantserve.com
scorecardresearch.com
branch.io
mixpanel.com
segment.io
hotjar.com
match.adsrvr.org
`;

const state = {
  tabs: new Map(),
  enabledBlocking: new Map(),
  blocklist: new Set(),
  cookieCount: {}
};
const KEYS = { BLOCKLIST:'cybersecext_blocklist' };

async function loadBlocklist(){
  try{
    const res = await API.storage.local.get(KEYS.BLOCKLIST);
    const saved = res ? res[KEYS.BLOCKLIST] : null;
    const text = (saved && typeof saved === 'string' && saved.trim().length) ? saved : DEFAULT_BLOCKLIST;
    state.blocklist = new Set(text.split(/\r?\n/).map(l=>l.trim().toLowerCase()).filter(l=>l && !l.startsWith('#')));
  }catch(e){ state.blocklist = new Set(); }
}

function freshTabState(){
  return {
    thirdParties: new Set(),
    blocked: new Set(),
    requests: [],
    cookies: [],
    storage: {local:0, session:0, indexeddb:false, keys:[]},
    canvasFlag: false,
    cookieSync: false,
    trackers: { first:new Set(), third:new Set(), blockedFirst:new Set(), blockedThird:new Set() }
  };
}

function getTabRec(tabId){
  if (!state.tabs.has(tabId)){
    state.tabs.set(tabId, freshTabState());
    state.enabledBlocking.set(tabId, true);
  }
  return state.tabs.get(tabId);
}

function hostname(u){ try{ return new URL(u).hostname; }catch{return '';} }
function etld1(h){ const p=h.split('.').filter(Boolean); return p.length<=2?h:p.slice(-2).join('.'); }
function sameSite(urlA, urlB){
  const a = etld1(hostname(urlA)); const b = etld1(hostname(urlB));
  return a && b && a===b;
}
function isTracker(host){
  host=(host||'').toLowerCase(); if(!host) return false;
  if (state.blocklist.has(host)) return true;
  for (const c of state.blocklist){
    if (host===c) return true;
    if (c.startsWith('.')) { if (host.endsWith(c)) return true; }
    else if (host.endsWith('.'+c)) return true;
  }
  return false;
}

async function analyzeCookies(tabId, url){
  try{
    const cookies = await API.cookies.getAll({ url });
    const rec = getTabRec(tabId);
    rec.cookies = cookies || [];
    state.cookieCount[tabId] = { firstParty:0, thirdParty:0, session:0, persistent:0 };
    const site = etld1(hostname(url));
    (cookies||[]).forEach(c=>{
      if (c.session) state.cookieCount[tabId].session++; else state.cookieCount[tabId].persistent++;
      const cd = (c.domain||'').replace(/^\./,'');
      const cEtld1 = etld1(cd);
      if (cEtld1 && site && cEtld1===site) state.cookieCount[tabId].firstParty++;
      else state.cookieCount[tabId].thirdParty++;
    });
  }catch(e){}
}
( (typeof browser!=='undefined' && browser.tabs && browser.tabs.onUpdated) ? browser.tabs.onUpdated : chrome.tabs.onUpdated )
  .addListener((tabId, changeInfo, tab)=>{
    if (changeInfo.status === 'complete' && tab && tab.url) analyzeCookies(tabId, tab.url);
    if (changeInfo.status === 'loading') state.tabs.set(tabId, freshTabState());
  });

chrome.tabs.onRemoved.addListener((tabId)=>{ state.tabs.delete(tabId); state.enabledBlocking.delete(tabId); delete state.cookieCount[tabId]; });

chrome.webRequest.onBeforeRequest.addListener((details)=>{
  if (details.tabId < 0) return {};
  const rec = getTabRec(details.tabId);
  const reqHost = hostname(details.url);
  const docUrl = details.documentUrl || details.originUrl || details.initiator || '';
  const is3p = docUrl ? !sameSite(details.url, docUrl) : false;
  if (is3p) rec.thirdParties.add(reqHost);

  const track = isTracker(reqHost);
  if (track){
    if (is3p) rec.trackers.third.add(reqHost); else rec.trackers.first.add(reqHost);
  }

  const suspicious = /(?:sync|match|usersync|setuid|idfa|aaid|partnerid|userid|pmid|gpc|uid)=/i.test(details.url) ||
                     /(match\.adsrvr\.org|criteo\.com|adnxs\.com|casalemedia\.com|rubiconproject\.com)/i.test(reqHost);
  if (suspicious) rec.cookieSync = true;

  const blockingEnabled = state.enabledBlocking.get(details.tabId);
  if (blockingEnabled && track){
    rec.blocked.add(reqHost);
    if (is3p) rec.trackers.blockedThird.add(reqHost); else rec.trackers.blockedFirst.add(reqHost);
    rec.requests.push({url:details.url, blocked:true, time:Date.now()});
    return { cancel:true };
  } else {
    rec.requests.push({url:details.url, blocked:false, time:Date.now()});
    return {};
  }
}, {urls:["<all_urls>"]}, ["blocking"]);

API.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  (async ()=>{
    try{
      if (msg.type==='GET_TAB_REPORT'){
        const tabId = msg.tabId ?? (sender && sender.tab && sender.tab.id);
        const rec = state.tabs.get(tabId) || freshTabState();
        // ensure cookies exist
        if ((!rec.cookies || rec.cookies.length===0) && API.tabs){
          const tabs = await API.tabs.query({});
          const t = tabs.find(x=>x && x.id===tabId);
          if (t && t.url) await analyzeCookies(tabId, t.url);
        }
        const score = computeScore(tabId, rec);
        sendResponse({ ok:true, report:{
          thirdParties: Array.from(rec.thirdParties||[]),
          blocked: Array.from(rec.blocked||[]),
          cookies: (rec.cookies||[]).map(c=>({name:c.name, domain:c.domain, hostOnly:c.hostOnly, session:c.session, secure:c.secure})),
          storage: rec.storage||{},
          canvasFingerprint: !!rec.canvasFlag,
          cookieSync: !!rec.cookieSync,
          trackers: {
            first: Array.from((rec.trackers&&rec.trackers.first)||[]),
            third: Array.from((rec.trackers&&rec.trackers.third)||[]),
            blockedFirst: Array.from((rec.trackers&&rec.trackers.blockedFirst)||[]),
            blockedThird: Array.from((rec.trackers&&rec.trackers.blockedThird)||[])
          },
          score
        }});
      }
      else if (msg.type==='SET_STORAGE_INFO'){
        const tabId = sender && sender.tab && sender.tab.id;
        if (tabId!=null) getTabRec(tabId).storage = msg.payload;
        sendResponse({ok:true});
      }
      else if (msg.type==='SET_CANVAS_FLAG'){
        const tabId = sender && sender.tab && sender.tab.id;
        if (tabId!=null) getTabRec(tabId).canvasFlag = true;
        sendResponse({ok:true});
      }
      else if (msg.type==='TOGGLE_BLOCKING'){
        state.enabledBlocking.set(msg.tabId, !!msg.enabled); sendResponse({ok:true});
      }
      else if (msg.type==='GET_BLOCKING_STATE'){
        sendResponse({ok:true, enabled: !!state.enabledBlocking.get(msg.tabId)});
      }
      else if (msg.type==='SAVE_BLOCKLIST'){
        await API.storage.local.set({[KEYS.BLOCKLIST]: String(msg.text||'')}); await loadBlocklist(); sendResponse({ok:true});
      }
      else if (msg.type==='GET_BLOCKLIST'){
        const res = await API.storage.local.get(KEYS.BLOCKLIST); sendResponse({ok:true, text:(res && res[KEYS.BLOCKLIST]) || DEFAULT_BLOCKLIST});
      }
    }catch(e){ sendResponse({ok:false, error:String(e)}); }
  })();
  return true;
});

function computeScore(tabId, rec){
  let score=100;
  const third = rec.thirdParties ? rec.thirdParties.size : 0;
  const blocked = rec.blocked ? rec.blocked.size : 0;
  const cookies = state.cookieCount[tabId] || { firstParty:0, thirdParty:0, session:0, persistent:0 };
  const storage=rec.storage||{local:0,session:0,indexeddb:false};
  score -= Math.min(40, third*2);
  score -= Math.min(20, Math.max(0, (cookies.firstParty+cookies.thirdParty)-3));
  if (storage.indexeddb) score -= 5;
  score -= Math.min(10, Math.floor((storage.local||0)/10));
  if (rec.canvasFlag) score -= 10;
  if (rec.cookieSync) score -= 15;
  score += Math.min(15, blocked);
  return Math.max(0, Math.min(100, score));
}

loadBlocklist();

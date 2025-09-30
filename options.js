
const API = (typeof browser !== 'undefined') ? browser : chrome;
(async function(){
  try {
    const res = await API.runtime.sendMessage({type:'GET_BLOCKLIST'});
    document.getElementById('list').value = (res && res.ok) ? (res.text || '') : '';
  } catch (e) {
    console.error('GET_BLOCKLIST failed', e);
  }
  document.getElementById('save').addEventListener('click', async ()=>{
    const text = document.getElementById('list').value;
    await API.runtime.sendMessage({type:'SAVE_BLOCKLIST', text});
    const s = document.getElementById('status');
    s.textContent = 'Salvo.';
    setTimeout(()=> s.textContent = '', 1500);
  });
})();

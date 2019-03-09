chrome.tabs.query({active: true, currentWindow: true}, tabs =>
  chrome.tabs.executeScript(tabs[0].id, { file: 'contentScript.js' }));

document.querySelector('#add').addEventListener('click', e => {
  console.log('clicked add');
}, false);

document.querySelector('#reset').addEventListener('click', e => {
  console.log('clicked reset');
}, false);
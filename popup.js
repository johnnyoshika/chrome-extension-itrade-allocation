var noPositionsTemplate = _.template(document.querySelector('#no-positions').innerHTML);
var positionsTemplate = _.template(document.querySelector('#positions').innerHTML);

chrome.tabs.query({active: true, currentWindow: true}, tabs =>
  chrome.tabs.executeScript(tabs[0].id, { file: 'contentScript.js' }));

chrome.runtime.onMessage.addListener((request) => {
  if (!request.positions) return;

  if (!request.positions.length)
    document.querySelector('[data-outlet="account"]').innerHTML = noPositionsTemplate();
  else
    document.querySelector('[data-outlet="account"]').innerHTML = positionsTemplate({ positions: request.positions });
});

document.querySelector('#add').addEventListener('click', e => {
  console.log('clicked add');
}, false);

document.querySelector('#reset').addEventListener('click', e => {
  console.log('clicked reset');
}, false);
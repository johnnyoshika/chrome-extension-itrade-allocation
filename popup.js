var noPositionsTemplate = _.template(document.querySelector('#no-positions').innerHTML);
var positionsTemplate = _.template(document.querySelector('#positions').innerHTML);
var positions;

chrome.tabs.query({active: true, currentWindow: true}, tabs =>
  chrome.tabs.executeScript(tabs[0].id, { file: 'contentScript.js' }));

var renderPortfolio = (type, positions) =>
  positions.length
    ? document.querySelector(`[data-outlet="${type}"]`).innerHTML = positionsTemplate({ positions: positions })
    : document.querySelector(`[data-outlet="${type}"]`).innerHTML = noPositionsTemplate();

chrome.runtime.onMessage.addListener(request => {
  positions = request.positions;
  request.positions && renderPortfolio('account', request.positions)
});

chrome.storage.sync.get('positions', data => 
  (data.positions = data.positions || []) && renderPortfolio('total', data.positions));

chrome.storage.onChanged.addListener((changes, namespace) =>
  changes.positions && renderPortfolio('total', changes.positions.newValue));

document.querySelector('#mappings').addEventListener('click', e => {
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
});
  
document.querySelector('#add').addEventListener('click', e => {
  chrome.storage.sync.get('positions', data => {
    data.positions = data.positions || [];
    positions.forEach(p => {
      var match = data.positions.find(e => e.symbol === p.symbol && e.currency == p.currency);
      if (match)
        match.value += p.value;
      else
        data.positions.push(p);
    });
    chrome.storage.sync.set({positions: data.positions});
  });
}, false);

document.querySelector('#reset').addEventListener('click', e => {
  chrome.storage.sync.set({positions: []});
}, false);
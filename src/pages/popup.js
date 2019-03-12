var PINSIGHT = window.PINSIGHT || {};

PINSIGHT.popup = (function(){
  var positions;

  var cad = (value, currency, conversion) =>
    value / (currency === 'USD' ? conversion : 1);

  var round2Decimals = x => Math.round(x * 100) / 100;

  // https://stackoverflow.com/a/2901298/188740
  var formatValue = x => {
      var parts = round2Decimals(x).toString().split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return parts.join(".");
  };

  chrome.tabs.query({active: true, currentWindow: true}, tabs =>
    chrome.tabs.executeScript(tabs[0].id, { file: '/contents/scotia-itrade.js' }));

  var renderPortfolio = (type, positions) =>
    positions.length
      ? document.querySelector(`[data-outlet="${type}"]`).innerHTML = Handlebars.templates.positions(positions.map(p => ({
          symbol: p.symbol,
          value: formatValue(p.value),
          currency: p.currency })))
      : document.querySelector(`[data-outlet="${type}"]`).innerHTML = Handlebars.templates.positionsNone();

  var renderConversion = conversion =>
    document.querySelector(`[data-outlet="conversion"]`).innerHTML = Handlebars.templates.conversion({ conversion: conversion });

  var renderAllocations = (positions, mappings, conversion) => {
    if (!positions.length) {
      document.querySelector(`[data-outlet="allocations"]`).innerHTML = Handlebars.templates.positionsNone();
      return;
    }

    var allocations = positions
      .map(p => ({
        position: p,
        mapping: mappings.find(m => m.symbol === p.symbol) || { category: 'Uncategorized', symbol: p.symbol } }))
      .reduce((allocations, pm) => {
        var allocation = allocations.find(a => a.category === pm.mapping.category);
        if (!allocation) {
          allocation = { category: pm.mapping.category, value: 0 };
          allocations.push(allocation);
        }
        allocation.value += cad(pm.position.value, pm.position.currency, conversion);
        return allocations;
      }, []);

    var total = allocations.reduce((sum, a) => sum + a.value, 0);

    document.querySelector(`[data-outlet="allocations"]`).innerHTML = Handlebars.templates.allocations(
      allocations
        .sort((a, b) => b.value - a.value)
        .map(a => ({ category: a.category, value: formatValue(a.value), percentage: ((a.value / total) * 100).toFixed(1) }))
    );
  }

  chrome.runtime.onMessage.addListener(request => {
    positions = request.positions;
    request.positions && renderPortfolio('account', request.positions);
  });

  var render = () => {
    chrome.storage.sync.get(['positions', 'mappings', 'conversion'], data => {
      data.positions = data.positions || [];
      data.conversion = data.conversion || 1;
      data.mappings = data.mappings || [];

      renderPortfolio('total', data.positions);
      renderConversion(data.conversion);
      renderAllocations(data.positions, data.mappings, data.conversion);
    });
  };

  chrome.storage.onChanged.addListener((changes, namespace) => render());

  document.querySelector('#mappings').addEventListener('click', e => {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html') });
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

  render();
}());
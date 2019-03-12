var PORTFOLIO = (function(){

  var noMappingsTemplate = _.template(document.querySelector('#no-mappings').innerHTML);
  var mappingsTemplate = _.template(document.querySelector('#mappings').innerHTML);
  var mapTemplate = _.template(document.querySelector('#map').innerHTML);
  var conversionTemplate = _.template(document.querySelector('#conversion').innerHTML);
  var conversionEditTemplate = _.template(document.querySelector('#conversion-edit').innerHTML);
  
  var renderMappings = mappings =>
    mappings.length
      ? document.querySelector(`[data-outlet="mappings"]`).innerHTML = mappingsTemplate({ mappings: mappings })
      : document.querySelector(`[data-outlet="mappings"]`).innerHTML = noMappingsTemplate();
  
  var renderMap = () => {
    document.querySelector('[data-outlet="map"]').innerHTML = mapTemplate();
    document.querySelector('input').focus();
  }
  
  var renderConversion = conversion =>
    document.querySelector('[data-outlet="conversion"]').innerHTML = conversionTemplate({conversion: conversion});
  
  var renderEditConversion = () =>
    document.querySelector('[data-outlet="conversion-edit"]').innerHTML = conversionEditTemplate({conversion: ''});
  
  chrome.storage.sync.get('mappings', data =>
    (data.mappings = data.mappings || []) && renderMappings(data.mappings));
  
  chrome.storage.sync.get('conversion', data =>
    (data.conversion = data.conversion || 1) && renderConversion(data.conversion));
  
  chrome.storage.onChanged.addListener((changes, namespace) =>
    changes.mappings && renderMappings(changes.mappings.newValue));
  
  chrome.storage.onChanged.addListener((changes, namespace) =>
    changes.conversion && renderConversion(changes.conversion.newValue));
  
  document.querySelector('[data-outlet="map"]').addEventListener('keydown', e => {
    if (e.defaultPrevented) return; // Should do nothing if the default action has been cancelled
    if(e.target.tagName !== 'INPUT') return;
    if (e.keyCode !== 13) return;
  
    e.preventDefault();
    var symbol = document.querySelector('input[name="symbol"]').value;
    var category = document.querySelector('input[name="category"]').value;
    chrome.storage.sync.get('mappings', data => {
      data.mappings = data.mappings || [];
      var mapping = data.mappings.find(m => m.symbol === symbol);
      if (mapping)
        mapping.category = category;
      else
        data.mappings.push({symbol: symbol, category: category});
  
      chrome.storage.sync.set({mappings: data.mappings});
  
      renderMap();
    });
  });
  
  document.querySelector('[data-outlet="mappings"]').addEventListener('click', e => {
    if(e.target.getAttribute('data-action') !== 'delete') return;
  
    e.preventDefault();
    var symbol = e.target.parentNode.parentNode.getAttribute('data-symbol');
    chrome.storage.sync.get('mappings', data => {
      data.mappings = data.mappings || [];
      var mapping = data.mappings.find(m => m.symbol === symbol);
      if (!mapping) return;
  
      var index = data.mappings.indexOf(mapping);
      data.mappings.splice(index, 1);
      chrome.storage.sync.set({mappings: data.mappings});
    });
  });
  
  document.querySelector('[data-outlet="conversion-edit"]').addEventListener('keydown', e => {
    if (e.defaultPrevented) return; // Should do nothing if the default action has been cancelled
    if(e.target.tagName !== 'INPUT') return;
    if (e.keyCode !== 13) return;
  
    e.preventDefault();
    var conversion = document.querySelector('input[name="conversion"]').value;
    chrome.storage.sync.set({conversion: parseFloat(conversion)}, () => document.querySelector('input[name="conversion"]').value = '');
  });
  
  renderMap();
  renderEditConversion();

}());
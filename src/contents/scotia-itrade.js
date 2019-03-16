// sections that hold positions look like this:
// <div id="itrade_position_repeat:0:j_id709"> -> Canadian Account Positions
// <div id="itrade_position_repeat:1:j_id709"> -> U.S. Account Positions

var parseValue = text => text && parseFloat(text.replace(/,/g,''));
var parseCurrency = text => text && text.match(/\((.*?)\)/)[1];
var safeNavigation = (obj, property) => obj && obj[property];

var positions = [];
document.querySelectorAll('[id$="j_id709"]')
  .forEach(container => 
    // table body that holds shares looks like this:
    // <tbody class="var-acct-det-hst-expand-cat">
    container.querySelectorAll('tbody.var-acct-det-hst-expand-cat')
      .forEach(tbody => {
        // There are 2 tr for each holding, and one last tr for subtotal.
        // Of the 2 tr, only the first one <tr> is what we want.
        // I don't know what the other tr (which looks like <tr id="accountHoldings-Official...") is for.
        tbody.querySelectorAll('tr:not([id])').forEach((tr, index, array) => {
          // The last one is the subtotal row
          if (index >= array.length - 1)
            return;
          
          positions.push({
            symbol: safeNavigation(tr.querySelector('[id$="j_id792"]'), 'textContent'),
            value: parseValue(safeNavigation(tr.querySelector('[id$="j_id849"]'), 'textContent')),
            currency: parseCurrency(safeNavigation(array[array.length-1].querySelector('.text'), 'textContent'))
          });
        })
      })
  );

var portfolio = document.querySelector('.branding-header').querySelector('h3[title]').textContent;

chrome.runtime.sendMessage({
    page: {
        id: portfolio,
        name: portfolio,
        positions: positions
    }});

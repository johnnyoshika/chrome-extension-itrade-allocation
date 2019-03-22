(function () {

    // sections that hold positions look like this:
    // <div id="itrade_position_repeat:0:j_id709"> -> Canadian Account Positions
    // <div id="itrade_position_repeat:1:j_id709"> -> U.S. Account Positions

    let parseValue = text => text && parseFloat(text.replace(/,/g,''));
    let parseCurrency = text => text && text.match(/\((.*?)\)/)[1];
    let safeNavigation = (obj, property) => obj && obj[property];

    let positions = [];
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
                ticker: safeNavigation(tr.querySelector('[id$="j_id792"]'), 'textContent'),
                value: parseValue(safeNavigation(tr.querySelector('[id$="j_id849"]'), 'textContent')),
                currency: parseCurrency(safeNavigation(array[array.length-1].querySelector('.text'), 'textContent'))
              });
            })
          })
      );

    let accountName = document.querySelector('.branding-header').querySelector('h3[title]').textContent;

    if (!accountName)
        return;

    let getInfo = function () {
        if (!positions.length)
            return 'Positions list is empty.';

        return null;;
    };

    chrome.runtime.sendMessage({
        brokerage: {
            account: {
                id: 'scotia-itrade:' + accountName,
                name: accountName,
                brokerage: 'Scotia iTrade',
                positions: positions
            },
            message: {
                error: null,
                info: getInfo()
            }
        }});

}());

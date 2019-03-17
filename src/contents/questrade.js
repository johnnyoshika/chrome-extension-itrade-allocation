(function () {

    var parseValue = text => text && parseFloat(text.replace(/,/g, ''));

    // Need at least symbol and market value. User will need to edit columns to add currency.
    var positions = $('table')
        .has('th[data-qt="lblPositionsSymbol"]')
        .has('th[data-qt="lblPositionsMarketValue"]')
        .find('tbody tr')
        .map((index, element) => ({
            symbol: $(element).find('[data-qt="boxPositionsSymbol"]').find('[data-qt="lstPositionsSymbol"]').text().toUpperCase(),
            value: parseValue($(element).find('[data-qt="lstPositionsMarketValue"]').text()),
            currency: $(element).find('[data-qt="lstPositionsCurrency"]').text().toUpperCase()
        }))
        .toArray();

    var accountName = $('[data-qt="lblSelectorName"]').first().text();

    chrome.runtime.sendMessage({
        brokerage: {
            id: 'questrade:' + accountName,
            name: accountName,
            positions: positions
        }
    });

}());

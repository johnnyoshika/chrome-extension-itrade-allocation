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

    if (!accountName)
        return;

    var getInfo = function () {
        if (!positions.length)
            return 'Positions list is empty.';

        if (positions.some(p => !p.currency))
            return `Currency is missing. Edit columns to add 'Currency' to the list.`;

        return null;;
    };

    chrome.runtime.sendMessage({
        brokerage: {
            account: {
                id: 'questrade:' + accountName,
                name: accountName,
                positions: positions
            },
            message: {
                error: null,
                info: getInfo()
            }
        }
    });

}());

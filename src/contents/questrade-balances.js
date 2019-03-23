(function () {

    let parseValue = text => text && parseFloat(text.replace(/[,$]/g, ''));

    let cad = parseValue($('[data-qt="lblCash_BALANCES_CAD"]').text());
    let usd = parseValue($('[data-qt="lblCash_BALANCES_USD"]').text());
    let accountName = $('[data-qt="lblSelectorName"]').first().text();

    if (!accountName)
        return;

    chrome.runtime.sendMessage({
        brokerage: {
            account: {
                id: 'questrade:' + accountName,
                name: accountName,
                brokerage: 'Questrade',
                positions: [
                    { ticker: 'CASH', value: cad, currency: 'CAD' },
                    { ticker: 'CASH', value: usd, currency: 'USD' }
                ]
            },
            message: {
                error: null,
                info: null
            }
        }
    });

}());

(function () {
    let negate = text => (text && /\([\d,$\.]+\)/.test(text)) ? -1 : 1;
    let parseValue = text => text && (negate(text) * parseFloat(text.replace(/[,$()]/g, '')));

    let cad = parseValue($('[data-qt="lblCash_BALANCES_CAD"]').find('.value').text());
    let usd = parseValue($('[data-qt="lblCash_BALANCES_USD"]').find('.value').text());
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
                ],
                type: 'cash-only'
            },
            message: {
                error: null,
                info: null
            }
        }
    });

}());

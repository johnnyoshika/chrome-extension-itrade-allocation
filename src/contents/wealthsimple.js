(function () {
    let parseValue = text => text && parseFloat(text.replace(/[,$]/g, ''));

    let positions = $('.asset-allocation-table tbody tr')
        .has('.holding')
        .has('ws-fancy-currency')
        .map((index, element) => ({
            ticker: $(element).find('.holding').text().toUpperCase(),
            value: parseValue($(element).find('ws-fancy-currency').attr('number')),
            currency: 'CAD'
        }))
        .toArray();

    let accountId = new URL(document.location).searchParams.get('portfolio_id');
    if (!accountId)
        return;

    let getInfo = function () {
        if (!positions.length)
            return 'Positions list is empty.';

        return null;;
    };

    chrome.runtime.sendMessage({
        brokerage: {
            account: {
                id: 'wealthsimple:' + accountId,
                name: 'Wealthsimple ' + ($('.account-name:visible').text() || accountId), // prepend Wealthsimple b/c default names are generic (e.g. Personal)
                brokerage: 'Wealthsimple',
                positions: positions
            },
            message: {
                error: null,
                info: getInfo()
            }
        }
    });

}());

(function () {

    // sections that hold positions look like this:
    // <div id="itrade_position_repeat:0:j_id709"> -> Canadian Account Positions
    // <div id="itrade_position_repeat:1:j_id709"> -> U.S. Account Positions

    let parseValue = text => text && parseFloat(text.replace(/,/g,''));
    let parseCurrency = text => text && text.match(/\((.*?)\)/)[1];
    
    let positions = $('[id$="j_id709"]')
        .find('tbody.var-acct-det-hst-expand-cat')
        .map((index, element) => {
            let rows = $(element).find('tr:not([id])');
            let subtotalRow = rows.last();
            return rows.filter(':not(:last)')
                .map((index, element) => ({
                    ticker: $(element).find('[id$="j_id792"]').text(),
                    value: parseValue($(element).find('[id$="j_id849"]').text()),
                    currency: parseCurrency(subtotalRow.find('.text').text())
                })).toArray();
        }).toArray().flatMap(a => a);

    let accountName = $('.branding-header').find('h3[title]').text();

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

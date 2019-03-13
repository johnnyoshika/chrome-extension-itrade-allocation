# Scotia iTrade Portfolio Allocation Calculator
Chrome extension for calculating Scotia iTrade Portfolio Allocation across multiple portfolios

## Development
* To adhere to Chrome's strict CSP, we need to pre-compile templates
* Install handlebars version 4.1.0: `npm install -g handlebars@4.1.0`
* Compile: `handlebars ./templates  -f ./src/pages/templates.js`

## Testing
* Go to [chrome://extensions/](chrome://extensions/)
* Click `Load unpacked` and select the `./src` folder

## Use
* Log in to Scotia iTrade.
* Go to a portfolio detail page. This Chrome extension popup icon should turn red.
* Click the popup icon. Portfolio holdings on the page should be displayed. If everything looks right, click `Add to Total`. Do this on  every portfolio page.
* Click `Mappings` to categorize portfolio holdings.
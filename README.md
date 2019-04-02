# Portfolio Insight

## Description
Chrome extension for calculating portfolio allocations across multiple brokerages and accounts.

## Supported Brokerages:

* Questrade
* Scotia iTrade
* Wealthsimple

## Development
* To adhere to Chrome's strict CSP, we need to pre-compile templates
* Install handlebars version 4.1.0: `npm install -g handlebars@4.1.0`
* Compile once:
  * `handlebars ./templates/console -f ./src/pages/console-templates.js`
* Watch and compile:
  * Install handlebars-watch: `npm install -g handlebars-watch`
  * Run: `handlebars-watch -c ./hbw-config.json`

## Testing
* Go to [chrome://extensions/](chrome://extensions/)
* Click `Load unpacked` and select the `./src` folder

## Use
* Scotia iTrade
  * Log in to Scotia iTrade.
  * Go to a portfolio detail page. This Chrome extension popup icon should turn green.
  * Click the popup icon. Portfolio holdings on the page should be displayed. If everything looks right, click `Add to Portfolio`. Do this on  every portfolio page.
  * Click `Go to Dashboard` to view summary of all of your holdings and asset allocations.
* Questrade
  * Similar to Scotia iTrade, but to balances page to fetch cash balances and positions page to fetch positions
* Wealthsimpl
  * Similar to Scotia iTrade, but go to account detail to fetch holdings

## Publish
* Put everything inside `src` folder in a zip file. Don't include the `src` folder, so that manifest.json is in the root of the zip file.
* Go to Chrome Developer Dashboard: https://chrome.google.com/webstore/developer/dashboard
* Register an extension and upload the zip file (aka Package)
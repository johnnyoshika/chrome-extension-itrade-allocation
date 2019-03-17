# Portfolio Insight

## Description
Chrome extension for calculating portfolio allocations across multiple brokerages and accounts.

## Supported Brokerages:

* Questrade
* Scotia iTrade

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
* Log in to Scotia iTrade.
* Go to a portfolio detail page. This Chrome extension popup icon should turn red.
* Click the popup icon. Portfolio holdings on the page should be displayed. If everything looks right, click `Add to Total`. Do this on  every portfolio page.
* Click `Mappings` to categorize portfolio holdings.
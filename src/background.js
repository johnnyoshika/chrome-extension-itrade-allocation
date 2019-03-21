chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { urlMatches: 'https:\/\/www\.scotiaonline\.scotiabank\.com\/online\/views\/accounts\/accountDetails\/.+' }
        }),
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { urlMatches: 'https:\/\/my.questrade.com\/trading\/account\/positions' }
        }),
        new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { urlMatches: 'https:\/\/my.wealthsimple.com\/app\/account' }
        })
      ],
      actions: [new chrome.declarativeContent.ShowPageAction()]
    }]);
  });
});
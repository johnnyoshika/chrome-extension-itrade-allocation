let PINSIGHT = window.PINSIGHT || {};

PINSIGHT.console = (function () {

    //#region HELPERS

    let parseValue = text => text && parseFloat(text.replace(/,/g, ''));

    // https://stackoverflow.com/a/2901298/188740
    let formatValue = function (x) {
        let round2Decimals = x => Math.round(x * 100) / 100;
        let parts = round2Decimals(x).toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join(".");
    };

    
    let formatDate = date => date.toISOString().split('T')[0];

    //#endregion

    //#region Mediator

    let Mediator = Backbone.Model.extend({
        initialize: function (attributes, options) {
            this.set('accounts', new Accounts([]));
            this.set('currencies', new Currencies([]));
            this.set('mappings', new Mappings([]));
            this.listenTo(this.get('accounts'), 'add remove reset', this._onAccountsChange);

            chrome.storage.sync.get(['accounts', 'currencies', 'mappings'], data => this._setValues(data));

            chrome.storage.onChanged.addListener((changes, namespace) => this._onStorageChanged(changes));

            if (attributes.type === 'popup')
            {
                chrome.runtime.onMessage.addListener(request =>
                    request.brokerage
                        && this.set('brokerage', new Brokerage(request.brokerage)));

                chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                    let tab = tabs[0];
                    if (tab.url.startsWith('https://www.scotiaonline.scotiabank.com/online/views/accounts/accountDetails/'))
                        chrome.tabs.executeScript(tab.id, { file: '/contents/scotia-itrade.js' });
                    else if (tab.url.startsWith('https://my.questrade.com/trading/account/positions'))
                        chrome.tabs.executeScript(null, { file: '/libs/jquery-3.3.1.min.js' }, function () {
                            chrome.tabs.executeScript(null, { file: '/contents/questrade.js' });
                        });
                    else if (tab.url.startsWith('https://my.wealthsimple.com/app/account'))
                        chrome.tabs.executeScript(null, { file: '/libs/jquery-3.3.1.min.js' }, function () {
                            chrome.tabs.executeScript(null, { file: '/contents/wealthsimple.js' });
                        });
                });
            }
        },

        _setValues: function (data) {
            ['accounts', 'currencies', 'mappings'].forEach(n => {
                if (data[n])
                    this['_set' + this._capitalize(n)](data[n]);
            });
            this.trigger('calculate');
        },

        _onStorageChanged: function (changes) {
            ['accounts', 'currencies', 'mappings'].forEach(n => {
                if (changes[n])
                    this['_set' + this._capitalize(n)](changes[n].newValue)
            });
            this.trigger('calculate');
        },

        _capitalize: function (text) {
            return text.charAt(0).toUpperCase() + text.slice(1);
        },

        _storeCollection: function(collection, collectionName) {
            let obj = {};
            obj[collectionName] = this['_defined' + this._capitalize(collectionName)](collection);
            chrome.storage.sync.set(obj);
        },

        _addModelInCollection: function (model, collectionName, at) {
            let collection = this.get(collectionName);
            collection.add(model, { merge: true, at: at });
            this._storeCollection(collection, collectionName);
        },

        _updateModelInCollection: function(model, collectionName, changes) {
            model.set(changes);
            let collection = this.get(collectionName);
            collection.add(model, { merge: true });
            this._storeCollection(collection, collectionName);
        },

        _removeModelInCollection: function(model, collectionName) {
            let collection = this.get(collectionName);
            collection.remove(model);
            this._storeCollection(collection, collectionName);
        },

        _definedAccounts: function (accounts) {
            return accounts.toJSON();
        },

        _setAccounts: function (accounts) {
            this.get('accounts').set(accounts);
        },

        addAccount: function (account) {
            this._addModelInCollection(account, 'accounts', 0);
        },

        updateAccount: function (account, changes) {
            this._updateModelInCollection(account, 'accounts', changes);
        },

        removeAccount: function (account) {
            this._removeModelInCollection(account, 'accounts');
        },

        _definedCurrencies: function (currencies) {
            return currencies
                .toJSON()
                .filter(c => _.isNumber(c.multiplier));
        },

        _setCurrencies: function (currencies) {
            this.get('currencies').set(
                currencies.concat(
                    this._missingCurrencyCodes(currencies).map(code =>
                        new Currency({
                            id: code,
                            code: code
                        }))));
        },

        addCurrency: function (currency) {
            this._addModelInCollection(currency, 'currencies');
        },

        updateCurrency: function (currency, changes) {
            this._updateModelInCollection(currency, 'currencies', changes);
        },

        removeCurrency: function (currency) {
            this._removeModelInCollection(currency, 'currencies');
        },

        _definedMappings: function (mappings) {
            return mappings
                .toJSON()
                .filter(m => !!m.category);
        },

        _setMappings: function (mappings) {
            this.get('mappings').set(
                mappings.concat(
                    this._missingMappingSymbols(mappings).map(symbol =>
                        new Mapping({
                            id: symbol,
                            symbol: symbol
                        }))));
        },

        addMapping: function (mapping) {
            this._addModelInCollection(mapping, 'mappings');
        },

        updateMapping: function (mapping, changes) {
            this._updateModelInCollection(mapping, 'mappings', changes);
        },

        removeMapping: function (mapping) {
            this._removeModelInCollection(mapping, 'mappings');
        },

        _onAccountsChange: function() {
            this._setCurrencies(this._definedCurrencies(this.get('currencies')));
            this._setMappings(this._definedMappings(this.get('mappings')));
        },

        _portfolioCurrencyCodes: function() {
            return _.uniq(this.get('accounts')
                .toJSON()
                .flatMap(a => a.positions)
                .map(p => p.currency)
                .filter(c => !!c));
        },

        _portfolioSymbols: function() {
            return _.uniq(this.get('accounts')
                .toJSON()
                .flatMap(a => a.positions)
                .map(p => p.symbol));
        },

        _missingCurrencyCodes: function(currencies) {
            let defined = currencies.map(c => c.code);
            return this._portfolioCurrencyCodes()
                .filter(c => !defined.some(d => d == c));
        },

        _missingMappingSymbols: function(mappings) {
            let mapped = mappings.map(m => m.symbol);
            return this._portfolioSymbols()
                .filter(s => !mapped.some(m => m == s));
        },

        goToDashboard: function () {
            chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html') });
        }
    });

    //#endregion

    //#region Brokerage

    let Message = Backbone.Model.extend({
    });

    let Brokerage = Backbone.Model.extend({
        initialize: function (attributes) {
            this.set('account', new Account(attributes.account));
            this.set('message', new Message(attributes.message));
        }
    });

    //#endregion

    //#region Account

    let Account = Backbone.Model.extend({
        defaults: {
            hidden: false
        }
    });

    let Accounts = Backbone.Collection.extend({
        model: Account
    });

    //#endregion

    //#region Currency

    let Currency = Backbone.Model.extend({
    });

    let Currencies = Backbone.Collection.extend({
        model: Currency
    });

    //#endregion

    //#region Mapping

    let Mapping = Backbone.Model.extend({
    });

    let Mappings = Backbone.Collection.extend({
        model: Mapping
    });

    //#endregion

    //#region Portfolio

    let Portfolio = Backbone.Model.extend({
        defaults: {
            allocations: {
                items: [],
                total: 0
            }
        },

        initialize: function (attributes, options) {
            this.mediator = options.mediator;
            this.listenTo(options.mediator, 'calculate', this.calculate);
            this.calculate();
        },

        convertValue: function (value, currencyCode, currencies) {
            let currency = currencies.find(c => c.code.toUpperCase() === currencyCode.toUpperCase() && _.isNumber(c.multiplier)) || { multiplier: 1 };
            return value * currency.multiplier;
        },

        calculate: function () {
            let currencies = this.mediator.get('currencies').toJSON();
            let mappings = this.mediator.get('mappings').toJSON();
            let accounts = this.mediator.get('accounts').toJSON();
            let positions = accounts.flatMap(account => account.positions);

            let allocations = positions
                .map(p => ({
                    position: p,
                    mapping: mappings.find(m => m.symbol === p.symbol && !!m.category) || { category: '???', symbol: p.symbol }
                }))
                .reduce((allocations, pm) => {
                    let allocation = allocations.find(a => a.category === pm.mapping.category);
                    if (!allocation) {
                        allocation = { category: pm.mapping.category, value: 0 };
                        allocations.push(allocation);
                    }
                    allocation.value += this.convertValue(pm.position.value, pm.position.currency, currencies);
                    return allocations;
                }, []);

            let total = allocations.reduce((sum, a) => sum + a.value, 0);
            allocations = allocations
                .sort((a, b) => b.value - a.value)
                .map(a => ({ category: a.category, value: a.value, percentage: a.value / total }));

            this.set('allocations', {
                items: allocations,
                total: total
            });
        },

        getPortfolioCsv: function () {
            return Papa.unparse({
                fields: ['Brokerage', 'Account ID', 'Account Name', 'Symbol', 'Value', 'Currency', 'Currency Multiplier', 'Normalized Value', 'Category'],
                data: this.mediator.get('accounts')
                        .toJSON()
                        .flatMap(a =>
                            a.positions.map(p => {
                                let currency = this.mediator.get('currencies').toJSON().find(c => c.code === p.currency);
                                let mapping = this.mediator.get('mappings').toJSON().find(m => m.symbol === p.symbol);
                                return [
                                    a.brokerage,
                                    a.id,
                                    a.name,
                                    p.symbol,
                                    p.value,
                                    p.currency,
                                    currency && currency.multiplier,
                                    p.value * ((currency && currency.multiplier) || 1),
                                    mapping && mapping.category
                                ]
                            })
                        )
            });
        },

        getAllocationsCsv: function () {
            return Papa.unparse({
                fields: ['Category', 'Value', '% Portfolio'],
                data: this.get('allocations')
                    .items
                    .map(i =>[i.category, i.value, i.percentage])
            });
        }
    });

    //#endregion

    //#region BaseView

    let BaseView = function (options) {
        this.parent = null;
        this.children = [];
        this.options = options; // as of Backbone 1.1.0, options are no longer automatically attached: https://github.com/jashkenas/backbone/commit/a22cbc7f36f0f7bd2b1d6f62e353e95deb4eda3a
        Backbone.View.apply(this, [options]);
    };

    _.extend(BaseView.prototype, Backbone.View.prototype, {
        addChildren: function (arg) {
            let children, that = this;

            if (_.isArray(arg)) {
                children = arg;
            } else {
                children = _.toArray(arguments);
            }

            _.each(children, function (child) {
                that.children.push(child);
                child.parent = that;
            });

            if (children.length === 1)
                return children[0];
            else
                return children;
        },

        disposeChildren: function (arg) {
            if (!arg)
                return;

            let children = _.isArray(arg) ? arg : _.toArray(arguments);

            _.each(children, function (child) {
                child.dispose();
            });
        },

        disposeAllChildren: function () {
            // clone first because child is going to reach up into parent (this) and call _removeChild()
            let clonedChildren = this.children.slice(0);
            _.each(clonedChildren, function (child) {
                child.dispose();
            });
        },

        dispose: function () {
            this.disposeAllChildren();
            this.remove();
            this._removeFromParent();
        },

        _removeFromParent: function () {
            if (this.parent) this.parent._removeChild(this);
        },

        _removeChild: function (child) {
            let index = _.indexOf(this.children, child);
            if (index !== -1)
                this.children.splice(index, 1);
        }
    });

    BaseView.extend = Backbone.View.extend;

    //#endregion

    //#region PopupView

    let PopupView = BaseView.extend({
        template: Handlebars.templates.popup,

        events: {
            'click [data-action="go-dashboard"]': 'onGoDashboardClick'
        },

        onGoDashboardClick: function () {
            this.model.goToDashboard();
        },

        render: function () {
            this.$el.html(this.template());

            this.$('[data-outlet="brokerage"]').append(
              this.addChildren(
                new BrokerageView({
                    model: this.model
                })
              )
              .render().el
            );

            this.$('[data-outlet="accounts"]').append(
              this.addChildren(
                new AccountsView({
                    collection: this.model.get('accounts'),
                    mediator: this.model
                })
              )
              .render().el
            );

            return this;
        }
    });

    //#endregion

    //#region BrokerageView

    let BrokerageView = BaseView.extend({
        template: Handlebars.templates.brokerage,

        initialize: function () {
            this.listenTo(this.model, 'change:brokerage', this.render);
            this.listenTo(this.model.get('accounts'), 'add remove reset', this.render);
        },

        events: {
            'click [data-action="add"]': 'onAddClick'
        },

        onAddClick: function (e) {
            let brokerage = this.model.get('brokerage');
            let account = this.model.get('accounts').get(brokerage.get('account').id);
            if (account)
                this.model.updateAccount(account, brokerage.get('account').toJSON());
            else
                this.model.addAccount(new Account(brokerage.get('account').toJSON()));
        },

        render: function () {
            this.disposeAllChildren();

            let brokerage = this.model.get('brokerage');
            this.$el.html(this.template({
                info: brokerage && brokerage.get('message').get('info'),
                error: brokerage && brokerage.get('message').get('error'),
                found: !!brokerage,
                exists: !!this.model.get('accounts').get(brokerage && brokerage.get('account') && brokerage.get('account').id)
            }));

            if (brokerage)
                this.$('[data-outlet="account"]').append(
                    this.addChildren(
                        new AccountView({ model: brokerage.get('account') })
                    )
                    .render().el
                );

            return this;
        }
    });

    //#endregion

    //#region DashboardView

    let DashboardView = BaseView.extend({
        template: Handlebars.templates.dashboard,

        render: function () {
            this.$el.html(this.template());

            this.$('[data-outlet="accounts"]').append(
              this.addChildren(
                new AccountsView({
                    collection: this.model.get('accounts'),
                    mediator: this.model
                })
              )
              .render().el
            );

            this.$('[data-outlet="currencies"]').append(
              this.addChildren(
                new CurrenciesView({
                    collection: this.model.get('currencies'),
                    mediator: this.model
                })
              )
              .render().el
            );

            this.$('[data-outlet="mappings"]').append(
              this.addChildren(
                new MappingsView({
                    collection: this.model.get('mappings'),
                    mediator: this.model
                })
              )
              .render().el
            );

            let portfolio = new Portfolio(null, { mediator: this.model });
            this.$('[data-outlet="portfolio"]').append(
              this.addChildren(
                new PortfolioView({
                    model: portfolio
                })
              )
              .render().el
            );

            this.$('[data-outlet="download"]').append(
              this.addChildren(
                new DownloadView({
                    model: portfolio
                })
              )
              .render().el
            );

            return this;
        }
    });

    //#endregion

    //#region AccountsView

    let AccountsView = BaseView.extend({
        template: Handlebars.templates.accounts,

        initialize: function() {
            this.listenTo(this.collection, 'add remove reset sort', this.render);
        },

        render: function () {
            this.disposeAllChildren();
            this.$el.html(this.template());

            if (this.collection.length) {
                this.$('[data-outlet="account"]').empty();
                this.collection.each(account => {
                    this.$('[data-outlet="account"]').append(
                        this.addChildren(
                            new AccountView({
                                model: account,
                                actionable: true,
                                mediator: this.options.mediator
                            })
                        )
                        .render().el
                    );
                });
            }

            return this;
        }
    });

    //#endregion

    //#region AccountView

    let AccountView = BaseView.extend({
        template: Handlebars.templates.account,

        initialize: function () {
            this.listenTo(this.model, 'change', this.onModelChange);
        },

        events: {
            'click [data-action="remove"]': 'onRemoveClick',
            'click [data-action="toggle"]': 'onToggleClick'
        },

        onRemoveClick: function (e) {
            e.preventDefault();
            this.options.mediator.removeAccount(this.model);
        },

        onToggleClick: function (e) {
            e.preventDefault();
            this.options.mediator.updateAccount(this.model, { hidden: !this.model.get('hidden') });
        },

        onModelChange: function (model) {
            let keys = Object.keys(model.changed);
            if (keys.length === 1 && keys.includes('hidden'))
            {
                if (this.model.get('hidden'))
                    this.$('[data-element="positions"]').slideUp();
                else
                    this.$('[data-element="positions"]').slideDown();
                this.toggleChevron();
            } else {
                this.render();
            }
        },

        toggleChevron: function () {
            if (this.model.get('hidden'))
                this.$('.fa-chevron-down')
                    .removeClass('fa-chevron-down')
                    .addClass('fa-chevron-up');
            else
                this.$('.fa-chevron-up')
                    .removeClass('fa-chevron-up')
                    .addClass('fa-chevron-down');
        },

        toggle: function () {
            this.$('[data-element="positions"]').toggle(!this.model.get('hidden'));
            this.toggleChevron();
        },

        render: function () {
            let json = this.model.toJSON();
            json.positions = json.positions.map(p => ({
                symbol: p.symbol,
                value: formatValue(p.value),
                currency: p.currency
            }));
            this.$el.html(this.template({
                actionable: this.options.actionable,
                account: json
            }));
            this.toggle();
            return this;
        }
    });

    //#endregion

    //#region ItemView

    let ItemView = BaseView.extend({
        tagName: 'tr',

        initialize: function () {
            this.state = 'idle';
            this.listenTo(this.model, 'change', this.render);
        },

        events: {
            'click [data-action="edit"]': 'onEditClick',
            'submit [data-action="submit"]': 'onSubmit',
            'click [data-action="remove"]': 'onRemoveClick',
            'input input': 'onInput'
        },

        onInput: function (e) {
            this.changeButtonState();
        },

        changeButtonState: function() {
            this.$('button').prop('disabled', !this.$('input').val().length);
        },

        onEditClick: function () {
            this.renderForm();
        },

        onSubmit: function (e) {
            let isNew = this.isNew();
            e.preventDefault();
            this.editModel();
            if (isNew)
                this.options.parent.trigger('add-new');
            else
                this.render(); // just in case there's no change, we still want to trigger a render
        },

        onRemoveClick: function (e) {
            e.preventDefault();
            this.removeModel();
        },

        renderForm: function() {
            this.$el.html(this.templateForm(this.model.toJSON()));
            this.$('input').eq(1).focus();
            this.$('button').prop('disabled', !this.$('input').val().length);
        },

        renderDetails() {
            this.$el.html(this.template(this.model.toJSON()));
        },

        render: function () {
            if (this.isNew())
                this.renderForm();
            else
                this.renderDetails();

            return this;
        }
    });

    //#endregion

    //#region CurrencyView

    let CurrencyView = ItemView.extend({
        template: Handlebars.templates.currency,
        templateForm: Handlebars.templates.currencyForm,

        editModel: function () {
            this.options.mediator.updateCurrency(this.model, {
                multiplier: parseValue(this.$('[name="multiplier"]').val())
            });
        },

        isNew: function() {
            return !_.isNumber(this.model.get('multiplier'));
        },

        removeModel: function (e) {
            this.options.mediator.removeCurrency(this.model);
        }
    });

    //#endregion

    //#region MappingView

    let MappingView = ItemView.extend({
        template: Handlebars.templates.mapping,
        templateForm: Handlebars.templates.mappingForm,

        editModel: function () {
            this.options.mediator.updateMapping(this.model, {
                category: this.$('[name="category"]').val()
            });
        },

        isNew: function () {
            return !this.model.get('category');
        },

        removeModel: function (e) {
            this.options.mediator.removeMapping(this.model);
        }
    });

    //#endregion

    //#region ItemsView

    let ItemsView = BaseView.extend({
        initialize: function () {
            this.listenTo(this.collection, 'add remove reset sort', this.render);
            this.listenTo(this, 'add-new', this.onAddNew);
        },

        onAddNew: function() {
            this.$('input').first().focus();
        },

        render: function () {
            this.$el.html(this.template(this.collection.toJSON()));

            this.collection.forEach(model => {
                this.$('[data-outlet="list"]').append(
                    this.addChildren(
                        new this.modelView({
                            model: model,
                            mediator: this.options.mediator,
                            parent: this
                        })
                    )
                    .render().el
                );
            });

            return this;
        }
    });

    //#endregion

    //#region CurrenciesView

    let CurrenciesView = ItemsView.extend({
        template: Handlebars.templates.currencies,
        templateForm: Handlebars.templates.currencyForm,
        templateAddButton: Handlebars.templates.currenciesAddButton,

        modelView: CurrencyView,

        addModel: function (e) {
            this.options.mediator.addCurrency(new Currency({
                id: this.$('[name="code"]').val().toUpperCase(),
                code: this.$('[name="code"]').val().toUpperCase(),
                multiplier: parseValue(this.$('[name="multiplier"]').val())
            }));
        }
    });

    //#endregion

    //#region MappingsView

    let MappingsView = ItemsView.extend({
        template: Handlebars.templates.mappings,
        templateForm: Handlebars.templates.mappingForm,
        templateAddButton: Handlebars.templates.mappingsAddButton,

        modelView: MappingView,

        addModel: function (e) {
            this.options.mediator.addMapping(new Mapping({
                id: this.$('[name="symbol"]').val().toUpperCase(),
                symbol: this.$('[name="symbol"]').val().toUpperCase(),
                category: this.$('[name="category"]').val()
            }));
        }
    });

    //#endregion

    //#region PortfolioView

    let PortfolioView = BaseView.extend({
        template: Handlebars.templates.portfolio,

        initialize: function () {
            this.listenTo(this.model, 'change:allocations', this.render);
        },
        
        render: function () {
            let a = this.model.get('allocations');
            this.$el.html(this.template({
                total: formatValue(a.total),
                items: a.items.map(i => ({
                    category: i.category,
                    value: formatValue(i.value),
                    percentage: (i.percentage * 100).toFixed(1)
                }))
            }));
            return this;
        }
    });
    
    //#endregion

    //#region DownloadView

    let DownloadView = BaseView.extend({
        template: Handlebars.templates.download,

        events: {
            'click [data-action="download-portfolio"]': 'onDownloadPortfolioClick',
            'click [data-action="download-allocations"]': 'onDownloadAllocationsClick'
        },

        onDownloadPortfolioClick: function() {
            let blob = new Blob([this.model.getPortfolioCsv()], { type: 'text/csv;charset=utf-8;' });
            let url = URL.createObjectURL(blob);
            chrome.downloads.download({
                url: url,
                filename: `${formatDate(new Date())} portfolio.csv`,
                saveAs: true
            });
        },

        onDownloadAllocationsClick: function() {
            let blob = new Blob([this.model.getAllocationsCsv()], { type: 'text/csv;charset=utf-8;' });
            let url = URL.createObjectURL(blob);
            chrome.downloads.download({
                url: url,
                filename: `${formatDate(new Date())} allocations.csv`,
                saveAs: true
            });
        },

        render: function () {
            this.$el.html(this.template());
            return this;
        }
    });

    //#endregion

    return {
        popup: function () {
            $('[data-outlet="popup"]').append(new PopupView({
                model: new Mediator({
                    type: 'popup'
                })
            }).render().el);
        },
        dashboard: function () {
            $('[data-outlet="dashboard"]').append(new DashboardView({
                model: new Mediator({
                    type: 'dashboard'
                })
            }).render().el);
        }
    };

}());
var PINSIGHT = window.PINSIGHT || {};

PINSIGHT.console = (function () {

    // HELPERS

    var parseValue = text => text && parseFloat(text.replace(/,/g, ''));

    // https://stackoverflow.com/a/2901298/188740
    var formatValue = function (x) {
        var round2Decimals = x => Math.round(x * 100) / 100;
        var parts = round2Decimals(x).toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join(".");
    };

    // MODELS

    var Mediator = Backbone.Model.extend({
        initialize: function (attributes, options) {
            this.set('accounts', new Accounts([]));
            this.set('currencies', new Currencies([]));
            this.set('mappings', new Mappings([]));

            chrome.storage.sync.get(['accounts', 'currencies', 'mappings'], data => this._setValues(data));

            chrome.storage.onChanged.addListener((changes, namespace) =>
                this._setValues(['accounts', 'currencies', 'mappings'].reduce((accumulator, n) => {
                    accumulator[n] = changes[n] && changes[n].newValue;
                    return accumulator;
                }, {}))
            );

            if (attributes.type === 'popup')
            {
                chrome.runtime.onMessage.addListener(request =>
                    request.brokerage
                        && this.set('brokerage', new Account(request.brokerage)));

                chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                    var tab = tabs[0];
                    if (tab.url.startsWith('https://www.scotiaonline.scotiabank.com/online/views/accounts/accountDetails/'))
                        chrome.tabs.executeScript(tab.id, { file: '/contents/scotia-itrade.js' });
                    else if (tab.url.startsWith('https://my.questrade.com/trading/account/positions'))
                        chrome.tabs.executeScript(null, { file: "/libs/jquery-3.3.1.min.js" }, function () {
                            chrome.tabs.executeScript(null, { file: "/contents/questrade.js" });
                        });
                });
            }
        },

        _storeCollection: function(collection, collectionName) {
            var obj = {};
            obj[collectionName] = collection.toJSON();
            chrome.storage.sync.set(obj);
        },

        _storeModel: function(model, modelName) {
            var obj = {};
            obj[modelName] = model.toJSON();
            chrome.storage.sync.set(obj);
        },

        _addModelInCollection: function (model, collectionName, at) {
            // clone so that event listeners on collections don't act on this
            var collection = this.get(collectionName).clone();
            collection.add(model, { merge: true, at: at });
            this._storeCollection(collection, collectionName);
        },

        _updateModelInCollection: function(model, collectionName, changes) {
            // clone so that event listeners on collections don't act on this
            var clone = model.clone();
            clone.set(changes);
            var collection = this.get(collectionName).clone();
            collection.add(clone, { merge: true });
            this._storeCollection(collection, collectionName);
        },

        _removeModelInCollection: function(model, collectionName) {
            // clone so that event listeners on collections don't act on this
            var collection = this.get(collectionName).clone();
            collection.remove(model);
            this._storeCollection(collection, collectionName);
        },

        _updateModel: function (model, modelName, changes) {
            // clone so that event listeners on model don't act on this 
            var clone = model.clone();
            clone.set(changes);
            this._storeModel(clone, modelName);
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

        addCurrency: function (currency) {
            this._addModelInCollection(currency, 'currencies');
        },

        removeCurrency: function (currency) {
            this._removeModelInCollection(currency, 'currencies');
        },

        addMapping: function (mapping) {
            this._addModelInCollection(mapping, 'mappings');
        },

        removeMapping: function (mapping) {
            this._removeModelInCollection(mapping, 'mappings');
        },

        _setValues: function (data) {
            ['accounts', 'currencies', 'mappings'].forEach(n => data[n] && this.get(n).set(data[n]));
            this.trigger('calculate');
        },

        goToDashboard: function () {
            chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html') });
        }
    });

    var Account = Backbone.Model.extend({
        defaults: {
            hidden: false
        }
    });

    var Accounts = Backbone.Collection.extend({
        model: Account
    });

    var Currency = Backbone.Model.extend({
    });

    var Currencies = Backbone.Collection.extend({
        model: Currency
    });

    var Mapping = Backbone.Model.extend({
    });

    var Mappings = Backbone.Collection.extend({
        model: Mapping
    });

    var Portfolio = Backbone.Model.extend({
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

        convertValue: function (value, currency, currencies) {
            var currency = currencies.find(c => c.code.toUpperCase() == currency.toUpperCase()) || { multiplier: 1 };
            return value * currency.multiplier;
        },

        calculate: function () {
            var currencies = this.mediator.get('currencies').toJSON();
            var mappings = this.mediator.get('mappings').toJSON();
            var accounts = this.mediator.get('accounts').toJSON();
            var positions = accounts.flatMap(account => account.positions);

            var allocations = positions
                .map(p => ({
                    position: p,
                    mapping: mappings.find(m => m.symbol === p.symbol) || { category: 'Uncategorized', symbol: p.symbol }
                }))
                .reduce((allocations, pm) => {
                    var allocation = allocations.find(a => a.category === pm.mapping.category);
                    if (!allocation) {
                        allocation = { category: pm.mapping.category, value: 0 };
                        allocations.push(allocation);
                    }
                    allocation.value += this.convertValue(pm.position.value, pm.position.currency, currencies);
                    return allocations;
                }, []);

            var total = allocations.reduce((sum, a) => sum + a.value, 0);
            allocations = allocations
                .sort((a, b) => b.value - a.value)
                .map(a => ({ category: a.category, value: formatValue(a.value), percentage: ((a.value / total) * 100).toFixed(1) }));

            this.set('allocations', {
                items: allocations,
                total: formatValue(total)
            });
        }
    });

    // VIEWS

    var BaseView = function (options) {
        this.parent = null;
        this.children = [];
        this.options = options; // as of Backbone 1.1.0, options are no longer automatically attached: https://github.com/jashkenas/backbone/commit/a22cbc7f36f0f7bd2b1d6f62e353e95deb4eda3a
        Backbone.View.apply(this, [options]);
    };

    _.extend(BaseView.prototype, Backbone.View.prototype, {
        addChildren: function (arg) {
            var children, that = this;

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

            var that = this;
            var children = _.isArray(arg) ? arg : _.toArray(arguments);

            _.each(children, function (child) {
                child.dispose();
            });
        },

        disposeAllChildren: function () {
            // clone first because child is going to reach up into parent (this) and call _removeChild()
            var clonedChildren = this.children.slice(0);
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
            var index = _.indexOf(this.children, child);
            if (index !== -1)
                this.children.splice(index, 1);
        }
    });

    BaseView.extend = Backbone.View.extend;

    // Popup views

    var PopupView = BaseView.extend({
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

    var BrokerageView = BaseView.extend({
        template: Handlebars.templates.brokerage,

        initialize: function () {
            this.listenTo(this.model, 'change:brokerage', this.render);
            this.listenTo(this.model.get('accounts'), 'add remove reset', this.render);
        },

        events: {
            'click [data-action="add"]': 'onAddClick'
        },

        onAddClick: function (e) {
            this.model.addAccount(this.model.get('brokerage'));
        },

        render: function () {
            this.disposeAllChildren();
            this.$el.html(this.template({
                found: !!this.model.get('brokerage'),
                exists: !!this.model.get('accounts').get(this.model.get('brokerage') && this.model.get('brokerage').id)
            }));

            if (this.model.get('brokerage'))
                this.$('[data-outlet="account"]').append(
                    this.addChildren(
                        new AccountView({ model: this.model.get('brokerage') })
                    )
                    .render().el
                );

            return this;
        }
    });

    // Dashboard views

    var DashboardView = BaseView.extend({
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

            this.$('[data-outlet="portfolio"]').append(
              this.addChildren(
                new PortfolioView({
                    model: new Portfolio(null, { mediator: this.model })
                })
              )
              .render().el
            );

            return this;
        }
    });

    // Shared views

    var AccountsView = BaseView.extend({
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

    var AccountView = BaseView.extend({
        template: Handlebars.templates.account,

        initialize: function () {
            this.listenTo(this.model, 'change:hidden', this.onHiddenChange);
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

        onHiddenChange: function () {
            if (this.model.get('hidden'))
                this.$('[data-element="positions"]').slideUp();
            else
                this.$('[data-element="positions"]').slideDown();

            this.toggleChevron();
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
            var json = this.model.toJSON();
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

    var ItemView = BaseView.extend({
        tagName: 'tr',

        initialize: function () {
            this.listenTo(this.model, 'change', this.render);
        },

        events: {
            'click [data-action="remove"]': 'onRemoveClick'
        },

        onRemoveClick: function (e) {
            e.preventDefault();
            this.removeModel();
        },

        render: function () {
            this.$el.html(this.template(this.model.toJSON()));

            return this;
        }
    });

    var CurrencyView = ItemView.extend({
        template: Handlebars.templates.currency,

        removeModel: function (e) {
            this.options.mediator.removeCurrency(this.model);
        }
    });

    var MappingView = ItemView.extend({
        template: Handlebars.templates.mapping,

        removeModel: function (e) {
            this.options.mediator.removeMapping(this.model);
        }
    });

    var ItemsView = BaseView.extend({
        initialize: function () {
            this.listenTo(this.collection, 'add remove reset sort', this.render);
        },

        events: {
            'click [data-action="cancel"]': 'onCancelClick',
            'click [data-action="add"]': 'onAddClick',
            'submit [data-action="submit"]': 'onSubmit'
        },

        onCancelClick: function (e) {
            e.preventDefault();
            this.renderAddButton();
        },

        onAddClick: function () {
            this.renderAddForm();
        },

        onSubmit: function (e) {
            e.preventDefault();
            this.addModel();
            this.renderAddButton();
        },

        renderAddButton: function () {
            this.$('[data-outlet="form"]').html(this.templateAddButton());
        },

        renderAddForm: function () {
            this.$('[data-outlet="form"]').html(this.templateAddForm());
            this.$('input').first().focus();
        },

        render: function () {
            this.$el.html(this.template(this.collection.toJSON()));
            this.renderAddButton();

            this.collection.forEach(model => {
                this.$('[data-outlet="list"]').append(
                    this.addChildren(
                        new this.modelView({
                            model: model,
                            mediator: this.options.mediator
                        })
                    )
                    .render().el
                );
            });

            return this;
        }
    });

    var CurrenciesView = ItemsView.extend({
        template: Handlebars.templates.currencies,
        templateAddButton: Handlebars.templates.currenciesAddButton,
        templateAddForm: Handlebars.templates.currenciesAddForm,

        modelView: CurrencyView,

        addModel: function (e) {
            this.options.mediator.addCurrency(new Currency({
                code: this.$('[name="code"]').val(),
                multiplier: parseValue(this.$('[name="multiplier"]').val())
            }));
        }
    });

    var MappingsView = ItemsView.extend({
        template: Handlebars.templates.mappings,
        templateAddButton: Handlebars.templates.mappingsAddButton,
        templateAddForm: Handlebars.templates.mappingsAddForm,

        modelView: MappingView,

        addModel: function (e) {
            this.options.mediator.addMapping(new Mapping({
                symbol: this.$('[name="symbol"]').val(),
                category: this.$('[name="category"]').val()
            }));
        }
    });

    var PortfolioView = BaseView.extend({
        template: Handlebars.templates.portfolio,

        initialize: function () {
            this.listenTo(this.model, 'change:allocations', this.render);
        },
        
        render: function () {
            this.$el.html(this.template(this.model.get('allocations')));
            return this;
        }
    });
    
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
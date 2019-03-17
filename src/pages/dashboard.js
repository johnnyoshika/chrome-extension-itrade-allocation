(function () {

    // HELPERS

    // https://stackoverflow.com/a/2901298/188740
    var formatValue = function (x) {
        var round2Decimals = x => Math.round(x * 100) / 100;
        var parts = round2Decimals(x).toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join(".");
    };

    // MODELS

    var Mediator = Backbone.Model.extend({
        initialize: function () {
            this.set('accounts', new Accounts([]));
            this.set('currency', new Currency([]));
            this.set('conversions', new Conversions([]));
            this.set('mappings', new Mappings([]));

            chrome.storage.sync.get(['accounts', 'currency', 'conversions', 'mappings'], data => this._setValues(data));

            chrome.storage.onChanged.addListener((changes, namespace) =>
                this._setValues(['accounts', 'currency', 'conversions', 'mappings'].reduce((accumulator, n) => {
                    accumulator[n] = changes[n] && changes[n].newValue;
                    return accumulator;
                }, {}))
            );
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

        _addModelInCollection: function (model, collectionName) {
            // clone so that event listeners on collections don't act on this
            var collection = this.get(collectionName).clone();
            collection.add(model, { merge: true });
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

        updateAccount: function (account, changes) {
            this._updateModelInCollection(account, 'accounts', changes);
        },

        removeAccount: function (account) {
            this._removeModelInCollection(account, 'accounts');
        },

        updateCurrency: function (currency, changes) {
            this._updateModel(currency, 'currency', changes);
        },

        addConversion: function (conversion) {
            this._addModelInCollection(conversion, 'conversions');
        },

        removeConversion: function (conversion) {
            this._removeModelInCollection(conversion, 'conversions');
        },

        addMapping: function (mapping) {
            this._addModelInCollection(mapping, 'mappings');
        },

        removeMapping: function (mapping) {
            this._removeModelInCollection(mapping, 'mappings');
        },

        _setValues: function (data) {
            ['accounts', 'currency', 'conversions', 'mappings'].forEach(n => data[n] && this.get(n).set(data[n]));
            this.trigger('calculate');
        }
    });

    var Account = Backbone.Model.extend({
    });

    var Accounts = Backbone.Collection.extend({
        model: Account
    });

    var Currency = Backbone.Model.extend({
        initialize: function (model, options) {
            this.set('conversions', new Conversions(model.conversions));
            this.get('conversions').on('all', this.onConversionsChange, this);
        },

        onConversionsChange: function (event, obj) {
            this.trigger(event, obj);
        }
    });

    var Conversion = Backbone.Model.extend({
    });

    var Conversions = Backbone.Collection.extend({
        model: Conversion
    });

    var Mapping = Backbone.Model.extend({
    });

    var Mappings = Backbone.Collection.extend({
        model: Mapping
    });

    var Portfolio = Backbone.Model.extend({
        defaults: {
            allocations: []
        },

        initialize: function (attributes, options) {
            this.mediator = options.mediator;
            this.listenTo(options.mediator, 'calculate', this.calculate);
            this.calculate();
        },

        convertValue: function (value, currency, conversions) {
            var conversion = conversions.find(c => c.symbol == currency) || { value: 1 };
            return value / conversion.value;
        },

        calculate: function () {
            var baseCurrency = this.mediator.get('currency').get('base');
            var conversions = this.mediator.get('conversions').toJSON();
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
                    allocation.value += this.convertValue(pm.position.value, pm.position.currency, conversions);
                    return allocations;
                }, []);

            var total = allocations.reduce((sum, a) => sum + a.value, 0);

            this.set('allocations', allocations
                .sort((a, b) => b.value - a.value)
                .map(a => ({ category: a.category, value: formatValue(a.value), percentage: ((a.value / total) * 100).toFixed(1) })));
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

            this.$('[data-outlet="currency"]').append(
              this.addChildren(
                new CurrencyView({
                    model: this.model.get('currency'),
                    conversions: this.model.get('conversions'),
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
            this.$el.html(this.template(json));
            this.toggle();
            return this;
        }
    });

    var CurrencyView = BaseView.extend({
        template: Handlebars.templates.currency,

        initialize: function () {
            this.listenTo(this.model, 'change', this.render);
        },

        render: function () {
            this.$el.html(this.template(this.model.toJSON()));

            this.$('[data-outlet="conversions"]').append(
                this.addChildren(
                    new ConversionsView({ collection: this.options.conversions })
                )
                .render().el
            );

            return this;
        }
    });

    var ConversionsView = BaseView.extend({
        template: Handlebars.templates.conversions,

        initialize: function () {
            this.listenTo(this.collection, 'add remove reset sort', this.render);
        },

        render: function () {
            this.$el.html(this.template());

            this.collection.forEach(conversion => {
                this.$('[data-outlet="conversion"]').append(
                    this.addChildren(
                        new ConversionView({ model: conversion })
                    )
                    .render().el
                );
            });

            return this;
        }
    });

    var ConversionView = BaseView.extend({
        template: Handlebars.templates.conversion,

        tagName: 'tr',

        initialize: function () {
            this.listenTo(this.model, 'change', this.render);
        },

        render: function () {
            this.$el.html(this.template(this.model.toJSON()));

            return this;
        }
    });

    var MappingsView = BaseView.extend({
        template: Handlebars.templates.mappings,

        initialize: function () {
            this.listenTo(this.collection, 'add remove reset sort', this.render);
        },

        render: function () {
            this.$el.html(this.template());

            this.collection.forEach(mapping => {
                this.$('[data-outlet="mapping"]').append(
                    this.addChildren(
                        new MappingView({ model: mapping })
                    )
                    .render().el
                );
            });

            return this;
        }
    });

    var MappingView = BaseView.extend({
        template: Handlebars.templates.mapping,

        initialize: function () {
            this.listenTo(this.model, 'change', this.render);
        },

        tagName: 'tr',

        render: function () {
            this.$el.html(this.template(this.model.toJSON()));

            return this;
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
    
    // RUN
    
    $('[data-outlet="dashboard"]').append(new DashboardView({
        model: new Mediator()
    }).render().el);

}());
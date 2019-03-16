var PINSIGHT = window.PINSIGHT || {};

PINSIGHT.dashboard = (function () {

    // MODELS

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

        initialize: function (model, options) {
            this.calculate();
            model.accounts.on('all', this.calculate, this);
            model.currency.on('all', this.calculate, this);
            model.mappings.on('all', this.calculate, this);
        },

        // https://stackoverflow.com/a/2901298/188740
        formatValue: function (x) {
            var round2Decimals = x => Math.round(x * 100) / 100;
            var parts = round2Decimals(x).toString().split(".");
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            return parts.join(".");
        },

        convertValue: function (value, currency, conversions) {
            var conversion = conversions.find(c => c.symbol == currency) || { value: 1 };
            return value / conversion.value;
        },

        calculate: function () {
            var baseCurrency = this.get('currency').get('base');
            var conversions = this.get('currency').get('conversions').toJSON();
            var mappings = this.get('mappings').toJSON();
            var accounts = this.get('accounts').toJSON();
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
                .map(a => ({ category: a.category, value: this.formatValue(a.value), percentage: ((a.value / total) * 100).toFixed(1) })));
        }
    });

    // VIEWS

    var BaseView = function (options) {
        this.parent = null;
        this.children = [];
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
                new AccountsView({ collection: this.model.accounts })
              )
              .render().el
            );

            this.$('[data-outlet="currency"]').append(
              this.addChildren(
                new CurrencyView({ model: this.model.currency })
              )
              .render().el
            );

            this.$('[data-outlet="mappings"]').append(
              this.addChildren(
                new MappingsView({ collection: this.model.mappings })
              )
              .render().el
            );

            this.$('[data-outlet="portfolio"]').append(
              this.addChildren(
                new PortfolioView({
                    model: new Portfolio(this.model)
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

            this.collection.each(account => {
                this.$('[data-outlet="account"]').append(
                    this.addChildren(
                        new AccountView({ model: account })
                    )
                    .render().el
                );
            });

            return this;
        }
    });

    var AccountView = BaseView.extend({
        template: Handlebars.templates.account,

        initialize: function () {
            this.listenTo(this.model, 'change', this.render);
        },

        render: function () {
            this.$el.html(this.template(this.model.toJSON()));

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
                    new ConversionsView({ collection: this.model.get('conversions') })
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
    
    // TEST

    var data = {
        accounts: [{
            id: '1',
            name: 'RRSP Jane',
            positions: [
              { symbol: 'VFV', value: 123, currency: 'USD' },
              { symbol: 'XIC', value: 123, currency: 'CAD' }
            ]
        },
        {
            id: '2',
            name: 'TFSA Jane',
            positions: [
              { symbol: 'VFV', value: 123, currency: 'USD' },
              { symbol: 'XIC', value: 123, currency: 'CAD' }
            ]
        }],

        currency: {
            base: 'CAD',
            conversions: [
                { symbol: 'USD', value: 0.75 }
            ]
        },

        mappings: [
          { symbol: 'XIC', category: 'CAD' },
          { symbol: 'VFV', category: 'US' }
        ]
    };

    // RUN
    
    var model = {
        accounts: new Accounts(data.accounts),
        currency: new Currency(data.currency),
        mappings: new Mappings(data.mappings)
    };
    
    $('[data-outlet="dashboard"]').append(new DashboardView({
        model: model
    }).render().el);

    // DEBUG
    //window.data = model;
}());
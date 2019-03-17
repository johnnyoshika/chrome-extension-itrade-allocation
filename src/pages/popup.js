var PINSIGHT = window.PINSIGHT || {};

PINSIGHT.popup = (function () {

    // MODELS

    var Popup = Backbone.Model.extend({
    });

    var Account = Backbone.Model.extend({
    });

    var Accounts = Backbone.Collection.extend({
        model: Account
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

    var PopupView = BaseView.extend({
        template: Handlebars.templates.popup,

        render: function () {
            this.$el.html(this.template());

            this.$('[data-outlet="page"]').append(
              this.addChildren(
                new PageView({
                    model: this.model
                })
              )
              .render().el
            );

            this.$('[data-outlet="accounts"]').append(
              this.addChildren(
                new AccountsView({ collection: this.model.get('accounts') })
              )
              .render().el
            );

            return this;
        }
    });

    var PageView = BaseView.extend({
        template: Handlebars.templates.page,

        initialize: function () {
            this.listenTo(this.model, 'change:page', this.render);
        },

        render: function () {
            this.disposeAllChildren();
            this.$el.html(this.template({ found: !!this.model.get('page') }));

            if (this.model.get('page'))
                this.$('[data-outlet="account"]').append(
                    this.addChildren(
                        new AccountView({ model: this.model.get('page') })
                    )
                    .render().el
                );

            return this;
        }
    });

    var AccountsView = BaseView.extend({
        template: Handlebars.templates.accounts,

        initialize: function () {
            this.listenTo(this.collection, 'add remove reset sort', this.render);
        },

        render: function () {
            this.disposeAllChildren();
            this.$el.html(this.template());

            this.collection.each(account => {
                this.$('[data-outlet="account"]').append(
                    this.addChildren(
                        new AccountView({
                            model: account,
                            actionable: true
                        })
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
            this.$el.html(this.template({
                actionable: this.options.actionable,
                account: this.model.toJSON()
            }));

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
        }]
    };

    // RUN

    var popup = new Popup({
        page: null,
        accounts: new Accounts(data.accounts)
    });

    $('[data-outlet="popup"]').append(new PopupView({
        model: popup
    }).render().el);

    chrome.runtime.onMessage.addListener(request => request.page && popup.set('page', new Account(request.page)));

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        var tab = tabs[0];
        if (tab.url.startsWith('https://www.scotiaonline.scotiabank.com/online/views/accounts/accountDetails/'))
            chrome.tabs.executeScript(tab.id, { file: '/contents/scotia-itrade.js' });
    });

    // DEBUG
    window.data = popup;
}());

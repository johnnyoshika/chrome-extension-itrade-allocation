(function () {

    // MODELS

    var Mediator = Backbone.Model.extend({
        initialize: function () {
            this.set('accounts', new Accounts([]));

            chrome.storage.sync.get('accounts', data =>
                (data.accounts = data.accounts || []) && this.setAccounts(data.accounts));

            chrome.storage.onChanged.addListener((changes, namespace) =>
                changes.accounts && this.setAccounts(changes.accounts.newValue));

            chrome.runtime.onMessage.addListener(request =>
                request.page
                    && this.set('page', new Account(request.page)));

            chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                var tab = tabs[0];
                if (tab.url.startsWith('https://www.scotiaonline.scotiabank.com/online/views/accounts/accountDetails/'))
                    chrome.tabs.executeScript(tab.id, { file: '/contents/scotia-itrade.js' });
            });
        },

        addAccount: function (account) {
            // clone so that event listeners on accounts don't act on this 
            var accounts = this.get('accounts').clone();
            accounts.add(account, { merge: true, at: 0 });
            chrome.storage.sync.set({
                accounts: accounts.toJSON()
            });
        },

        removeAccount: function (account) {
            // clone so that event listeners on accounts don't act on this 
            var accounts = this.get('accounts').clone();
            accounts.remove(account);
            chrome.storage.sync.set({
                accounts: accounts.toJSON()
            });
        },

        setAccounts: function (accounts) {
            this.get('accounts').set(accounts);
        }
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

    var PageView = BaseView.extend({
        template: Handlebars.templates.page,

        initialize: function () {
            this.listenTo(this.model, 'change:page', this.render);
            this.listenTo(this.model.get('accounts'), 'add remove reset', this.render);
        },

        events: {
            'click [data-action="add"]': 'onAddClick'
        },

        onAddClick: function (e) {
            this.model.addAccount(this.model.get('page'));
        },

        render: function () {
            this.disposeAllChildren();
            this.$el.html(this.template({
                found: !!this.model.get('page'),
                exists: !!this.model.get('accounts').get(this.model.get('page') && this.model.get('page').id)
            }));

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

        initialize: function (options) {
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
            this.listenTo(this.model, 'change', this.render);
        },

        events: {
            'click [data-action="remove"]': 'onRemoveClick'
        },

        onRemoveClick: function (e) {
            e.preventDefault();
            this.options.mediator.removeAccount(this.model);
        },

        render: function () {
            this.$el.html(this.template({
                actionable: this.options.actionable,
                account: this.model.toJSON()
            }));

            return this;
        }
    });

    // RUN

    $('[data-outlet="popup"]').append(new PopupView({
        model: new Mediator()
    }).render().el);

}());

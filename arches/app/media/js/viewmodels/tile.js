define([
    'jquery',
    'underscore',
    'knockout',
    'knockout-mapping',
    'arches',
    'require',
    'viewmodels/card'
], function($, _, ko, koMapping, arches, require) {
    /**
    * A viewmodel used for generic cards
    *
    * @constructor
    * @name TileViewModel
    *
    * @param  {string} params - a configuration object
    */
    var isChildSelected = function(parent) {
        var childSelected = false;
        var childrenKey = 'tileid' in parent ? 'cards': 'tiles';
        ko.unwrap(parent[childrenKey]).forEach(function(child) {
            if (child.selected && child.selected() || isChildSelected(child)){
                childSelected = true;
            }
        });
        return childSelected;
    };

    var doesChildHaveProvisionalEdits = function(parent) {
        var hasEdits = false;
        var childrenKey = 'tileid' in parent ? 'cards': 'tiles';
        ko.unwrap(parent[childrenKey]).forEach(function(child) {
            if (child.hasprovisionaledits && child.hasprovisionaledits() || doesChildHaveProvisionalEdits(child)){
                hasEdits = true;
            }
        });
        return hasEdits;
    };

    var updateDisplayName = function(resourceId, displayname) {
        $.get(
            arches.urls.resource_descriptors + resourceId(),
            function(descriptors) {
                displayname(descriptors.displayname);
            }
        );
    };

    var TileViewModel = function(params) {
        var CardViewModel = require('viewmodels/card');
        var self = this;
        var selection = params.selection || ko.observable();
        var scrollTo = params.scrollTo || ko.observable();
        var filter = params.filter || ko.observable();
        var loading = params.loading || ko.observable();

        _.extend(this, params.tile);

        this._tileData = ko.observable(
            koMapping.toJSON(params.tile.data)
        );

        this.data = koMapping.fromJS(params.tile.data);
        this.provisionaledits = ko.observable(params.tile.provisionaledits);

        _.extend(this, {
            filter: filter,
            parent: params.card,
            cards: _.filter(params.cards, function(card) {
                var nodegroup = _.find(ko.unwrap(params.graphModel.get('nodegroups')), function(group) {
                    return ko.unwrap(group.nodegroupid) === ko.unwrap(card.nodegroup_id);
                });
                return ko.unwrap(nodegroup.parentnodegroup_id) === ko.unwrap(self.nodegroup_id);
            }).map(function(card) {
                return new CardViewModel({
                    card: _.clone(card),
                    tile: self,
                    graphModel: params.graphModel,
                    resourceId: params.resourceId,
                    displayname: params.displayname,
                    handlers: params.handlers,
                    cards: params.cards,
                    tiles: params.tiles,
                    selection: selection,
                    scrollTo: scrollTo,
                    loading: loading,
                    filter: filter,
                    userisreviewer: params.userisreviewer,
                    provisionalTileViewModel: params.provisionalTileViewModel,
                    cardwidgets: params.cardwidgets
                });
            }),
            expanded: ko.observable(false),
            hasprovisionaledits: ko.computed(function() {
                return !!self.provisionaledits();
            }, this),
            selected: ko.pureComputed({
                read: function() {
                    return selection() === this;
                },
                write: function(value) {
                    if (value) {
                        selection(this);
                    }
                },
                owner: this
            }),
            formData: new FormData(),
            dirty: ko.computed(function() {
                return this._tileData() !== koMapping.toJSON(this.data);
            }, this),
            reset: function() {
                ko.mapping.fromJS(
                    JSON.parse(self._tileData()),
                    self.data
                );
                _.each(params.handlers['tile-reset'], function(handler) {
                    handler(self);
                });
                params.provisionalTileViewModel.selectedProvisionalEdit(undefined);
            },
            getAttributes: function() {
                var tileData = self.data ? koMapping.toJS(self.data) : {};
                var tileProvisionalEdits = self.provisionaledits ? koMapping.toJS(self.provisionaledits) : {};
                if (self.tileid === '') {
                    self.sortorder = self.parent.tiles().length;
                }
                return {
                    "tileid": self.tileid,
                    "data": tileData,
                    "nodegroup_id": ko.unwrap(self.nodegroup_id),
                    "parenttile_id": self.parenttile_id,
                    "resourceinstance_id": self.resourceinstance_id,
                    "provisionaledits": tileProvisionalEdits,
                    "sortorder": self.sortorder
                };
            },
            getData: function() {
                var children = {};
                if (self.cards) {
                    children = _.reduce(self.cards, function(tiles, card) {
                        return tiles.concat(card.tiles());
                    }, []).reduce(function(tileLookup, child) {
                        tileLookup[child.tileid] = child.getData();
                        return tileLookup;
                    }, {});
                }
                return _.extend(self.getAttributes(), {
                    "tiles": children
                });
            },
            save: function(onFail) {
                loading(true);
                delete self.formData.data;
                if (params.provisionalTileViewModel.selectedProvisionalEdit()) {
                    self.formData.append('accepted_provisional', JSON.stringify(params.provisionalTileViewModel.selectedProvisionalEdit()));
                    params.provisionalTileViewModel.acceptProvisionalEdit();
                }
                self.formData.append(
                    'data',
                    JSON.stringify(
                        self.getData()
                    )
                );
                $.ajax({
                    type: 'POST',
                    url: arches.urls.tile,
                    processData: false,
                    contentType: false,
                    data: self.formData
                }).done(function(tileData, status, req) {
                    if (self.tileid) {
                        koMapping.fromJS(tileData.data, self.data);
                        koMapping.fromJS(tileData.provisionaledits, self.provisionaledits);
                    }
                    self._tileData(koMapping.toJSON(self.data));
                    if (!self.tileid) {
                        self.tileid = tileData.tileid;
                        self.parent.tiles.push(self);
                        self.parent.expanded(true);
                        selection(self);
                    }
                    if (params.userisreviewer === false && !self.provisionaledits()) {
                        // If the user is provisional ensure their edits are provisional
                        self.provisionaledits(self.data);
                    }
                    if (params.userisreviewer === true && params.provisionalTileViewModel.selectedProvisionalEdit()) {
                        if (JSON.stringify(params.provisionalTileViewModel.selectedProvisionalEdit().value) === koMapping.toJSON(self.data)) {
                            params.provisionalTileViewModel.removeSelectedProvisionalEdit();
                        }
                    }
                    if (!params.resourceId()) {
                        self.resourceinstance_id = tileData.resourceinstance_id;
                        params.resourceId(self.resourceinstance_id);
                    }
                    _.each(params.handlers['after-update'], function(handler) {
                        handler(req, self);
                    });
                    updateDisplayName(params.resourceId, params.displayname);
                }).fail(function(response) {
                    if (typeof onFail === 'function') {
                        onFail(response);
                    }
                }).always(function(){
                    loading(false);
                });
            },
            deleteTile: function(onFail) {
                loading(true);
                $.ajax({
                    type: "DELETE",
                    url: arches.urls.tile,
                    data: JSON.stringify(self.getData())
                }).done(function(response) {
                    params.card.tiles.remove(self);
                    selection(params.card);
                }).fail(function(response) {
                    if (typeof onFail === 'function') {
                        onFail(response);
                    }
                }).always(function(){
                    loading(false);
                });
            }
        });
        this.isChildSelected = ko.computed(function() {
            return isChildSelected(this);
        }, this);
        this.doesChildHaveProvisionalEdits = ko.computed(function() {
            return doesChildHaveProvisionalEdits(this);
        }, this);
    };

    return TileViewModel;
});
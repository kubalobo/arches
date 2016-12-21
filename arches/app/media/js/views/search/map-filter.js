define([
    'jquery',
    'backbone',
    'arches',
    'knockout',
    'widgets/map'
    ],
    function($, Backbone, arches, ko, map) {
        return Backbone.View.extend({
            initialize: function(options) {

                $.extend(this, options);

                this.query = {
                    filter: {
                        // the various filters managed by this search filter widget
                    },
                    changed: ko.pureComputed(function(){
                        // a computed to determine if this filter has been changed
                    }, this)
                };

                this.hasFilters = function(){
                    // returns a boolean true if this filter is currently active, else false
                };

                this.appendFilters = function(queryStringObject){
                    // append your filters onto this object which ultimately is used in the URL

                    return queryStringObject;
                };

                this.restoreState = function(filter){
                    // a function to drive the state of the ui based on
                    // the filter object passed into the function

                    // the filter objects should take the same form as this.query.filter
                };

                this.clear = function(){
                    // a function that clears the filter and restores
                    // the ui to a clean and unfiltered state
                };
            }
        });
    });

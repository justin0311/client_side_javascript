var getImageURL = config.serverURL + "/getImage/";
var unlockPropertyURL = config.serverURL + "/unlockProperty/";
var getPropertyURL = config.serverURL + "/getProperty/";

function PropertyCache(usepreload) {
    this.NUM_PRELOADED_PROPERTIES = 3;

    this.properties = [];
    this.preloading = false;
    this.usepreload = usepreload;

    this.events = {
        ON_PROPERTY_ADDED: "propertycache:added",
        ON_PRELOAD_COMPLETE: "propertycache:preloadcomplete",
        ON_PROPERTY_TAGGED: "propertycache:propertytagged"
    };
}

PropertyCache.prototype.getPropertyIds = function() {
    var ids = [];
    for(var i = 0; i < this.properties.length; i++) {
        ids.push(this.properties[i].getId() + "-" + this.properties[i].getMlsSource());
    }

    return ids.join(',');
};

PropertyCache.prototype.fetchImage = function(imageId, mlsSource, callback, errcb) {
    $.getJSON(getImageURL + imageId + "/" + mlsSource, function(data) {
        if (data.status) {
            FYP.Utils.showPopup("Image load error! " + data.msg);
            console.log("Could not load image " + imageId + " from MLS: " + mlsSource +"! Status: " + data.msg);
            if (errcb) {
                errcb(data);
            }
        } else {
            var image = makeImage(data);
            if (callback) {
                callback(image);
            }
        }
    });
};

PropertyCache.prototype.fetch = function(propertyId, mls_source, callback, errcb) {
    if (!mls_source) {
        console.log("PropertyCache.fetch is called without mls_source for property '" + propertyId + "'");
    }
    $.getJSON(getPropertyURL + propertyId + "-" + mls_source, function(data) {
        if (data.status) {
            FYP.Utils.showPopup("Property load error! " + data.msg);
            console.log("Could not load property " + propertyId + "! Status: " + data.msg);
            if (errcb) {
                errcb(data);
            }
        } else {
            var property = new Property(data);
            callback(property);
        }
    });
};

PropertyCache.prototype.getIndex = function(propertyId, mls_source) {
    if (!mls_source) {
        console.log("getIndex is called without propertyId: '" + propertyId + "'")
    }

    for(var i = 0; i < this.properties.length; i++) {
        if (this.properties[i].getId() === propertyId && this.properties[i].getMlsSource() === mls_source) {
            return i;
        }
    }

    return -1;
};

PropertyCache.prototype.get = function(propertyId, mls_source, callback, errcb) {
    if (!mls_source) {
        console.log("PropertyCache.get is called without propertyId: '" + propertyId + "'")
    }
    var propIndex = this.getIndex(propertyId, mls_source);
    if (propIndex === -1) {
        this.fetch(propertyId, mls_source, callback, errcb);
    } else {
        callback(this.properties[propIndex]);
    }
};

PropertyCache.prototype.getNext = function(callback, errcb) {
    var self = this;
    var exclude = "";
    if (this.properties.length > 0) {
        exclude = "!" + this.getPropertyIds();
    }
    $.getJSON(getPropertyURL + exclude, function(data) {
        if (data.status) {
            FYP.Utils.showPopup("Property load error! " + data.msg);
            console.log("Could not load images! Status: " + JSON.stringify(data.msg));
            if (errcb) {
                errcb(data);
            }
        } else {
            // Some images have now been locked.
            showConfirmationClose = true;
            var property = new Property(data);

            if (self.existsId(property.getId(), property.getMlsSource())) {
                throw new Error("Server error! property exclusion not working for property '" + property.getId() +
                "' with MLS source: '" + property.getMlsSource() + "'");
            } else {
                console.log("Returning property " + property.getId());
                callback(property);
            }
        }
    });
};

PropertyCache.prototype.unlockProperties = function() {
    var self = this;

    $.each(this.properties, function() {
        console.log("Unlocking '" + this.getId() + "'");
        self.unlockProperty(this);
    });
};

PropertyCache.prototype.unlockProperty = function(prop, callback, errcb) {
    $.getJSON(unlockPropertyURL + prop.getId(), function(data) {
        if (data.status !== 'ok') {
            console.log("Could not unlock property '" + prop + "'! Status: " + data.msg);
            if (errcb) {
                errcb(data);
            }
        } else {
            if (callback) {
                callback(data);
            }
        }
    });
};

PropertyCache.prototype.getProperties = function() {
    return this.properties;
};

PropertyCache.prototype.put = function(property) {
    this.properties.push(property);
};

PropertyCache.prototype.remove = function(property) {
    var index = this.properties.indexOf(property);
    this.properties.splice(index, 1);
};

PropertyCache.prototype.isPreloaded = function() {
    var correctNoProperties = this.properties.length >= this.NUM_PRELOADED_PROPERTIES;
    return !this.usepreload || correctNoProperties;
};

PropertyCache.prototype.isPreloading = function() {
    return this.preloading;
};

PropertyCache.prototype.setPreloading = function(value) {
    this.preloading = value;
};

PropertyCache.prototype.existsId = function(propertyId, mls_source, callback) {
    if (!mls_source) {
        console.log("PropertyCache.existsId is called without propertyId: '" + propertyId + "'")
    }
    var propIndex = this.getIndex(propertyId, mls_source);
    return propIndex > -1;
};

PropertyCache.prototype.cachePropertyById = function(propertyId, mls_source, callback) {
    if (!mls_source) {
        console.log("PropertyCache.cachePropertyById is called without propertyId: '" + propertyId + "'")
    }
    var self = this;
    if (!this.existsId(propertyId, mls_source)) {
        this.get(propertyId, mls_source, function(property) {
            self.cacheProperty(property, callback);
        });
    }
};

PropertyCache.prototype.cachePropertyByImageId = function(imageId, mls_source, callback) {
    if (!mls_source) {
        console.log("PropertyCache.cachePropertyByImageId is called without propertyId: '" + propertyId + "'")
    }
    var self = this;
    this.fetchImage(imageId, mls_source, function(image) {
        self.cachePropertyById(image.getPropertyId(), mls_source, callback);
    });
};

PropertyCache.prototype.cacheProperty = function(property, callback) {
    var self = this;

    self.put(property);
    self.emit(self.events.ON_PROPERTY_ADDED, property);

    if (callback) {
        callback(property);
    }
};

PropertyCache.prototype.cacheNextProperty = function(callback, errcb) {
    var self = this;
    this.getNext(function(property) {
        self.cacheProperty(property, function() {
            if (callback) {
                callback();
            }
        });
    }, function(result) {
        if (errcb) {
            errcb(result);
        }
    });
};

PropertyCache.prototype.checkLoadProperties = function(callback, errcb) {
    var self = this;

    if (!self.isPreloaded()) {
        self.setPreloading(true);
        console.log("Preload started...");
        self.cacheNextProperty(function() {
            self.checkLoadProperties(callback, errcb);
        }, function(result) {
            if (errcb) {
                errcb(result);
            }
        });
    } else {
        if (self.isPreloaded()) {
            self.setPreloading(false);
            console.log("Preload is complete! " + self.getPropertyIds() + " loaded. Emitting.");
            self.emit(self.events.ON_PRELOAD_COMPLETE);
        }

        if (callback) {
            callback();
        }
    }
};

PropertyCache.prototype.imageSaved = function(image) {
    var self = this;
    var propertyId = image.getPropertyId();
    var mls_source =image.getMlsSource();

    /*
     * ON_PROPERTY_TAGGED might have been emitted before all images were actually saved. This
     * is detected by checking if the property exists in the cache. If not, it has already been
     * removed as a result of emitting the event.
     */

    if (this.usepreload && this.existsId(propertyId, mls_source)) {
        this.get(propertyId, mls_source, function(property) {
            if (property.isTaggingComplete() && !property.isDone()) {
                property.setDone();
                self.emit(self.events.ON_PROPERTY_TAGGED, property);
            }
        });
    }
};

PropertyCache.prototype.emit = function(event, data) {
    $.event.trigger({
        type: event,
        d: data,
        time: new Date()
    });
};

PropertyCache.prototype.on = function(event, handler) {
    $(document).on(event, handler);
};

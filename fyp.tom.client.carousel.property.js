var saveImageTagsServiceUrl = config.serverURL + "/saveImageTagging/";

function makeImage(imageData) {
    return jQuery.extend(new Image(), imageData);
}

function Property(data) {
    var self = this;
    this.images = [];
    $.each(data.images, function(imageIndex, imageData) {
        var imageObj = makeImage(imageData);
        self.images.push(imageObj);
    });

    this.done = false;
    this.id = data.property;
    this.mls_source = data.mls_source;
}

Property.prototype.setDone = function() {
    this.done = true;
};

Property.prototype.isDone = function() {
    return this.done;
};

Property.prototype.getId = function() {
    return this.id;
};

Property.prototype.getMlsSource = function() {
    return this.mls_source;
};

Property.prototype.getImage = function(imageId) {
    for(var i = 0; i < this.images.length; i++) {
        if (imageId === this.images[i].getId()) {
            return this.images[i];
        }
    }

    return null;
};

Property.prototype.removeImage = function(image) {
    for(var i = 0; i < this.images.length; i++) {
        if (image.getId() === this.images[i].getId()) {
            this.images.splice(i, 1);
            i--;
        }
    }

    return null;
};

Property.prototype.getImages = function() {
    return this.images;
};

Property.prototype.getNumImages = function() {
    return this.images.length;
};

Property.prototype.getImageIndex = function(image) {
    for(var i = 0; i < this.images.length; i++) {
        if (this.getImageByIndex(i).getId() === image.getId()) {
            return i;
        }
    }

    return -1;
};

Property.prototype.getImageByIndex = function(index) {
    return this.images[index];
};

Property.prototype.getNumTaggedImages = function() {
    var numTagged = 0;
    $.each(this.images, function() {
        if (this.tagged) {
            numTagged++;
        }
    });

    return numTagged;
};

Property.prototype.getNumChangedImages = function() {
    var numChanged = 0;
    $.each(this.images, function() {
        if (this.tagschanged) {
            numChanged++;
        }
    });

    return numChanged;
};

Property.prototype.isTaggingComplete = function() {
    var tagsChanged = (this.getNumChangedImages > 0);
    var allTagged = (this.getNumTaggedImages() === this.getNumImages());
    return allTagged && !tagsChanged;
};

function Image() {
    this.selected = false;
    this.tagschanged = false;
    this.saving = false;
}

Image.prototype.setSaving = function(value) {
    this.saving = value;
};

Image.prototype.isSaving = function() {
    return this.saving;
};

Image.prototype.setTagsChanged = function() {
    this.tagschanged = true;
};

Image.prototype.resetTagsChanged = function() {
    this.tagschanged = false;
};

Image.prototype.isTagsChanged = function() {
    return this.tagschanged;
};

Image.prototype.getButtonValue = function(groupName, name, defaultValue) {
    var value = null;
    var attribute = jQuery.map(this.tags.attrList, function(obj) {
        if(obj.name === groupName) {
            return obj;
        }
    });

    if (attribute.length > 0) {
        if (attribute[0].type === FypButton.types.SELECTION) {
            value = attribute[0].value.indexOf(name) > -1;
        } else if (attribute[0].type === FypButton.types.BOOLEAN) {
            value = attribute[0].value.indexOf('true') > -1;
        }

    } else {
        if (defaultValue) {
            value = defaultValue;
        }
    }
    return value;
};

Image.prototype.getId = function() {
    return this.mls_id;
};

Image.prototype.getPropertyId = function() {
    return this.mlsNumber;
};

Image.prototype.getMlsSource = function() {
    return this.mls_source;
};

Image.prototype.getStateName = function() {
    var name = '';

    if (this.corrected === true) {
        name = "Corrected";
    } else if (this.tagged) {
        name = "Tagged";
    } else {
        name = "Untagged";
    }

    return name;
};

Image.prototype.getStateCssClass = function() {
    var cssClass = '';

    if (this.isSaving()) {
        cssClass = "item-saving";
    } else if (this.corrected === true) {
        cssClass = "item-tagged item-corrected";
    } else if (this.tagged) {
        cssClass = "item-tagged";
    } else {
        cssClass = "item";
    }

    return cssClass;
};

Image.prototype.getBatchName = function() {
    var batchName = '&lt;unknown&gt;';
    if (this.batch.name) {
        batchName = this.batch.name;
    } else if (this.batch.createdate) {
        batchName = FYP.Utils.getBatchName(this.batch.createdate);
    } else {
        console.log("Batch with id '" + this.batch + "' not found!");
    }

    return batchName;
};

Image.prototype.getSelected = function() {
    return this.selected;
};

Image.prototype.setSelected = function() {
    this.selected = true;
};

Image.prototype.setUnselected = function() {
    this.selected = false;
};

Image.prototype.updateTags = function(buttons, metahandler) {
    this.tags.attrList = this.getAttrList(buttons, metahandler);
    this.tagged = true;
};

Image.prototype.getAttrList = function(buttons, metahandler) {
    var attrList = [];

    var metaList = metahandler.metadata;

    for(var i = 0; i < metaList.length; i++) {
        var thisMetaName = metaList[i].name;
        var thisMetaType = metaList[i].type;

        var selAttr = {
            name: thisMetaName,
            type: thisMetaType,
            hint: "",
            value: ""
        };

        var buttonName;
        var theButton;
        if (thisMetaType === 'selection') {
            var theAttrs = [];
            for(j = 0; j < metaList[i].options.length; j++) {
                var thisOptionName = metaList[i].options[j];
                buttonName = thisMetaName.replace(' ', '_') + "-" + thisOptionName.replace(' ', '_');
                theButton = buttons[buttonName];

                if (theButton.isClicked()) {
                    theAttrs.push(thisOptionName);
                }
            }
            if (theAttrs.length > 0) {
                selAttr.value = theAttrs;
            }

        } else if (thisMetaType === 'boolean') {
            buttonName = thisMetaName.replace(' ', '_');
            theButton = buttons[buttonName];

            selAttr.value = theButton.isClicked().toString();
        }

        if (selAttr.value !== "") {
            attrList.push(selAttr);
        }
    }

    return attrList;
};

Image.prototype.save = function(callback, errcb) {
    var self = this;

    var shortTags = {
        _id: this._id,
        mls_id: this.mls_id,
        mls_source: this.mls_source,
        tags: this.tags,
        isSkip: false,
        skipComment: undefined,
        skipReason: undefined
    };

    this.setSaving(true);

    $.ajax({
        type: "POST",
        url: saveImageTagsServiceUrl,
        contentType: 'application/json',
        data: JSON.stringify(shortTags),
        crossDomain: true,
        success: function(data){
            if(data.status === "success") {
                self.setSaving(false);
                if (callback) {
                    callback(data);
                }
            } else {
                if (errcb) {
                    errcb(data);
                }
            }
        },
        error: function(xhr, ajaxOptions, thrownError) {
            if (errcb) {
                errcb(thrownError);
            }
        }
    });
};




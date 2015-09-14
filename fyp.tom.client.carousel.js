var carousel;
var properties;
var hidservice;
var buttons = {};
var metahandler;
var scrollDisabled = false;
var showConfirmationClose = false;

function hasImageSelector() {
    var imageId = FYP.Utils.getOption("image");

    return imageId !== undefined;
}

function hasMlsSelector() {
    var mlsSource = FYP.Utils.getOption("mls");

    return mlsSource !== undefined;
}

function hasPropertySelector() {
    var propertyId = FYP.Utils.getOption("property");

    return propertyId !== undefined;
}

function hasSpecificSelector() {
    return hasImageSelector() || hasPropertySelector();
}

function getOptionButtons(metaName, options, shortcuts) {
    var html = '';
    $.each(options, function(index) {
        var option = this;
        var shortcut = shortcuts[index];

        var button = new FypButton(metaName, option, FypButton.types.SELECTION);
        var shortcutChar = hidservice.registerShortcut(shortcut, button);
        button.setShortcut(shortcutChar);
        buttons[button.id] = button;
        html += button.html();
    });

    return html;
}

function appendSelection(element, selections) {
    $.each(selections, function(index) {
        var selection = this;
        var thisMetaName = selection.name;

        var html = '';
        html += '<div class="carousel-attribute-label"><h4>' + thisMetaName + '</h4></div>';
        html += '<div id="filter-' + thisMetaName.replace(' ', '_') + '" class="button-group">';
        html += getOptionButtons(thisMetaName, selection.options, selection.shortcut);
        html += '</div';
        element.append(html);
    });
}

function appendBoolean(element, booleans) {
    var labelClass = null;
    var html = '';
    $.each(booleans, function() {
        var boolean = this;
        var thisMetaName = boolean.name;
        var defaultValue;

        labelClass = labelClass ?  "carousel-attribute-label-short" : "carousel-attribute-label";
        html += '<div class="' + labelClass + '"><h4>' + thisMetaName + '</h4></div>';
        html += '<div id="filter-' + thisMetaName.replace(' ', '_') + '" class="inline-button-group">';

        /* There is no dynamic way to set default values for buttons. This needs to be hardcoded. */
        if (thisMetaName === "DisplayPhoto") {
            defaultValue = true;
        }

        var button = new FypButton(thisMetaName, 'Enabled', FypButton.types.BOOLEAN, defaultValue);
        var shortcutChar = hidservice.registerShortcut(boolean.shortcut, button);
        button.setShortcut(shortcutChar);
        buttons[button.id] = button;
        html += button.html();

        html += '</div>';
    });

    element.append(html);
}

function addMetaButtons() {

    var element = $('#searchContents');

    appendSelection(element, metahandler.getTypeSelections());
    appendBoolean(element, metahandler.getTypeBooleans());

    var filterDiv = '';

    filterDiv += '</div>';

    if (hasSpecificSelector()) {
        filterDiv += '<button class="btn btn-primary carousel-save-button" type="button" id="btnSave">SAVE</button>';
    }

    $('#searchContents').append(filterDiv);

    $('.togglebutton').click(function() {
        var button = buttons[this.id];
        clickMetaButton(button);
    });
}

function initOnBrowserClose() {
    $(window).bind('beforeunload', function() {
        var image = carousel.getCurrentImage();
        properties.unlockProperties();

        if (image.isTagsChanged()) {
            saveImage(image, function() {
                fadeMessage("Tags saved!");
            }, function() {
                fadeMessage("Save failed!");
            });
            return 'Changes to current image has been saved. If you stay on the page, it will be reloaded to refresh images.';
        }

        if (showConfirmationClose) {
            setTimeout(function() {
                setTimeout(function() {
                    showConfirmationClose = false;
                    window.location.reload();
                }, 500);
            },1);

            return 'All images have been unlocked. If you stay on the page, it will be reloaded to refresh images.';
        }
    });
}

function updateImageMessage(image) {
    var self = this;

    self.properties.get(image.getPropertyId(), image.getMlsSource(), function(property) {
        var numImages = property.getNumImages();
        var numTagged = property.getNumTaggedImages();

        var msg = "<p><b>Batch</b><br/>" + image.getBatchName() + "</p>";
        msg += "<p><b>Property</b><br/>" + image.mlsNumber + "<p/>";
        msg += "<p><b>MLS Source</b><br/>" + image.mls_source + "<p/>";
        msg += "<p><b>Property state</b><br/>" + numTagged + "/" + numImages + " tagged<p/>";
        msg += "<p><b>Image</b><br/>" + image.mls_id + "<p/>";
        msg += "<p><b>Image state:</b> " + image.getStateName() + "<p/>";
        if (image.tagged && image.taggedby && image.timetagged) {
            var daysdiff = Math.round((new Date() - new Date(image.timetagged)) / (1000 * 60 * 60 * 24));
            msg += "<p><b>Tagged by</b><br/>" + image.taggedby + ", " + daysdiff + " days ago<p/>";
        }

        if (image.tagged) {
            msg += "<p style='font-size: 0.75em'>";
            $.each(image.tags.attrList, function () {
                if (this.value && this.value !== '' && this.value.length > 0) {
                    if (this.type === 'selection' && this.value && this.value.length > 0) {
                        msg += "<b>" + this.name + "</b>: " + this.value.join(', ') + "<br/>";
                    } else {
                        msg += "<b>" + this.name + "</b>: true<br/>";
                    }
                }
            });
            msg += "<p/>";
        }

        FYP.Utils.setHeaderMessage(msg);
    });
}

function onSelectImage(event) {
    var image = event.d;
    setButtonValues(image);
    carousel.itemActive(image);
    updateImageMessage(image);
}

function onDeselectImage(event) {
    var image = event.d;

    if (image.isTagsChanged()) {
        onKeySpace();
    }

    carousel.itemInactive(image);
}

function saveImage(image, callback, errcb) {
    image.setSaving(true);
    image.updateTags(buttons, metahandler);
    carousel.updateItemCss(image);
    image.save(function() {
        properties.imageSaved(image);
        image.resetTagsChanged();
        carousel.updateItemCss(image);
        if (callback) {
            callback();
        }
    }, function(err) {
        if (errcb) {
            errcb();
        }
    });
}

function onPropertyTagged(event) {
    var property = event.d;
    scrollDisabled = true;
    var currentImage = carousel.getCurrentImage();

    // If we are removing the property with the current active image, unset
    // it to scroll to the first next one
    var currentPropertyIndex = property.getImageIndex(currentImage);
    if (currentPropertyIndex !== -1) {
        var numImagesLeft = property.getNumImages() - currentPropertyIndex;

        carousel.scrollOffset(numImagesLeft);
    }

    scrollDisabled = false;
    carousel.removeProperty(property, function() {
        properties.remove(property);
        checkLoadProperties();
    });
}

function onKeySpace() {
    var image = carousel.getCurrentImage();
    saveImage(image, function() {
        fadeMessage("Tags saved!");
    }, function() {
        fadeMessage("Save failed!");
    });
}

function onMove(offset) {
    if (!scrollDisabled) {
        carousel.scrollOffset(offset);
    }
}

function onMoveLeft(event) {
    onMove(-1);
}

function onMoveRight(event) {
    onMove(1);
}

function onMouseScroll(event) {
    var delta = event.d.delta;
    // Reverse scroll direction
    carousel.scrollOffset(-delta);
}

function onKeyShortcut(event) {
    var key = event.d.key;
    var button = event.d.button;

    clickMetaButton(button);
}

function clickMetaButton(button) {
    if (button.getType() === FypButton.types.SELECTION) {
        if (button.isClicked()) {
            fadeMessage("Removing '" + button.name + "'");
        } else {
            fadeMessage("Adding '" + button.name + "'");
        }
    } else if (button.getType() === FypButton.types.BOOLEAN) {
        fadeMessage("Toggling '" + button.groupName + "' to " + !button.isClicked());
    }

    button.toggle();

    var image = carousel.getCurrentImage();
    image.setTagsChanged();

    updateButtons();
}

function setButtonValues(image) {
    $.each(buttons, function() {
        var button = this;

        var buttonValue = image.getButtonValue(button.groupName, button.name, button.getDefaultValue());

        button.setValue(buttonValue);

        updateButton(button);
    });
}

function updateButton(button) {
    var buttonElem = $('#' + button.id);
    if (button.isClicked()) {
        buttonElem.addClass('togglebutton-down');
    } else {
        buttonElem.removeClass('togglebutton-down');
    }
}

function updateButtons() {
    $.each(buttons, function() {
        updateButton(this);
    });
}

function onPropertyAdded(event) {
    var property = event.d;
    carousel.addItems(property, function() {
        if (!carousel.getCurrentImage()) {
            carousel.scrollIndex(0);
        }
    });
}

function onPreloadComplete(event) {
}

function checkLoadProperties(callback) {
    if (this.hasImageSelector() && this.hasMlsSelector()) {
        var imageId = FYP.Utils.getOption("image");
        var mls_source = FYP.Utils.getOption("mls");
        properties.cachePropertyByImageId(imageId, mls_source, function(property) {
            onPreloadComplete();
            carousel.skipToImage(property.getImage(imageId));
        });
    } else if (hasPropertySelector() && this.hasMlsSelector()) {
        var propertyId = FYP.Utils.getOption("property");
        mls_source = FYP.Utils.getOption("mls");
        properties.cachePropertyById(propertyId, mls_source, function() {
            onPreloadComplete();
        });
        if (callback) {
            callback();
        }
    } else {
        if (!properties.isPreloading()) {
            properties.checkLoadProperties(callback, function(result) {
                alert("Error loading properties - " + result.msg);
            });
        } else {
            console.log("Preload already running.");
        }
    }
}

function fadeMessage(message) {
    FYP.Utils.showPopup(message);
    FYP.Utils.fadeOutPopup();
}

(function($) {
    //check version
    FYP.Utils.checkVersion(function(version) {
        $(function() {
            FYP.Utils.initOptions();

            properties = new PropertyCache(!hasSpecificSelector());
            properties.on(properties.events.ON_PROPERTY_ADDED, onPropertyAdded);
            properties.on(properties.events.ON_PRELOAD_COMPLETE, onPreloadComplete);
            properties.on(properties.events.ON_PROPERTY_TAGGED, onPropertyTagged);

            carousel = new Navigator($('.carousel-stage'), $('.carousel-navigation'), properties);
            carousel.on(carousel.events.ON_SELECT_IMAGE, onSelectImage);
            carousel.on(carousel.events.ON_DESELECT_IMAGE, onDeselectImage);

            carousel.initCarousel();
            carousel.initCarouselNavigation();

            hidservice = new HidService();
            hidservice.init();
            hidservice.on(hidservice.events.ON_KEY_SPACE, onKeySpace);
            hidservice.on(hidservice.events.ON_KEY_LEFT, onMoveLeft);
            hidservice.on(hidservice.events.ON_KEY_RIGHT, onMoveRight);
            hidservice.on(hidservice.events.ON_MOUSE_SCROLL, onMouseScroll);
            hidservice.on(hidservice.events.ON_KEY_SHORTCUT, onKeyShortcut);

            initOnBrowserClose();

            FYP.Utils.getMetaList(function(metadata) {
                metahandler = new MetadataHandler(metadata.metaList);
                addMetaButtons();
            });


            checkLoadProperties();
        });
    }, function(version) {
        if (!version.build || version.build === 0) {
            FYP.Utils.setHeaderMessage("<h4>Error: TOM Server not responding! Reload page to try again.</h4>");
        }
    });
})(jQuery);

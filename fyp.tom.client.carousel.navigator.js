function Navigator(stageElement, navElement, propCache) {

    this.carouselnav = navElement;
    this.carouselstage = stageElement;
    this.propCache = propCache;
    this.LOAD_NEXT_ID = 'loadnext';
    this.currentImage = null;

    this.THUMBNAIL_SIZE = 100;

    this.events = {
        ON_SELECT_IMAGE: "navigator:imageselected",
        ON_DESELECT_IMAGE: "navigator:imagedeselected"
    };

    this.carouselstage = $('.carousel-stage').jcarousel({
        animation: {
            duration: 100,
            easing:   'linear'
        }
    });

    this.carouselnav = $('.carousel-navigation').jcarousel({
        animation: {
            duration: 100,
            easing:   'linear'
        }
    });

    this.initHooks();

}

Navigator.prototype.connector = function(itemNavigation, carousel) {
    return carousel.jcarousel('items').eq(itemNavigation.index());
};

Navigator.prototype.getCurrentImage = function() {
    return this.currentImage;
};

Navigator.prototype.setCurrentImage = function(image) {
    var self = this;
    self.currentImage = image;
    if (image) {
        image.setSelected();
    }
};

Navigator.prototype.getIdParts = function(element) {
    var images = element.find('img');

    if (images.length === 1) {
        var parts = images[0].id.split(':');

        if (parts.length >= 2) {
            var propId = parts[0];
            var imageId = parts[1];
            if (imageId === "loadnext") {
                return {property: propId, image: imageId, mls_source: "loadnext"};
            } else if (parts.length === 3) {
                var mls_source = parts[2];
                return {property: propId, image: imageId, mls_source: mls_source};
            }
        } else {
            return null;
        }
    } else {
        return null;
    }
};

Navigator.prototype.getImage = function(element, callback, cberr) {
    var ids = this.getIdParts(element);

    if (ids && ids.image !== 'loadnext') {
        this.propCache.get(ids.property, ids.mls_source, function(property) {
            var image = property.getImage(ids.image);
            if (image) {
                callback(image);
            } else {
                if (cberr) {
                    cberr();
                }
            }
        });
    } else {
        if (cberr) {
            cberr();
        }
    }
};

Navigator.prototype.doSelectImageHook = function(theImage) {
    var self = this;
    var currentImage = self.getCurrentImage();

    self.getImage(theImage, function(image) {
        if (currentImage) {
            self.emit(self.events.ON_DESELECT_IMAGE, currentImage);
        }

        if (image) {
            self.emit(self.events.ON_SELECT_IMAGE, image);
        }
    });
};

Navigator.prototype.initHooks = function() {
    var self = this;

    this.carouselstage.on('jcarousel:scrollend', function(event, carousel) {
        self.doSelectImageHook($(this).jcarousel('target'));
    });

    this.carouselstage.on('jcarousel:targetin', 'li', function(event, carousel) {
        //        self.doSelectImageHook($(this));
    });
};

Navigator.prototype.resizeStage = function(item) {
    item.find('img').load(function() {
        if ($(this).width() > 0 && $(this).height() > 0) {
            $('.stage').css('width', $(this).width() + 18);
            $('.stage').css('height', $(this).height());
        }
    });
};

Navigator.prototype.reload = function() {
    this.carouselstage.jcarousel('reload');
    this.carouselnav.jcarousel('reload');
    var self = this;

    this.carouselnav.jcarousel('items').each(function() {
        var item = $(this);

        // This is where we actually connect to items.
        var target = self.connector(item, self.carouselstage);

        item
            .on('jcarouselcontrol:active', function() {
                self.carouselnav.jcarousel('scrollIntoView', this);
            })
            .on('jcarouselcontrol:inactive', function() {
            })
            .jcarouselControl({
                target: target,
                carousel: self.carouselstage
            });
    });
};

Navigator.prototype.updateItemCss = function(image) {
    var self = this;
    self.getImageElement(this.carouselnav, image, function(element) {
        element.removeClass();

        var css = image.getStateCssClass();
        element.addClass(css);
        if (image.getSelected()) {
            element.addClass('item-selected');
        }
    });
};

Navigator.prototype.itemInactive = function(image) {
    image.setUnselected();
    this.updateItemCss(image);
};

Navigator.prototype.itemActive = function(image, callback) {
    var self = this;

    self.setCurrentImage(image);
    this.updateItemCss(image);

    self.getImageElement(this.carouselnav, image, function(item) {

        if (image.getId() === self.LOAD_NEXT_ID) {
            $('#searchContents').hide();
            if (isPreloaded() && isLast(item)) {
                item.addClass('item-locked');
            }
            FYP.Utils.setHeaderMessage("&nbsp;");

        } else {
            $('#searchContents').show();
        }

        self.centerNav();

        if (callback) {
            callback();
        }
    });
};

Navigator.prototype.getImageElement = function(carousel, image, callback) {
    var self = this;
    carousel.jcarousel('items').each(function(index) {
        var id = self.getIdParts($(this));
        if (id.property === image.getPropertyId() && id.image === image.getId()) {
            callback($(this));
        }
    });
};

Navigator.prototype.removeProperty = function(property, callback) {
    var self = this;
    this.carouselnav.jcarousel('items').each(function () {
        var item = $(this);
        var itemId = self.getIdParts(item);

        if (itemId.property === property.getId()) {
            self.removeItem(item);
        }
    });
    if (callback) {
        callback();
    }
};

Navigator.prototype.removeItem = function(item) {
    var stageItem = this.connector(item, this.carouselstage);
    item.remove();
    stageItem.remove();

    if (this.carouselstage.jcarousel('items').length > 0) {
        this.carouselstage.jcarousel('reload');
    }

    if (this.carouselnav.jcarousel('items').length > 0) {
        this.carouselnav.jcarousel('reload');
    }
};


Navigator.prototype.addItems = function(property, callback) {
    var navUl = this.carouselnav.find('ul');
    var stageUl = this.carouselstage.find('ul');
    var self = this;
    var images = property.getImages();

    var toBeRemoved = [];
    $.each(images, function() {
        var image = this;

        var lockedByOther = image.locked && image.lockedby !== FYP.Utils.getLogin();

        if (lockedByOther) {
            console.log("Image " + image.mls_id + " is locked by " + image.lockedby + "! Removing from list.");
            toBeRemoved.push(image);
        } else {
            var cssClass = image.getStateCssClass();

            navUl.append('<li class="' + cssClass + '"><img id="' + property.getId() + ":" + image.mls_id + ":" + image.mls_source + '" src="' + (image["640_url"] || image.url) + '" alt="' + image.comment + '" width="' + self.THUMBNAIL_SIZE + '" height="' + self.THUMBNAIL_SIZE + '"></li>');
            stageUl.append('<li class="' + cssClass + '"><img width="640" height="480" id="' + property.getId() + ":" + image.mls_id + ":" + image.mls_source + '" src="' + (image["640_url"] || image.url) + '" alt="' + image.comment + '"></li>');
        }
    });

    $.each(toBeRemoved, function() {
        var oldLength = property.getImages().length;
        property.removeImage(this);
        console.log("Skipping image: '" + this.mls_id + "'. Already locked by " + this.lockedby + ". Was " + oldLength + ", is now " + property.getImages().length);
    });

    if (!hasSpecificSelector()) {
        var offset = (self.THUMBNAIL_SIZE - 64 + 4) / 2;
        navUl.append('<li style="border: 4px solid transparent;position:relative;top:' + offset + 'px;bottom:' + offset + 'px"><img id="' + property.getId() + ":" + self.LOAD_NEXT_ID + '" src="images/icon_home.png" alt="Next property" width="64" height="64"></li>');
        stageUl.append('<li style="border: 4px solid transparent;position:relative;top:' + offset + 'px;bottom:' + offset + 'px"><img id="' + property.getId() + ":" + self.LOAD_NEXT_ID + '" src="images/1x1px_white.png" alt="Next property" width="640" height="480"></li>');
//        stageUl.append('<li></li>');
    }

    this.reload();

    callback();
};

Navigator.prototype.getNumItems = function() {
    return this.carouselstage.jcarousel('items').length;
};

Navigator.prototype.reloadItems = function() {
    this.carouselstage.jcarousel('reload');
};

Navigator.prototype.removeItem = function(item) {
    var stageItem = this.connector(item, this.carouselstage);
    item.remove();
    stageItem.remove();

    if (this.getNumItems() > 0) {
        this.reloadItems();
    }

    if (this.getNumItems().length > 0) {
        this.reloadItems();
    }
};

Navigator.prototype.getFirstNavIndex = function() {
    return this.carouselnav.jcarousel('first').index();
};

Navigator.prototype.getLastNavIndex = function() {
    return this.carouselnav.jcarousel('last').index();
};

Navigator.prototype.getCurNavIndex = function() {
    return this.getCurNavElement().index();
};

Navigator.prototype.getCurNavElement = function() {
    return this.carouselstage.jcarousel('target');
};

Navigator.prototype.isLoadNext = function(element) {
    var ids = this.getIdParts(element);
    if (ids.image === carousel.LOAD_NEXT_ID) {
        return true;
    } else {
        return false;
    }
};

Navigator.prototype.scrollIndex = function(index, callback) {
    var self = this;

    self.private().scrollTo(index, function () {
        if (callback) {
            callback();
        }
        self.centerNav();
    });
};

Navigator.prototype.centerNav = function() {
    var self = this;

    var firstIndex = this.getFirstNavIndex();
    var lastIndex = this.getLastNavIndex();
    var currentIndex = this.getCurNavIndex();
    var navLength = lastIndex - firstIndex;
    var wantedIndex = (lastIndex + firstIndex) / 2;

    var isAtBeginningOfList = (currentIndex < navLength / 2);
//    var isAtEndOfList = (currentIndex > (lastIndex - navLength / 2));
    var isAtEndOfList = currentIndex === (this.getNumItems() - 1);
    var isLeftOfMiddleOfList = (currentIndex >= wantedIndex);
    var isRightOfMiddleOfList = (currentIndex <= wantedIndex);

//    console.log("Centering nav... beginning=" + isAtBeginningOfList + ", end=" + isAtEndOfList + ", leftofmiddle=" + isLeftOfMiddleOfList + ", rightofmiddle=" + isRightOfMiddleOfList + ", currentindex=" + currentIndex + ", wantedindex=" + wantedIndex + ", numitems=" + this.getNumItems());

    var moveNum = 0;
    if (isAtBeginningOfList) {
        moveNum = wantedIndex;
    } else if (isAtEndOfList) {
        moveNum = wantedIndex;
    } else if (isLeftOfMiddleOfList) {
        moveNum = currentIndex + navLength / 2;
    } else if (isRightOfMiddleOfList) {
        moveNum = currentIndex - navLength / 2;
    }

    self.private().moveNav(moveNum);
};

Navigator.prototype.scrollOffset = function(offset, callback) {
    var self = this;

    var numItems = this.carouselstage.jcarousel('items').length;
    var currentIndex = self.getCurNavIndex();

    var realOffset = 0;
    if (offset > 0) {
        // Disallow scrolls past the end of the list
        realOffset = Math.min(offset, numItems - currentIndex);
        if (realOffset !== 0) {
            self.private().scrollTo('+=' + realOffset, function () {
                self.centerNav();

                if (self.isLoadNext(self.getCurNavElement())) {
                    if (currentIndex + 1 === self.getLastNavIndex()) {
                        self.scrollOffset(-1, callback);
                    } else {
                        self.scrollOffset(1, callback);
                    }
                } else {

                    if (callback) {
                        callback();
                    }
                }
            });
        }
    } else {
        // Disallow scrolls below index 0
        realOffset = Math.max(offset, -currentIndex);

        if (realOffset != 0) {
            self.private().scrollTo('-=' + -realOffset, function () {
                self.centerNav();

                if (self.isLoadNext(self.getCurNavElement())) {
                    self.scrollOffset(-1, callback);
                } else {
                    if (callback) {
                        callback();
                    }
                }
            });
        }
    }
};

Navigator.prototype.private = function(callback) {
    var self = this;
    return {
        moveNav: function (index, callback) {
            self.carouselnav.jcarousel('scrollIntoView', index, true, callback);
        },
        scrollTo: function(index, callback) {
            self.carouselstage.jcarousel('scroll', index, true, function() {
                self.getImage(self.getCurNavElement(), function(newImage) {
                    self.itemActive(newImage, callback);
                }, function(err) {
                    if (callback) {
                        callback(err);
                    }
                });
            });
        }
    };
};

Navigator.prototype.getCurrentProperty = function(callback) {
    return this.propCache.get(this.currentImage.getPropertyId(), this.currentImage.getMlsSource(), function(property) {
        callback(property);
    });
};

Navigator.prototype.skipToImage = function(image) {
    var self = this;

    self.getCurrentProperty(function(currentProperty) {
        var index = currentProperty.getImageIndex(image);

        console.log("Skipping to image index " + index);
        self.scrollIndex(index);
    });
};

Navigator.prototype.skipTaggedImages = function() {
    var self = this;

    self.getCurrentProperty(function(currentProperty) {
        var start = currentProperty.getImageIndex(self.currentImage);
        var imagesToSkip = 0;
        for(var i = start; i < currentProperty.getNumImages(); i++) {
            var thisImage = currentProperty.getImageByIndex(i);
            if (thisImage.tagged) {
                imagesToSkip++;
            }
        }

        console.log("Skipping " + imagesToSkip + " images which are already tagged");
        self.scrollOffset(imagesToSkip);
    });
};

Navigator.prototype.initCarouselNavigation = function() {
    // Setup controls for the stage carousel
    $('.prev-stage').jcarouselControl({ target: '-=1' });
    $('.next-stage').jcarouselControl({ target: '+=1' });

    // Setup controls for the navigation carousel
    $('.prev-navigation').jcarouselControl({ target: '-=1' });
    $('.next-navigation').jcarouselControl({ target: '+=1' });
};

Navigator.prototype.initCarousel = function() {
    this.carouselnav.html('<ul></ul>');
    this.carouselstage.html('<ul></ul>');
};

Navigator.prototype.emit = function(event, data) {
    $.event.trigger({
        type: event,
        d: data,
        time: new Date()
    });
};

Navigator.prototype.on = function(event, handler) {
    $(document).on(event, handler);
};

Navigator.prototype.one = function(event, handler) {
    $(document).one(event, handler);
};

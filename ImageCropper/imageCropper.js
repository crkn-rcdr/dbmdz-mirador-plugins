var ImageCropper = {
  /* some needed flags and variables */
  croppingActive: false,
  dragging: false,
  imageUrlParams: {},
  resizing: false,

  /* options of the plugin */
  options: {},

  /* all of the needed locales */
  locales: {
    'de': {
      'options': 'Optionen',
      'preview': 'Vorschau',
      'quality': 'Qualität',
      'region-link': 'Link zum ausgewählten Ausschnitt',
      'rotation': 'Rotation',
      'size': 'Größe',
      'toggle-cropping': 'Auswahl eines Bildausschnitts aktivieren'
    },
    'en': {
      'options': 'Options',
      'preview': 'Preview',
      'quality': 'Quality',
      'region-link': 'Link to the selected region',
      'rotation': 'Rotation',
      'size': 'Size',
      'toggle-cropping': 'Toggle image cropping'
    }
  },

  /* the template for the cropping toggle button */
  buttonTemplate: Mirador.Handlebars.compile([
    '<div class="cropping-controls">',
    '<a class="cropping-toggle hud-control{{#if active}} active{{/if}}" role="button" title="{{t "toggle-cropping"}}" aria-label="{{t "toggle-cropping"}}">',
    '<i class="fa fa-lg fa-crop"></i>',
    '</a>',
    '</div>'
  ].join('')),

  /* the template for the cropping overlay */
  croppingOverlayTemplate: Mirador.Handlebars.compile([
    '<div class="cropping-overlay">',
    '<i class="fa fa-share-alt-square share-button" aria-hidden="true"></i>',
    '<div class="resize-frame"></div>',
    '{{#each resizeControls.anchors}}',
    '<div class="resize-anchor {{this}}"></div>',
    '{{/each}}',
    '{{#each resizeControls.bars}}',
    '<div class="resize-bar {{this}}"></div>',
    '{{/each}}',
    '</div>'
  ].join('')),

  /* the template for the image url */
  imageUrlTemplate: Mirador.Handlebars.compile(
    '{{imageBaseUrl}}/{{region.x}},{{region.y}},{{region.w}},{{region.h}}/{{size}}/{{rotation}}/{{quality}}.jpg'
  ),

  /* the template for the modal containing the image url for the selection */
  modalTemplate: Mirador.Handlebars.compile([
    '<div id="image-cropper-modal" class="modal fade" tabindex="-1" role="dialog">',
    '<div class="modal-dialog" role="document">',
    '<div class="modal-content">',
    '<div class="modal-header">',
    '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>',
    '<h4 class="modal-title">{{t "region-link"}}</h4>',
    '</div>',
    '<div class="modal-body">',
    '<input id="image-url" type="text">',
    '<button type="button" class="btn btn-default" id="copy-to-clipboard" title="{{t "copy-to-clipboard"}}">',
    '<i class="fa fa-clipboard" aria-hidden="true"></i>',
    '</button>',
    '<h4 class="options">{{t "options"}}</h4>',
    '<div class="option-type size">{{t "size"}}:</div>',
    '<label class="radio-inline"><input type="radio" name="size" data-size="full" checked>full</label>',
    '<div class="option-type rotation">{{t "rotation"}}:</div>',
    '<label class="radio-inline"><input type="radio" name="rotation" data-rotation="0" checked>0°</label>',
    '<label class="radio-inline"><input type="radio" name="rotation" data-rotation="90">90°</label>',
    '<label class="radio-inline"><input type="radio" name="rotation" data-rotation="180">180°</label>',
    '<label class="radio-inline"><input type="radio" name="rotation" data-rotation="270">270°</label>',
    '<div class="option-type quality">{{t "quality"}}:</div>',
    '<label class="radio-inline"><input type="radio" name="quality" data-quality="default" checked><span>default</span></label>',
    '<label class="radio-inline"><input type="radio" name="quality" data-quality="color">color</label>',
    '<label class="radio-inline"><input type="radio" name="quality" data-quality="gray">gray</label>',
    '<label class="radio-inline"><input type="radio" name="quality" data-quality="bitonal">bitonal</label>',
    '<h4 class="options">{{t "preview"}}</h4>',
    '<img id="preview-image">',
    '</div>',
    '<div class="modal-footer">',
    '<button type="button" class="btn btn-default" data-dismiss="modal">{{t "close"}}</button>',
    '</div>',
    '</div>',
    '</div>',
    '</div>'
  ].join('')),

  /* adds the locales to the internationalization module of the viewer */
  addLocalesToViewer: function(){
    for(var language in this.locales){
      i18next.addResources(
        language, 'translation',
        this.locales[language]
      );
    }
  },

  /* adds event handlers to the modal */
  addModalEventHandlers: function(){
    $(document.body).on('click', '#image-cropper-modal #copy-to-clipboard', function(){
      $('#image-cropper-modal #image-url').select();
      document.execCommand('copy');
    });
    $(document.body).on('change', 'input[name="size"], input[name="rotation"], input[name="quality"]', function(event){
      var buttonName = $(event.target).attr('name');
      if(buttonName === 'size'){
        this.imageUrlParams.size = $(event.target).data('size');
      }else if(buttonName === 'rotation'){
        this.imageUrlParams.rotation = $(event.target).data('rotation');
      }else if(buttonName === 'quality'){
        this.imageUrlParams.quality = $(event.target).data('quality');
      }
      $('#image-cropper-modal #image-url').attr(
        'value', this.imageUrlTemplate(this.imageUrlParams)
      ).select();
      $('#image-cropper-modal #preview-image').attr(
        'src', this.imageUrlTemplate($.extend({}, this.imageUrlParams, {'size': '!500,500'}))
      );
    }.bind(this));
  },

  /* converts osd viewport to image coordinates */
  calculateImageCoordinates: function(element, osdViewport){
    var top = parseInt(element.css('top'));
    var left = parseInt(element.css('left'));
    var height = parseInt(element.css('height'));
    var width = parseInt(element.css('width'));

    var webTopLeft = new OpenSeadragon.Point(left, top);
    var webTopRight = new OpenSeadragon.Point(left + width, top);
    var webBottomLeft = new OpenSeadragon.Point(left, top + height);

    var imageTopLeft = osdViewport.viewportToImageCoordinates(
      osdViewport.pointFromPixel(webTopLeft)
    );
    var imageTopRight = osdViewport.viewportToImageCoordinates(
      osdViewport.pointFromPixel(webTopRight)
    );
    var imageBottomLeft = osdViewport.viewportToImageCoordinates(
      osdViewport.pointFromPixel(webBottomLeft)
    );

    return {
      'x': Math.floor(imageTopLeft.x),
      'y': Math.floor(imageTopLeft.y),
      'w': Math.ceil(imageTopRight.x - imageTopLeft.x),
      'h': Math.ceil(imageBottomLeft.y - imageTopLeft.y)
    };
  },

  /* calculates the positions of the given element and the cursor */
  calculatePositions: function(element, event){
    return {
      'element': element.offset(),
      'mouse': { 'top': event.pageY, 'left': event.pageX }
    }
  },

  /* changes the overlay dimensions depending on the resize element */
  changeOverlayDimensions: function(type, mousePosition, offsets, element){
    var newElementHeight = mousePosition.top - offsets.element.top;
    var newElementWidth = mousePosition.left - offsets.element.left;
    if(type === 'right' || type === 'bottom-right'){
      if(newElementWidth >= 32){
        element.css('width', newElementWidth);
      }else{
        this.resizing = false;
      }
    }
    if(type === 'bottom' || type === 'bottom-right'){
      if(newElementHeight >= 32){
        element.css('height', newElementHeight);
      }else{
        this.resizing = false;
      }
    }
  },

  /* checks the position of the overlay */
  checkPosition: function(positions, offsets, overlay, parent){
    var newElementTop = positions.mouse.top - offsets.canvas.top - offsets.mouse.y;
    var newElementLeft = positions.mouse.left - offsets.canvas.left - offsets.mouse.x;
    if(newElementTop < 0){
      newElementTop = 0;
    }
    if(newElementLeft < 0){
      newElementLeft = 0;
    }
    var maxTop = parseInt($(parent).css('height')) - parseInt(overlay.css('height'));
    if(newElementTop + parseInt(overlay.css('height')) > parseInt($(parent).css('height'))){
      newElementTop = maxTop;
    }
    var maxLeft = parseInt($(parent).css('width')) - parseInt(overlay.css('width'));
    if(newElementLeft + parseInt(overlay.css('width')) > parseInt($(parent).css('width'))){
      newElementLeft = maxLeft;
    }
    return { 'top': newElementTop, 'left': newElementLeft};
  },

  /* initializes the plugin */
  init: function(){
    i18next.on('initialized', function(){
      this.addLocalesToViewer();
    }.bind(this));
    this.injectShareButtonEventHandler();
    this.injectButtonToCanvasControls();
    this.injectDraggingEventHandlers();
    this.injectResizingEventHandlers();
    this.injectWindowEventHandler();
    this.injectOverlayToCanvas();
    this.injectModalToDom();
  },

  /* injects the button to the canvas controls */
  injectButtonToCanvasControls: function(){
    var this_ = this;
    var origFunc = Mirador.Hud.prototype.init;
    Mirador.Hud.prototype.init = function(){
      origFunc.apply(this);
      if(this.appendTo.hasClass('image-view')){
        this_.croppingActive = this.state.getStateProperty('activateImageCropping') || false;
        var button = $(this_.buttonTemplate({
          'active': this_.croppingActive
        }));
        button.appendTo(this.appendTo.find('.mirador-osd-context-controls'));
        $('.cropping-toggle', button).click(function(){
          $(this).toggleClass('active');
          $(this).closest('.image-view').find('.cropping-overlay').toggle();
        })
      }
    };
  },

  /* adds some event handlers for dragging purposes */
  injectDraggingEventHandlers: function(){
    var this_ = this;
    var currentPositions;
    var offsets = {};

    var origFunc = Mirador.ImageView.prototype.listenForActions;
    Mirador.ImageView.prototype.listenForActions = function(){
      origFunc.apply(this);
      this.element.on('mousedown', '.cropping-overlay > .resize-frame', function(event){
        if(event.which === 1){
          this_.dragging = true;
          currentPositions = this_.calculatePositions($(this).parent(), event);
          offsets.canvas = $(this).closest('.mirador-osd').offset();
          offsets.mouse = {
            'x': currentPositions.mouse.left - currentPositions.element.left,
            'y': currentPositions.mouse.top - currentPositions.element.top
          };
        }
      }).on('mousemove', '.mirador-osd', function(event){
        if(this_.dragging){
          event.preventDefault();
          var croppingOverlay = $(this).find('.cropping-overlay');
          currentPositions = this_.calculatePositions(croppingOverlay, event);
          var newOverlayPosition = this_.checkPosition(currentPositions, offsets, croppingOverlay, this);
          croppingOverlay.css(newOverlayPosition);
        }
      }).on('mouseup', '.resize-frame', function(){
        this_.dragging = false;
      });
    };
  },

  /* injects the modal to the dom */
  injectModalToDom: function(){
    var this_ = this;
    var origFunc = Mirador.Viewer.prototype.setupViewer;
    Mirador.Viewer.prototype.setupViewer = function(){
      origFunc.apply(this);
      var options = this.state.getStateProperty('imageCropper');
      if($.isPlainObject(options)){
        this_.options = options;
      }
      document.body.insertAdjacentHTML('beforeend', this_.modalTemplate());
    };
    this.addModalEventHandlers();
  },

  /* injects the cropping overlay to the canvas */
  injectOverlayToCanvas: function(){
    var this_ = this;
    var origFunc = Mirador.ImageView.prototype.init;
    Mirador.ImageView.prototype.init = function(){
      origFunc.apply(this);
      var croppingOverlay = $(this_.croppingOverlayTemplate({
        'resizeControls': {
          'anchors': ['bottom-right'],
          'bars': ['right', 'bottom']
        }
      }));
      croppingOverlay.appendTo(this.appendTo.find('.mirador-osd'));
      this_.croppingActive ? croppingOverlay.show() : croppingOverlay.hide();
    };
  },

  /* adds some event handlers for resizing purposes */
  injectResizingEventHandlers: function(){
    var this_ = this;
    var typeOfResizeElement;
    var currentMousePosition;
    var offsets = {};

    var origFunc = Mirador.ImageView.prototype.listenForActions;
    Mirador.ImageView.prototype.listenForActions = function(){
      origFunc.apply(this);
      this.element.on('mousedown', '.resize-anchor, .resize-bar', function(event){
        if(event.which === 1){
          typeOfResizeElement = event.target.className.split(' ').pop();
          this_.resizing = true;
          offsets.canvas = $(this).closest('.mirador-osd').offset();
          offsets.element = $(this).parent().offset();
        }
      }).on('mousemove', '.mirador-osd', function(event){
        if(this_.resizing){
          event.preventDefault();
          var croppingOverlay = $(this).find('.cropping-overlay');
          currentMousePosition = this_.calculatePositions(croppingOverlay, event).mouse;
          this_.changeOverlayDimensions(typeOfResizeElement, currentMousePosition, offsets, croppingOverlay);
        }
      }).on('mouseup', '.resize-anchor, .resize-bar', function(){
        this_.resizing = false;
      });
    };
  },

  /* injects an event handler for the share button */
  injectShareButtonEventHandler: function(){
    var this_ = this;
    var origFunc = Mirador.ImageView.prototype.bindEvents;
    Mirador.ImageView.prototype.bindEvents = function(){
      origFunc.apply(this);
      this.element.on('click', '.cropping-overlay > .share-button', function(event){
        var currentImage = this.imagesList[this.currentImgIndex];
        var service = currentImage.images[0].resource.service || currentImage.images[0].resource.default.service;
        this_.imageUrlParams = {
          'imageBaseUrl': Mirador.Iiif.getImageUrl(currentImage),
          'region': this_.calculateImageCoordinates($(event.target).parent(), this.osd.viewport),
          'size': 'full',
          'rotation': 0,
          'quality': Mirador.Iiif.getVersionFromContext(service['@context']) === '2.0' ? 'default' : 'native'
        };
        $('#image-cropper-modal #image-url').attr(
          'value', this_.imageUrlTemplate(this_.imageUrlParams)
        );
        $('#image-cropper-modal #preview-image').attr(
          'src', this_.imageUrlTemplate($.extend({}, this_.imageUrlParams, {'size': '!500,500'}))
        );
        $($('#image-cropper-modal').find('.quality + label > input')).attr(
          'data-quality', this_.imageUrlParams.quality
        );
        $($('#image-cropper-modal').find('.quality + label > span')).text(
          this_.imageUrlParams.quality
        );
        $('#image-cropper-modal').modal('show');
        $('#image-cropper-modal').on('shown.bs.modal', function(){
          $('#image-cropper-modal #image-url').select();
        });
        $('#image-cropper-modal').on('hidden.bs.modal', function(){
          $($('#image-cropper-modal').find('.option-type + label > input')).prop(
            'checked', true
          );
        });
      }.bind(this));
    };
  }
}

$(document).ready(function(){
  ImageCropper.init();
});
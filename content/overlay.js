var Vimium = {
	init: function() {
		// initialization code
		this.initialized = true;
		document.addEventListener('keydown', Vimium.onKeydown, true);
	},

	keymap: {
		'f': function() { Vimium.activateMode(Vimium.activateCallback, false) },
		'F': function() { Vimium.activateMode(Vimium.activateCallback, true) },
		'yf': function() { Vimium.activateMode(Vimium.copyCallback, 'link') },
		'yy': function() { Vimium.copyCallback(null, 'location'); },
		'j': function() { gBrowser.contentDocument.defaultView.scrollBy(0,19); },
		'k': function() { gBrowser.contentDocument.defaultView.scrollBy(0,-19); },
		'h': function() { gBrowser.contentDocument.defaultView.scrollBy(-19,0); },
		'l': function() { gBrowser.contentDocument.defaultView.scrollBy(19,0); },
		'gg': function() { 
			var doc = gBrowser.contentDocument;
			doc.defaultView.scrollTo(0, 0)
		},
		'G': function() { 
			var doc = gBrowser.contentDocument;
			doc.defaultView.scrollTo(0, doc.body.parentElement.scrollHeight)
		},
	},

	// Vimium
	linkHintCharacters: "sadfjklewcmpgh",
	linkHintCss:
	    '.internalVimiumHintMarker {' +
	      'position:absolute;' +
	      'background-color:yellow;' +
	      'color:black;' +
	      'font-weight:bold;' +
	      'font-size:12px;' +
	      'padding:0 1px;' +
	      'line-height:100%;' +
	      'width:auto;' +
	      'display:block;' +
	      'border:1px solid #E3BE23;' +
	      'z-index:99999999;' +
	      'font-family:"Helvetica Neue", "Helvetica", "Arial", "Sans";' +
	      'top:-1px;' +
	      'left:-1px;' +
	    '}' +
	    '.internalVimiumHintMarker > .matchingCharacter {' +
	      'color:#C79F0B;' +
	    '}',
	  /*
	   * Returns true if element is visible.
	   */
	isVisible: function(element, clientRect) {
		// Exclude links which have just a few pixels on screen, because the link hints won't show for them
		// anyway.
		if (!clientRect || clientRect.top < 0 || clientRect.top >= window.innerHeight - 4 ||
			clientRect.left < 0 || clientRect.left  >= window.innerWidth - 4)
			return false;
		
		if (clientRect.width < 3 || clientRect.height < 3)
			return false;
		
		// eliminate invisible elements (see test_harnesses/visibility_test.html)
		var computedStyle = window.getComputedStyle(element, null);
		if (computedStyle.getPropertyValue('visibility') != 'visible' ||
			computedStyle.getPropertyValue('display') == 'none')
			return false;
		
		return true;
		},
	clickableElementsXPath: (function() {
		var clickableElements = ["a", "area[@href]", "textarea", "button", "select", "input[not(@type='hidden')]",
			"*[@onclick or @tabindex or @role='link' or @role='button']"];
		var xpath = [];
		for (var i in clickableElements)
			xpath.push("//" + clickableElements[i], "//xhtml:" + clickableElements[i]);
		return xpath.join(" | ")
	  })(),
	  /*
	   * Returns all clickable elements that are not hidden and are in the current viewport.
	   * We prune invisible elements partly for performance reasons, but moreso it's to decrease the number
	   * of digits needed to enumerate all of the links on screen.
	   */
	getVisibleClickableElements: function() {
		var doc = gBrowser.contentDocument;
		var resultSet = doc.evaluate(this.clickableElementsXPath, doc.body,
			function(namespace) {
				return namespace == "xhtml" ? "http://www.w3.org/1999/xhtml" : null;
			},
			XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
		
		var visibleElements = [];
		
		// Find all visible clickable elements.
		for (var i = 0, count = resultSet.snapshotLength; i < count; i++) {
			var element = resultSet.snapshotItem(i);
			// Note: this call will be expensive if we modify the DOM in between calls.
			var clientRect = element.getClientRects()[0];
			
			if (this.isVisible(element, clientRect))
				visibleElements.push({element: element, rect: clientRect});
			
			// If the link has zero dimensions, it may be wrapping visible
			// but floated elements. Check for this.
			if (clientRect && (clientRect.width == 0 || clientRect.height == 0)) {
				for (var j = 0, childrenCount = element.children.length; j < childrenCount; j++) {
					var computedStyle = window.getComputedStyle(element.children[j], null);
					// Ignore child elements which are not floated and not absolutely positioned for parent elements with zero width/height
					if (computedStyle.getPropertyValue('float') == 'none' && computedStyle.getPropertyValue('position') != 'absolute')
						continue;
					var childClientRect = element.children[j].getClientRects()[0];
					if (!this.isVisible(element.children[j], childClientRect))
						continue;
					visibleElements.push({element: element.children[j], rect: childClientRect});
					break;
				}
			}
			
			if (element.localName === "area") {
				var map = element.parentNode;
				var img = doc.querySelector("img[usemap='#" + map.getAttribute("name") + "']");
				var clientRect = img.getClientRects()[0];
				var c = element.coords.split(/,/);
				var coords = [parseInt(c[0], 10), parseInt(c[1], 10), parseInt(c[2], 10), parseInt(c[3], 10)];
				var rect = {
					top: clientRect.top + coords[1],
					left: clientRect.left + coords[0],
					right: clientRect.left + coords[2],
					bottom: clientRect.top + coords[3],
					width: coords[2] - coords[0],
					height: coords[3] - coords[1]
				};
				
				visibleElements.push({element: element, rect: rect});
			}
		}
		return visibleElements;
	  },
	buildLinkHints: function() {
		var doc = gBrowser.contentDocument;
		doc.vimium.visibleElements = this.getVisibleClickableElements();
		doc.vimium.hintMarkers = this.getHintMarkers(doc.vimium.visibleElements);
		
		// Note(philc): Append these markers as top level children instead of as child nodes to the link itself,
		// because some clickable elements cannot contain children, e.g. submit buttons. This has the caveat
		// that if you scroll the page and the link has position=fixed, the marker will not stay fixed.
		// Also note that adding these nodes to document.body all at once is significantly faster than one-by-one.
		var hintMarkerContainingDiv = doc.createElement("div");
		hintMarkerContainingDiv.className = "internalVimiumHintMarker";
		for (var i = 0; i < doc.vimium.hintMarkers.length; i++)
			hintMarkerContainingDiv.appendChild(doc.vimium.hintMarkers[i]);
		
		// sometimes this is triggered before documentElement is created
		// TODO(int3): fail more gracefully?
		if (doc.documentElement)
			doc.documentElement.appendChild(hintMarkerContainingDiv);
		else
			Vimium.deactivateMode();
		return(hintMarkerContainingDiv);
	},
	hintUtils: {
	    /*
	     * Make each hint character a span, so that we can highlight the typed characters as you type them.
	     */
	    spanWrap: function(hintString) {
	      var innerHTML = [];
	      for (var i = 0; i < hintString.length; i++)
	        innerHTML.push("<span>" + hintString[i].toUpperCase() + "</span>");
	      return innerHTML.join("");
	    },
	  
	    /*
	     * Creates a link marker for the given link.
	     */
	    createMarkerFor: function(link) {
			var doc = gBrowser.contentDocument;
	      var marker = doc.createElement("div");
	      marker.className = "internalVimiumHintMarker vimiumHintMarker";
	      marker.clickableItem = link.element;
	  
	      var clientRect = link.rect;
	      marker.style.left = clientRect.left + doc.defaultView.scrollX + "px";
	      marker.style.top = clientRect.top  + doc.defaultView.scrollY  + "px";
	  
	      return marker;
	    }
	  },
	logXOfBase: function(x, base) { return Math.log(x) / Math.log(base); },
	getHintMarkers: function(visibleElements) {
	    //Initialize the number used to generate the character hints to be as many digits as we need to highlight
	    //all the links on the page; we don't want some link hints to have more chars than others.
	    var digitsNeeded = Math.ceil(this.logXOfBase(
	          visibleElements.length, this.linkHintCharacters.length));
	    var hintMarkers = [];
	
	    for (var i = 0, count = visibleElements.length; i < count; i++) {
	      var hintString = this.numberToHintString(i, digitsNeeded);
	      var marker = this.hintUtils.createMarkerFor(visibleElements[i]);
	      marker.innerHTML = this.hintUtils.spanWrap(hintString);
	      marker.setAttribute("hintString", hintString);
	      hintMarkers.push(marker);
	    }
	
	    return hintMarkers;
	  },
	numberToHintString: function(number, numHintDigits) {
	    var base = this.linkHintCharacters.length;
	    var hintString = [];
	    var remainder = 0;
	    do {
	      remainder = number % base;
	      hintString.unshift(this.linkHintCharacters[remainder]);
	      number -= remainder;
	      number /= Math.floor(base);
	    } while (number > 0);
	
	    // Pad the hint string we're returning so that it matches numHintDigits.
	    // Note: the loop body changes hintString.length, so the original length must be cached!
	    var hintStringLength = hintString.length;
	    for (var i = 0; i < numHintDigits - hintStringLength; i++)
	      hintString.unshift(this.linkHintCharacters[0]);
	
	    // Reversing the hint string has the advantage of making the link hints
	    // appear to spread out after the first key is hit. This is helpful on a
	    // page that has http links that are close to each other where link hints
	    // of 2 characters or more occlude each other.
	    hintString.reverse();
	    return hintString.join("");
	  },
	addCssToPage: function(css) {
			var doc = gBrowser.contentDocument;
	  var head = doc.getElementsByTagName("head")[0];
	  if (!head) {
	    head = doc.createElement("head");
	    doc.docElement.appendChild(head);
	  }
	  var style = doc.createElement("style");
	  style.type = "text/css";
	  style.appendChild(doc.createTextNode(css));
	  head.appendChild(style);
	},
	
	/*
	 * Input or text elements are considered focusable and able to receieve their own keyboard events,
	 * and will enter enter mode if focused. Also note that the "contentEditable" attribute can be set on
	 * any element which makes it a rich text editor, like the notes on jjot.com.
	 */
	isEditable: function(target) {
	  if (target.isContentEditable)
	    return true;
	  var nodeName = target.nodeName.toLowerCase();
	  // use a blacklist instead of a whitelist because new form controls are still being implemented for html5
	  var noFocus = ["radio", "checkbox", "button", "submit"];
	  if (nodeName == "input" && noFocus.indexOf(target.type) == -1)
	    return true;
	  var active = gBrowser.contentDocument.activeElement;
	  // Gmail kludges
	  if(target.className.indexOf('editable') >= 0)
	    return true;
	  if(active && active.className.indexOf('editable') >= 0)
	    return true;
	  var focusableElements = ["textarea", "select"];
	  return focusableElements.indexOf(nodeName) >= 0;
	},
	// /Vimium
	activateMode: function(callback, arg) {
		var doc = gBrowser.contentDocument;
		if(!doc.cssAdded) {
			this.addCssToPage(this.linkHintCss);
			doc.vimium.cssAdded = true;
		}
		if(!doc.getElementsByClassName('internalVimiumHintMarker').length) {
			doc.vimium.hints = this.buildLinkHints();
			doc.vimium.search = '';
		}
		doc.vimium.active = true;
		doc.vimium.activate_callback = callback;
		doc.vimium.activate_callback_arg = arg;
	},
	deactivateMode: function() {
		var doc = gBrowser.contentDocument;
		if(doc.vimium.hints && doc.vimium.hints.parentNode)
			doc.vimium.hints.parentNode.removeChild(doc.vimium.hints);
		doc.vimium.active = false;
	},
	activateCallback: function(e, newTab) {
		var doc = gBrowser.contentDocument;
		if(Vimium.isEditable(e)) {
			e.focus();
		} else {
			var evt = doc.createEvent("MouseEvents");
			evt.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, newTab, false, false, false, 0, null);
			e.dispatchEvent(evt);
		}
	},
	copyCallback: function(e, target) {
		const gClipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);  
		switch(target) {
			case 'link':
				gClipboardHelper.copyString(e.toString());  
				break;
			case 'location':
				var doc = gBrowser.contentDocument;
				gClipboardHelper.copyString(doc.location);
				break;
		}
	},
	initDoc: function() {
		var vimium = {};
		vimium.cmd_search = '';
		vimium.search = '';
		return(vimium);
	},
	onKeydown: function(e) { 
		var doc = gBrowser.contentDocument;
		var keyChar = String.fromCharCode(e.keyCode).toLowerCase();
		if (e.shiftKey)
			keyChar = keyChar.toUpperCase();
		if( e.altKey )
			return;
		if(!doc.vimium)
			doc.vimium = Vimium.initDoc();
		var active = doc.vimium.active;
		var editable = Vimium.isEditable(e.target);
		if(!active && !editable && e.target.innerHTML && !e.ctrlKey) {
			doc.vimium.cmd_search += keyChar;
			var match, matched = [];
			for(var key in Vimium.keymap) {
				match = key.substr(0, doc.vimium.cmd_search.length) == doc.vimium.cmd_search;
				if(match)
					matched.push(key);
			}
			if(matched.length == 1 && matched[0] == doc.vimium.cmd_search) {
				var action = Vimium.keymap[matched[0]];
				switch(typeof(action)) {
					case "function":
						action();
						break;
					case "string":
						eval(action);
						break;
				}
				doc.vimium.cmd_search = '';
			}
			if(matched.length <= 0)
				doc.vimium.cmd_search = '';
		} else if(e.ctrlKey && e.keyCode == KeyEvent.DOM_VK_OPEN_BRACKET) {
			e.target.blur();
			var active = gBrowser.contentDocument.activeElement;
			if(active)
				active.blur();
			if(doc.body)
				doc.defaultView.focus();
			e.preventDefault();
		} else if(active && e.keyCode == KeyEvent.DOM_VK_ESCAPE) {
			Vimium.deactivateMode();
		} else if(active && e.keyCode == KeyEvent.DOM_VK_BACK_SPACE) {
			doc.vimium.search = doc.vimium.search.substr(0, doc.vimium.search.length-1);
			Vimium.searchHints(doc.vimium.search);
		} else if(active && Vimium.linkHintCharacters.indexOf(keyChar) > -1) {
			doc.vimium.search += keyChar;
			Vimium.searchHints(doc.vimium.search);
			e.preventDefault();
			e.stopPropagation();
		}
	},
	searchHints: function(s) {
		var doc = gBrowser.contentDocument;
		var hints = [];
		for(var i = 0; i < doc.vimium.hintMarkers.length; i++)
			hints.push({marker: doc.vimium.hintMarkers[i], element: doc.vimium.visibleElements[i].element});
		var matched = Array.filter(hints, function(e) {
			var hintstring = e.marker.attributes.hintstring.value;
			var match = hintstring.substr(0, s.length) == s;
			e.marker.style.visibility = match ? "" : "hidden";
			return(match);
		});
		if(matched.length == 1 && matched[0].marker.attributes.hintstring.value == s) {
			doc.vimium.activate_callback(matched[0].element, doc.vimium.activate_callback_arg);
			Vimium.deactivateMode();
		}
		if(matched.length <= 0)
			Vimium.deactivateMode();
	},
};

window.addEventListener("load", function(e) { Vimium.init(); }, false); 

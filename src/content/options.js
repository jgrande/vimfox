function $(x) { return document.getElementById(x) }
var keybindings_pref = document.getElementById('keybindings');
var tree = document.getElementById('tree1');
//alert(keybindings_pref.value);

var prefs = Components.classes["@mozilla.org/preferences-service;1"]
         .getService(Components.interfaces.nsIPrefBranch)
         .QueryInterface(Components.interfaces.nsIPrefBranchInternal);

function validateKeymap(tree) {
	console.log('validateKeymap row='+tree.editingRow);
}
function addRow(tree, cols) {
	var treeitem = document.createElement('treeitem');
	var treerow = document.createElement('treerow');
	for(var i = 0; i < cols.length; i++) {
		var cell = document.createElement('treecell');
		cell.setAttribute('editable', true);
		cell.setAttribute('label', cols[i]);
		treerow.appendChild(cell);
	}
	var treechildren = tree.getElementsByTagName('treechildren')[0];
	treeitem.appendChild(treerow);
	treechildren.appendChild(treeitem);
	tree.view.selection.select(tree.view.rowCount-1);
}
function startEditing(tree) {
	tree.startEditing(tree.view.rowCount-1, tree.columns[0]);
}
function removeCurrentRow(tree) {
	var treechildren = tree.getElementsByTagName('treechildren')[0];
	var cursel = tree.view.selection.currentIndex;
	if(cursel >= 0) {
		var current_child = treechildren.getElementsByTagName('treeitem')[cursel];
		treechildren.removeChild(current_child);
	}
}
function onKeypress(tree, event) {
	switch(event.keyCode) {
		case KeyEvent.DOM_VK_RETURN:
			// onChange seems not being fired for keyboard events
			validateKeymap(tree);
			break;
		case KeyEvent.DOM_VK_TAB:
			// circulating columns in Tk style
			validateKeymap(tree);
			var col = tree.editingColumn.index;
			var row = tree.editingRow;
			col = col + (event.shiftKey ? -1 : 1);
			if(col < 0)
				col = tree.columns.length;
			setTimeout(function() { tree.view.selection.select(row); tree.startEditing(row, tree.columns[col]); }, 0);
			break;
		case KeyEvent.DOM_VK_DELETE:
			if(tree.editingRow == -1)
				removeCurrentRow(tree);
			break;
	}
}

function mapRows(tree, callback) {
	var rows = tree.getElementsByTagName('treerow');
	for(var i = 0; i < rows.length; i++) {
		var cells = rows[i].getElementsByTagName('treecell');
		var labels = Array.map(cells, function(cell) { return(cell.getAttribute('label')) });
		callback(labels, cells);
	}
}
function savePrefs() {
	console.log('savePrefs()');
	// Validating keymap
	var i = 0;
	var err = [];
	var keymap = [];
	mapRows($('tree1'), function(row) {
		i++;
		if(!row[0].length)
			err.push("Void key sequence at " + i.toString());
		keymap.push(row);
	});
	// Validating xpaths
	var xpath = [];
	var dom = document.implementation.createDocument ('http://www.w3.org/1999/xhtml', 'html', null);
	i = 0;
	mapRows($('tree2'), function(row) {
		i++;
		try {
			dom.evaluate('//a', dom.body, null, null, null);
		} catch(error) {
			err.push(error + " at " + i.toString());
		}
		xpath.push(row);
	});
	if(err.length) {
		alert(err.join("\n"));
	} else {
		// Applying settings
		prefs.setCharPref('extensions.vimium.keymap', JSON.stringify(keymap));
		prefs.setCharPref('extensions.vimium.xpath', JSON.stringify(xpath));
	}
}

// Installing handlers
function add_keymap_handler() {
	addRow($('tree1'), ['', '', 'function(doc, api) { }']);
	startEditing($('tree1'));
}
$('add_button_1').addEventListener('command', add_keymap_handler);
function add_xpath_handler() {
	var xpath = $('xpath-input').value;
	if (xpath)
		addRow($('tree2'), [xpath]);
	$('xpath-input').value = "";
}
$('add_button_2').addEventListener('command', add_xpath_handler);
$('tabbox').addEventListener('select', function(e) {
	switch(e.target.selectedItem.id) {
		case "hinting-prefs":
			setTimeout(function() { $('xpath-input').focus(); }, 0);
			break;
		default:
	}
});
window.addEventListener('DOMContentLoaded', function() { 
	var keymap_pref = prefs.getCharPref('extensions.vimium.keymap');
	var keymap_rows = JSON.parse(keymap_pref);
	var xpath_pref = prefs.getCharPref('extensions.vimium.xpath');
	var xpath_rows = JSON.parse(xpath_pref);
	for(var i = 0; i < keymap_rows.length; i++)
		addRow($('tree1'), keymap_rows[i]);
	for(var i = 0; i < xpath_rows.length; i++)
		addRow($('tree2'), xpath_rows[i]);
});

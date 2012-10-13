# VimFox

VimFox is a [Mozilla Firefox](http://www.mozilla.org/firefox/) extension that enables browsing using hints to select links using the keyboard instead of the mouse, and adds a set of well-known VIM key bindings.

It is a fork from [vimium-firefox](http://code.google.com/p/vimium-firefox/), by Valentin Dudouyt. The codebase is pretty much the same, I just added a couple of useful shortcuts and bugfixes.

In its actual state, VimFox is not intended for the public, but it's more like a version of vimium-firefox adjusted to my taste.

# Shortcuts

* `f` - Follow link
* `F` - Follow link in new tab
* `yf` - Copy link
* `yy` - Copy current location
* `Ctrl+[` - Blur from HTML or XUL control
* `gg` - Scroll to top
* `G` - Scroll to bottom
* `h,j,k,l` - Scroll left/up/down/right
* `Ctrl+{d,u}` - Scroll down/up by 20 lines
* `Ctrl+{f,b}` - Scroll down/up by one page

# Building and Installing

Get the source code using Git:

    git clone git@github.com:jgrande/vimfox.git

Build the XPI package

    cd vimfox
    ./build.sh

Install the addon as usual from Firefox, choosing the XPI package that you just created.

# License

Distributed under the [MIT License](http://opensource.org/licenses/mit-license.php).

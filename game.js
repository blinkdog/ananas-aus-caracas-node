// game.js
// @see: http://jsfiddle.net/rotjs/qRnFY/
// @see: http://www.roguebasin.com/index.php?title=Rot.js_tutorial
//
// This version of the code is intended as a soft port to Node.js.
// Minimal modifications to the tutorial code, but some additional
// functions are provided to help Node pretend to be a browser.
//---------------------------------------------------------------------

// grab the ROT library that we'll need
var ROT = require("rot-js");

// helper function provided by CoffeeScript
var indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

// install our browser-shim to help Node pretend to be a browser
(function() {
  // when the program terminates, put the console back the way we found it
  process.on("exit", function() {
    // move cursor to the bottom left corner
	process.stdout.write("\x1b[" + (process.stdout.rows + 1) + ";1H");
	// show the cursor again
	process.stdout.write("\x1b[?25h");
  });
  // during the game, hide the cursor from display
  process.stdout.write("\x1b[?25l");
  // map Node "keypress" events to ROT VK constants
  var KEYCODE_MAP = {
    "return": ROT.VK_RETURN,
    space:    ROT.VK_SPACE,
    pageup:   ROT.VK_PAGE_UP,
    pagedown: ROT.VK_PAGE_DOWN,
    end:      ROT.VK_END,
    home:     ROT.VK_HOME,
    left:     ROT.VK_LEFT,
    up:       ROT.VK_UP,
    right:    ROT.VK_RIGHT,
    down:     ROT.VK_DOWN
  };
  // obtain the keypress library to handle keyboard key press events
  var keypress = require("keypress");
  // initialize an empty list of listeners
  var listeners = [];
  // addEventListener adds to our list of listeners
  window.addEventListener = function(type, listener) {
    // if the listener isn't already on the list
    if ((indexOf.call(listeners, listener) >= 0) === false) {
      // add the listener to the list
      return listeners.push(listener);
    }
  };
  // removeEventListener removes from our list of listeners
  window.removeEventListener = function(type, listener) {
    var listen;
	// get the new list of listeners, excluding the provided one
    return listeners = (function() {
      var i, len, results;
      results = [];
	  // for each listner on the list
      for (i = 0, len = listeners.length; i < len; i++) {
        listen = listeners[i];
		// if it isn't the one we're trying to remove
        if (listen !== listener) {
		  // add it to the list of listeners we keep
          results.push(listen);
        }
      }
	  // return the list of listeners to keep
      return results;
    })();
  };
  // put the keyboard into raw mode, so we can get individual keypress events
  keypress(process.stdin);
  process.stdin.on("keypress", function(ch, key) {
    var event, i, len, listener, results;
	// translate keypress events into a browser-like event
    event = {
      keyCode: KEYCODE_MAP[key.name]
    };
    results = [];
	// for each listener in our list, send the event to them
    for (i = 0, len = listeners.length; i < len; i++) {
      listener = listeners[i];
      if (listener != null) {
        // browsers accept event listener objects, not just functions,
        // so we need to target "handleEvent" if it exists
        if (listener.handleEvent != null) {
          results.push(listener.handleEvent(event));
        } else {
          results.push(listener(event));
        }
      } else {
        results.push(void 0);
      }
    }
    return results;
  });
  process.stdin.setRawMode(true);
  return process.stdin.resume();
})();

//
// Ananas aus Caracas
//

// The tutorial consists of three chapters, which gradually add more
// and more functionality. The game itself is pretty simple: motivated
// by this video, a player needs to find an ananas (pineapple) hidden
// within several boxes in an underground dungeon. It is necessary to
// find the ananas before Pedro (the ananas owner) finds and punishes
// you for sneaking into his warehouse. 

var Game = {
    display: null,
    map: {},
    engine: null,
    player: null,
    pedro: null,
    ananas: null,
    
    init: function() {
        //this.display = new ROT.Display({spacing:1.1});
        this.display = new ROT.Display({layout:"term"});
        document.body.appendChild(this.display.getContainer());
        
        this._generateMap();
        
        var scheduler = new ROT.Scheduler.Simple();
        scheduler.add(this.player, true);
        scheduler.add(this.pedro, true);

        this.engine = new ROT.Engine(scheduler);
        this.engine.start();
    },
    
    _generateMap: function() {
        var digger = new ROT.Map.Digger();
        var freeCells = [];
        
        var digCallback = function(x, y, value) {
            if (value) { return; }
            
            var key = x+","+y;
            this.map[key] = ".";
            freeCells.push(key);
        }
        digger.create(digCallback.bind(this));
        
        this._generateBoxes(freeCells);
        this._drawWholeMap();
        
        this.player = this._createBeing(Player, freeCells);
        this.pedro = this._createBeing(Pedro, freeCells);
    },
    
    _createBeing: function(what, freeCells) {
        var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
        var key = freeCells.splice(index, 1)[0];
        var parts = key.split(",");
        var x = parseInt(parts[0]);
        var y = parseInt(parts[1]);
        return new what(x, y);
    },
    
    _generateBoxes: function(freeCells) {
        for (var i=0;i<10;i++) {
            var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
            var key = freeCells.splice(index, 1)[0];
            this.map[key] = "*";
            if (!i) { this.ananas = key; } /* first box contains an ananas */
        }
    },
    
    _drawWholeMap: function() {
        for (var key in this.map) {
            var parts = key.split(",");
            var x = parseInt(parts[0]);
            var y = parseInt(parts[1]);
            this.display.draw(x, y, this.map[key]);
        }
    }
};

var Player = function(x, y) {
    this._x = x;
    this._y = y;
    this._draw();
}
    
Player.prototype.getSpeed = function() { return 100; }
Player.prototype.getX = function() { return this._x; }
Player.prototype.getY = function() { return this._y; }

Player.prototype.act = function() {
    Game.engine.lock();
    window.addEventListener("keydown", this);
}
    
Player.prototype.handleEvent = function(e) {
    var code = e.keyCode;
    if (code == 13 || code == 32) {
        this._checkBox();
        return;
    }

    var keyMap = {};
    keyMap[38] = 0;
    keyMap[33] = 1;
    keyMap[39] = 2;
    keyMap[34] = 3;
    keyMap[40] = 4;
    keyMap[35] = 5;
    keyMap[37] = 6;
    keyMap[36] = 7;

    /* one of numpad directions? */
    if (!(code in keyMap)) { return; }

    /* is there a free space? */
    var dir = ROT.DIRS[8][keyMap[code]];
    var newX = this._x + dir[0];
    var newY = this._y + dir[1];
    var newKey = newX + "," + newY;
    if (!(newKey in Game.map)) { return; }

    Game.display.draw(this._x, this._y, Game.map[this._x+","+this._y]);
    this._x = newX;
    this._y = newY;
    this._draw();
    window.removeEventListener("keydown", this);
    Game.engine.unlock();
}

Player.prototype._draw = function() {
    Game.display.draw(this._x, this._y, "@", "#ff0");
}
    
Player.prototype._checkBox = function() {
    var key = this._x + "," + this._y;
    if (Game.map[key] != "*") {
        alert("There is no box here!");
    } else if (key == Game.ananas) {
        alert("Hooray! You found an ananas and won this game.");
        Game.engine.lock();
        window.removeEventListener("keydown", this);
		setTimeout(function() { process.exit(0); }, 1000);
    } else {
        alert("This box is empty :-(");
    }
}
    
var Pedro = function(x, y) {
    this._x = x;
    this._y = y;
    this._draw();
}
    
Pedro.prototype.getSpeed = function() { return 100; }
    
Pedro.prototype.act = function() {
    var x = Game.player.getX();
    var y = Game.player.getY();

    var passableCallback = function(x, y) {
        return (x+","+y in Game.map);
    }
    var astar = new ROT.Path.AStar(x, y, passableCallback, {topology:4});

    var path = [];
    var pathCallback = function(x, y) {
        path.push([x, y]);
    }
    astar.compute(this._x, this._y, pathCallback);

    path.shift();
	// <=, in case the player jumps into Pedro's arms (path.length === 0)
    if (path.length <= 1) {
        Game.engine.lock();
        alert("Game over - you were captured by Pedro!");
		setTimeout(function() { process.exit(0); }, 1000);
    } else {
        x = path[0][0];
        y = path[0][1];
        Game.display.draw(this._x, this._y, Game.map[this._x+","+this._y]);
        this._x = x;
        this._y = y;
        this._draw();
    }
}
    
Pedro.prototype._draw = function() {
    Game.display.draw(this._x, this._y, "P", "red");
}    

// in the browser, alert pops up a box,
// but we don't have that luxury on the console.
alert = function(msg) {
	// display the message on the screen
	Game.display.drawText(0, 1, msg);
	// ask the game to redraw everything without the message
	// 1 second later
	setTimeout(function() {
		Game.display.clear();
		Game._drawWholeMap();
		Game.pedro._draw();
		Game.player._draw();
	}, 1000);
};

Game.init();

//---------------------------------------------------------------------
// end of game.js

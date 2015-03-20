var ROT = require("rot-js");

//do ->
//  KEYCODE_MAP =
//    return: 13
//    space: 32
//    pageup: 33
//    pagedown: 34
//    end: 35
//    home: 36
//    left: 37
//    up: 38
//    right: 39
//    down: 40
//
//  keypress = require "keypress"
//  listeners = []
//
//  window.addEventListener = (type, listener) ->
//    if (listener in listeners) is false
//      listeners.push listener
//
//  window.removeEventListener = (type, listener) ->
//    listeners = (listen for listen in listeners when listen isnt listener)
//
//  keypress process.stdin
//
//  process.stdin.on "keypress", (ch, key) ->
//    event =
//      keyCode: KEYCODE_MAP[key.name]
//    for listener in listeners
//      if listener?
//        if listener.handleEvent?
//          listener.handleEvent event
//        else
//          listener event
//
//  process.stdin.setRawMode true
//
//  process.stdin.resume()
  
var indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

(function() {
  process.on("exit", function() {
	process.stdout.write("\x1b[25;1H"); // move cursor
	process.stdout.write("\x1b[?25h"); // show cursor
  });
  process.stdout.write("\x1b[?25l"); // hide cursor
  var KEYCODE_MAP, keypress, listeners;
  KEYCODE_MAP = {
    "return": 13,
    space: 32,
    pageup: 33,
    pagedown: 34,
    end: 35,
    home: 36,
    left: 37,
    up: 38,
    right: 39,
    down: 40
  };
  keypress = require("keypress");
  listeners = [];
  window.addEventListener = function(type, listener) {
    if ((indexOf.call(listeners, listener) >= 0) === false) {
      return listeners.push(listener);
    }
  };
  window.removeEventListener = function(type, listener) {
    var listen;
    return listeners = (function() {
      var i, len, results;
      results = [];
      for (i = 0, len = listeners.length; i < len; i++) {
        listen = listeners[i];
        if (listen !== listener) {
          results.push(listen);
        }
      }
      return results;
    })();
  };
  keypress(process.stdin);
  process.stdin.on("keypress", function(ch, key) {
    var event, i, len, listener, results;
    event = {
      keyCode: KEYCODE_MAP[key.name]
    };
    results = [];
    for (i = 0, len = listeners.length; i < len; i++) {
      listener = listeners[i];
      if (listener != null) {
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

// @see: http://jsfiddle.net/rotjs/qRnFY/

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

alert = function(msg) {
	Game.display.drawText(0, 1, msg);
	setTimeout(function() {
		Game.display.clear();
		Game._drawWholeMap();
		Game.pedro._draw();
		Game.player._draw();
	}, 1000);
};

Game.init();

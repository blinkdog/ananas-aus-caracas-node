// game-node.js
// @see: http://jsfiddle.net/rotjs/qRnFY/
//---------------------------------------------------------------------

// define a utility function that we'll need later on
var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

// acquire some libraries we'll need
var keypress = require("keypress");
var ROT = require("rot-js");

// when the program terminates, put the console back the way we found it
process.on("exit", function() {
	// move cursor to the bottom left corner
	process.stdout.write("\x1b[" + (process.stdout.rows + 1) + ";1H");
	// show the cursor again
	process.stdout.write("\x1b[?25h");
});
// during the game, hide the cursor from display
process.stdout.write("\x1b[?25l");

// put the keyboard into raw mode, so we can get individual keypress events
keypress(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();

// add a handler to list for "quit game" commands
process.stdin.on("keypress", function(ch, key) {
	// if the user pressed Ctrl+C or ESC
	if(ch === "\u0003" || ch === "\u001b" ) {
		// then quit the game
		process.exit(0);
	}
});

// Ananas aus Caracas
var Game = {
    display: null,
    map: {},
    engine: null,
    player: null,
    pedro: null,
    ananas: null,
    
    init: function() {
        // create a display to match our console
        this.display = new ROT.Display({
			width: process.stdout.columns,
			height: process.stdout.rows,
			layout: "term"
		});
        
        this._generateMap();
        
        var scheduler = new ROT.Scheduler.Simple();
        scheduler.add(this.player, true);
        scheduler.add(this.pedro, true);

        this.engine = new ROT.Engine(scheduler);
        this.engine.start();
    },

    // display a message for the user
	showMessage: function(message) {
		// draw the message in the upper left corner, in yellow
		this.display.drawText(0, 1, ("%c{#ff0}" + message));
		// after 1 second, redraw the map, player, and pedro
		// in order to clear the message from the display
		// and don't forget to bind "this", so we can still
		// reference it from the timeout context
		setTimeout(bind(function() {
			this.display.clear();
			this._drawWholeMap();
			this.player._draw();
			this.pedro._draw();
		}, this), 1000);
	},
	
    _generateMap: function() {
		// generate a map that will fit on our console
		var width = process.stdout.columns;
		var height = process.stdout.rows;
        var digger = new ROT.Map.Digger(width, height);
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
            if (!i) { this.ananas = key; } // first box contains an ananas
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
	// bind the handleEvent function to the Player object, so that
	// when it is called from process.stdin.on("keypress", ...)
	// it will always treat the Player as the 'this' object
    this.handleEvent = bind(this.handleEvent, this);
    this._x = x;
    this._y = y;
    this._draw();
}
    
Player.prototype.getSpeed = function() { return 100; }
Player.prototype.getX = function() { return this._x; }
Player.prototype.getY = function() { return this._y; }

Player.prototype.act = function() {
    Game.engine.lock();
	process.stdin.on("keypress", this.handleEvent);
}

Player.prototype.handleEvent = function(ch, key) {
	// if we didn't get a reasonable key object, bail out
	if (typeof key === "undefined" || key === null) { return; }
	// determine the name of the pressed key
	var name = key.name;
	// if it didn't have a name, bail out
	if (typeof name === "undefined" || name === null) { return; }
	
	// if the user hit the space bar or the enter key
    if (name === "space" || name === "return") {
		// check to see if the box has an ananas
        this._checkBox();
        return;
    }

	// otherwise, let's see where the player wants to move
    var keyMap = {};
    keyMap["up"] = 0;
    keyMap["pageup"] = 1;
    keyMap["right"] = 2;
    keyMap["pagedown"] = 3;
    keyMap["down"] = 4;
    keyMap["end"] = 5;
    keyMap["left"] = 6;
    keyMap["home"] = 7;

    // one of numpad directions?
    if (!(name in keyMap)) { return; }

    // is there a free space?
    var dir = ROT.DIRS[8][keyMap[name]];
    var newX = this._x + dir[0];
    var newY = this._y + dir[1];
    var newKey = newX + "," + newY;
    if (!(newKey in Game.map)) { return; }

    Game.display.draw(this._x, this._y, Game.map[this._x+","+this._y]);
    this._x = newX;
    this._y = newY;
    this._draw();
	process.stdin.removeListener("keypress", this.handleEvent);
    Game.engine.unlock();
}

Player.prototype._draw = function() {
    Game.display.draw(this._x, this._y, "@", "#ff0");
}
    
Player.prototype._checkBox = function() {
    var key = this._x + "," + this._y;
    if (Game.map[key] != "*") {
        Game.showMessage("There is no box here!");
    } else if (key == Game.ananas) {
        Game.showMessage("Hooray! You found an ananas and won this game.");
        Game.engine.lock();
		process.stdin.removeListener("keypress", this.handleEvent);
		setTimeout(function() { process.exit(0); }, 750);
    } else {
        Game.showMessage("This box is empty :-(");
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
        Game.showMessage("Game over - you were captured by Pedro!");
		setTimeout(function() { process.exit(0); }, 750);
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

Game.init();

//---------------------------------------------------------------------
// end of game-node.js

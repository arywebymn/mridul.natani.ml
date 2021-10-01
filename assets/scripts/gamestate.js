/*jshint esversion: 6 */
/*
 * Game states are:
 *    PAUSED - Game logic and interaction suspended
 *    TRAINING - Player can move around the map to learn it's layout
 *    PLAYING - Player is given objects to find in the map
 */
const gamestates = {
  PAUSED: "paused",
  TRAINING: "training",
  PLAYING: "playing",
  WON: "won"
};
const gamedifficulty = {
  EASY: "easy",       //Minimap and objects visible during play.
  NORMAL: "normal",   //Minimap visible during play.
  HARD: "hard"        //Minimap and objects hidden during play.
};

/*
 * Controls game state and impliments game logic
 */
function GameState(gameCanvas, mapTemplate) {
  //Get the canvas for the main game screen
  this.gameCanvas = gameCanvas;
  this.gameContext = gameCanvas.getContext("2d");

  this.map = null;
  this.player = null;
  this.lastFrameTime = 0;
  this.thisFrameTime = 0;

  this.playStartTime = 0;
  this.pauseStartTime = 0;
  this.winTime = 0;

  this.gameClock = new Clock(0);

  this.goalList = null;
  this.currentGoal = 0;

  //Default to paused state.
  this.state = gamestates.PAUSED;
  this.lastState = gamestates.TRAINING;
  //Default to easy difficulty.
  this.difficulty = gamedifficulty.EASY;
  //Maps current user commands
  this.inputMap = {
    //Look controls
    turnLeft: {down: false, up: false},
    turnRight: {down: false, up: false},
    //Move controls
    left: {down: false, up: false},
    right: {down: false, up: false},
    up: {down: false, up: false},
    down: {down: false, up: false},
    //Object interaction controls
    interact: {down: false, up: false},
    //Game Controls
    pause: {down: false, up: false},
  };
  //Create key map
  this.keyMap = new Map();
  this.setupDefaultKeys();

  //Map of in game hint messages
  this.messageMap = {
    wrongObject:  { //ID and current visiblity state
                    name: "wrongObject", show: false,
                    //When message was shown and time out in ms
                    start: 0, time: 2000,
                    //Message
                    message: "This is not the object you are looking for!",
                    //Gameplay hint
                    hint: "" },

    notPlaying:   { name: "notPlaying", show: false,
                    start: 0, time: 4000,
                    message: "The game hasn't started yet!",
                    hint: "Select play from the menu to start game"},

    //more here as needed
  };
  this.currentMessage = null;
  //Styling parameters for various game elements
  this.styling = {
    titleFont: "75px Permanent Marker", titleColor: "white",
    largeFont: "50px Permanent Marker", largeColor: "white",
    messageFont: "25px Permanent Marker", messageColor: "white",
    hintFont: "15px Permanent Marker", hintColor: "white",
  };

  this.setupGame(mapTemplate);
}

/*
 * Setsup initial game state and objects
 */
GameState.prototype.setupGame = function (mapTemplate) {
  let aspectRatio = (this.gameCanvas.width / this.gameCanvas.height);
  //Create game objects
  this.map = new RayMap2(mapTemplate, wallDefs);
  this.player = new Player( this,
                            this.map,
                            3.0,    //Movement speed (world units per-second)
                            3.0,    //Turning speed (radians per-second)
                            0.2,    //Player object radius (world units)
                            1.0,    //Interaction distance (world units)
                            aspectRatio); //FOV in radians

    for (let i = 0; i < objectDefs.length; i++) {
      let tmp = new GameObject(this.map, objectDefs[i]);
    }

    this.setupGoals();
};

/*
 * Keyboard input
 *  IMPROVEMENT: Move user input to a dedicated generalised class
 */
/*
 * Creates the default keybindings
 */
GameState.prototype.setupDefaultKeys = function() {
  //WSAD movement
  this.keyMap.set("KeyW", "up");
  this.keyMap.set("KeyS", "down");
  this.keyMap.set("KeyZ", "left");
  this.keyMap.set("KeyX", "right");
  this.keyMap.set("KeyA", "turnLeft");
  this.keyMap.set("KeyD", "turnRight");
  //Arrow key movement
  this.keyMap.set("ArrowUp", "up");
  this.keyMap.set("ArrowDown", "down");
  this.keyMap.set("ArrowLeft", "turnLeft");
  this.keyMap.set("ArrowRight", "turnRight");
  //Interaction
  this.keyMap.set("KeyE", "interact");
  this.keyMap.set("Space", "interact");
  //Game state
  this.keyMap.set("KeyP", "pause");
};
//Handles window keydown event
GameState.prototype.keyDown = function(event) {
  let key = this.keyMap.get(event.code);
  if (key) {
    this.inputMap[key].down = true;
    this.inputMap[key].up = false;
  }
};
//Handles window keyup event
GameState.prototype.keyUp = function(event) {
  let key = this.keyMap.get(event.code);
  if (key) {
    this.inputMap[key].down = false;
    this.inputMap[key].up = true;
  }
};

/*
 * Clears all objects and resets the game state
 */
GameState.prototype.reset = function() {
  this.setupGame(normalMap);
  this.currentMessage = null;

  this.playStartTime = 0;
  this.pauseStartTime = 0;
  this.winTime = 0;

  this.state = gamestates.PAUSED;
  this.lastState = gamestates.TRAINING;
};

GameState.prototype.resetPlayerPosition = function() {
  //This should be performed by the player class...
  this.player.position.x = this.map.playerSpawn.position.x;
  this.player.position.y = this.map.playerSpawn.position.y;
  this.player.direction.x = this.map.playerSpawn.vector.x;
  this.player.direction.y = this.map.playerSpawn.vector.y;
};

/*
 * Populates the goals array with available objects in random order
 */
GameState.prototype.setupGoals = function() {
  //Copy objects list from map
  this.goalList = this.map.objects.slice();
  //Randomly reorder list
  this.goalList = shuffle(this.goalList);
  //Make sure we're starting at the first goal...
  this.currentGoal = 0;
};

/*
 * Prefered method of setting the game into the playing state
 */
GameState.prototype.playStart = function() {
  //Can't start playing if already playing
  if (this.state != gamestates.PLAYING) {
    //Log the play start time
    this.playStartTime = performance.now();
    //Set us to playing
    this.state = gamestates.PLAYING;
    //Ensure the player is starts at the player spawn point
    this.resetPlayerPosition();
  }
};

 /*
  * Toggles the pause condition
  */
GameState.prototype.togglePause = function() {
  if (this.state === gamestates.PAUSED) this.unpause();
  else this.pause();
};
//If paused unpauses the game
GameState.prototype.unpause = function () {
  if (this.state === gamestates.PAUSED) {
    this.state = this.lastState;
    //If playing we need to adjust the start time to account for time paused
    if (this.state === gamestates.PLAYING) {
      this.playStartTime += performance.now() - this.pauseStartTime;
    }
  }
};
//Pauses the game if it's not already paused or win condition
GameState.prototype.pause = function () {
  if (this.state != gamestates.PAUSED && this.state != gamestates.WON) {
    this.lastState = this.state;
    this.state = gamestates.PAUSED;
    this.pauseStartTime = performance.now();
  }
};

/*
 * Called when victory condition detected
 */
GameState.prototype.playEnd = function() {
  //Can't win if not playing...
  if (this.state === gamestates.PLAYING) {
    this.winTime = performance.now() - this.playStartTime;
    this.state = gamestates.WON;
    this.gameClock.time = this.winTime;
  }
};

/*
 * Returns true if in the middle of a game (even if paused)
 */
GameState.prototype.playing = function () {
  //Pretty inelegant - needs improvement
  switch (this.state) {
    case gamestates.PLAYING:
      return true;
    case gamestates.TRAINING:
      return false;
    case gamestates.PAUSED:
      if (this.lastState === gamestates.PLAYING) return true;
      else return false;
      break;
    case gamestates.WON:
      return true;
  }
};

/*
 * Called when the player requests an object interaction.
 * Sets up game state based on victory conditions. If the player has satisfied
 * the current goal condition, moves to the next goal. If the current goal was
 * the final goal, sets victory condition and win state.
 */
GameState.prototype.goalCheck = function (obj) {
  //Are we currently in the playing state?
  if (this.state === gamestates.PLAYING) {
    //Is this the current goal object?
    if (obj === this.goalList[this.currentGoal]) {
      //This is the current goal object. Move to the next goal.
      this.currentGoal++;
      //Is this the final goal object?
      if (this.currentGoal >= this.goalList.length)
      {
        /*Ensures currentGoal never points beyond end of goalList.
          Fixes a bug on play restart where draw refresh could cause
          a race condition where window draw could begin before
          currentGoal was reset.*/
        this.currentGoal = this.goalList.length - 1;
        this.playEnd();
      }
      //Valid object interaction
      return true;
    } else {
      //Tell the player this is the wrong object
      this.showHintMessage(this.messageMap.wrongObject.name);
    }
  } else {
    //Tell the player the game hasn't started yet
    this.showHintMessage(this.messageMap.notPlaying.name);
  }
  return false;
};

/*
 * Sets whether a hint message should be shown
 */
GameState.prototype.showHintMessage = function (message) {

  if (message != this.currentMessage) {
    this.messageMap[message].show = true;
    this.messageMap[message].start = performance.now();
    //Ensure only one hint message is set as visible at a time.
    if (this.currentMessage != null)
      this.messageMap[this.currentMessage].show = false;

    this.currentMessage = message;
  }
};

/*
 * Update step of the game cycle. Updates the game and game object state
 */
GameState.prototype.update = function (frameTime) {
  //If not paused or complete, react to user commands and run game state
  if (this.state != gamestates.PAUSED && this.state != gamestates.WON) {
    //User input handling
    if (this.inputMap.turnLeft.down) {
      this.player.turnLeft(frameTime);
    }
    if (this.inputMap.turnRight.down) {
      this.player.turnRight(frameTime);
    }

    //Player movement
    if (this.inputMap.up.down) {
      this.player.moveForward(frameTime);
    }
    if (this.inputMap.down.down) {
      this.player.moveBack(frameTime);
    }
    if (this.inputMap.left.down) {
      this.player.moveLeft(frameTime);
    }
    if (this.inputMap.right.down) {
      this.player.moveRight(frameTime);
    }

    if (this.inputMap.interact.up) {
      this.player.interact(frameTime);
      this.inputMap.interact.up = false;
    }
  }

  if (this.state === gamestates.PLAYING) {
    this.gameClock.time = performance.now() - this.playStartTime;
  }

  //Keyboard pause control
  if (this.inputMap.pause.up) {
    this.togglePause();
    this.inputMap.pause.up = false;
  }
};

/*
 * Drawing functions
 *  IMPROVEMENT: Many of these methods would probably be better
 *               off as a generalised helper class
 */

/*
 * These functions start and ends the game frame. Logs frame time for metrics
 * and frame rate independent animation.
 */
GameState.prototype.frameStart = function (time) {
  this.thisFrameTime = time - this.lastFrameTime;
  return this.thisFrameTime;
};
GameState.prototype.frameEnd = function (time) {
  this.lastFrameTime = time;
};

/*
 * Draws the "3d" world
 */
GameState.prototype.drawScene = function (time) {
  //Prepare rendering state
  this.player.setFOV(this.gameCanvas.width / this.gameCanvas.height);
  //Render player view
  this.player.drawScene(this.gameCanvas);
};

/*
 * Calculates the x position to render the text passed centered horizontally
 */
GameState.prototype.centerTextHorizontal = function (ctx, text) {
  let txtMetric = ctx.measureText(text);
  return ((this.gameCanvas.width / 2) - (txtMetric.width / 2));
};
/*
 * Calculates the y position to render the text passed centered vertically
 */
GameState.prototype.centerTextVertical = function (ctx, text) {
  let txtMetric = ctx.measureText(text);
  return ((this.gameCanvas.height / 2) -
          ((txtMetric.actualBoundingBoxAscent +
          txtMetric.actualBoundingBoxDescent) / 2));
};

GameState.prototype.drawOutlineText = function (ctx, text, x, y) {
  ctx.fillText(text, x, y);
  ctx.strokeText(text, x, y);
};

/*
 * Draws a single hint message
 */
GameState.prototype.drawHintMessages = function (ctx) {
  let x = 0, y = 0;

  for (const property in this.messageMap) {
    //Is this message being shown?
    if (this.messageMap[property].show) {
      //Calculate time when message expires
      let t = this.messageMap[property].start + this.messageMap[property].time;
      //Has message expired?
      if (t > performance.now()) {
        //Message
        ctx.font = this.styling.messageFont;
        ctx.fillStyle = this.styling.messageColor;
        ctx.strokeStyle = "black";

        //Calculate text x,y to centre text on screen
        x = this.centerTextHorizontal(ctx, this.messageMap[property].message);
        y = this.centerTextVertical(ctx, this.messageMap[property].message);

        this.drawOutlineText(ctx, this.messageMap[property].message, x, y);

        //Hint
        //Move y down below previous text
        y += Math.abs(y - (this.gameCanvas.height / 2)) * 2;

        ctx.font = this.styling.hintFont;
        ctx.fillStyle = this.styling.hintColor;

        //Centre hint horizontally
        x = this.centerTextHorizontal(ctx, this.messageMap[property].hint);

        this.drawOutlineText(ctx, this.messageMap[property].hint, x, y);

      } else {
        //message has expired
        this.messageMap[property].show = false;
        this.currentMessage = null;
      }
      //only one message should be shown at a time
      break;
    }
  }
};

/*
 * Draws 2D overlay elements. Minimap, messages, game text etc.
 */
GameState.prototype.drawOverlay = function (time) {
  let ctx = this.gameContext;
  let message = "";
  let x = 0, y = 0;

  this.drawMiniMap(this.gameCanvas.width - 175, 25, 0.35);

  //State specific messages
  switch (this.state) {
    case gamestates.PAUSED:
      ctx.font = this.styling.largeFont;
      ctx.fillStyle = this.styling.largeColor;

      ctx.strokeStyle = "black";

      message = "PAUSED!";
      x = this.centerTextHorizontal(ctx, message);
      y = this.centerTextVertical(ctx, message);
      this.drawOutlineText(ctx, message, x, y);
      break;

    case gamestates.TRAINING:
      ctx.font = this.styling.messageFont;
      ctx.fillStyle = this.styling.messageColor;
      ctx.strokeStyle = "black";

      this.drawOutlineText(ctx, "Explore the maze", 25, 25);
      break;

    case gamestates.PLAYING:
      //Draw icon of current goal
      ctx.drawImage(this.goalList[this.currentGoal].icon, 25, 25);

      //Goal name
      ctx.font = this.styling.hintFont;
      ctx.fillStyle = this.styling.hintColor;
      ctx.strokeStyle = "black";

      message = "Pick up the " + this.goalList[this.currentGoal].name;
      this.drawOutlineText(ctx, message, 25, 100);

      break;

    case gamestates.WON:
      ctx.font = this.styling.largeFont;
      ctx.fillStyle = this.styling.largeColor;
      ctx.strokeStyle = "black";

      message = "You completed the maze!";
      //Calculate text x,y to centre text on screen
      x = this.centerTextHorizontal(ctx, message);
      y = this.centerTextVertical(ctx, message);

      this.drawOutlineText(ctx, message, x, y);

      message = "Your time was: " + this.gameClock.minutes() +
                 ":" + String(this.gameClock.seconds()).padStart(2, '0');

      x = this.centerTextHorizontal(ctx, message);
      y += Math.abs(y - (this.gameCanvas.height / 2)) * 2;
      this.drawOutlineText(ctx, message, x, y);
      break;
  }

  //Messaging
  this.drawHintMessages(ctx);
};

/*
 * Draws the minimap
 * IMPROVMENT: Get color values from settings rather than hard coded.
 */
GameState.prototype.drawMiniMap = function(x, y, alpha) {
  //Only draw the map if we're not playing in hard difficulty
  if ( !(this.state === gamestates.PLAYING && this.difficulty === gamedifficulty.HARD) ) {
    let ctx = this.gameContext;
    let map = this.map;
    let player = this.player;

    //Draw map geometry
    for (let tY = 0; tY < map.height; tY++) {
      for (let tX = 0; tX < map.width; tX++) {
        if (map.map[tY][tX] === 0) ctx.fillStyle = "rgba(0,0,0,"+alpha+")";
        else ctx.fillStyle = "rgba(0,255,0,"+alpha+")";

        ctx.fillRect((tX*10) + x, (tY*10) + y, 10, 10);
      }
    }

    //Only Draw object positions when playing on easy
    if ((this.state != gamestates.PLAYING) || (this.difficulty === gamedifficulty.EASY)) {
      ctx.fillStyle = "blue";
      for (let i = 0; i < map.objects.length; i++) {
        let oX = Math.floor(map.objects[i].position.x * 10) + x;
        let oY = Math.floor(map.objects[i].position.y * 10) + y;
        ctx.beginPath();
        ctx.arc(oX, oY, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    //Draw player position
    ctx.beginPath();
    let pX = Math.floor(player.position.x * 10) + x;
    let pY = Math.floor(player.position.y * 10) + y;
    let vX = Math.floor(pX + (player.direction.x * 8));
    let vY = Math.floor(pY + (player.direction.y * 8));
    ctx.fillStyle = "red";
    ctx.arc(pX, pY, 3, 0, 2 * Math.PI);
    ctx.fill();
    //Draw player Vector
    ctx.strokeStyle = "red";
    ctx.beginPath();
    ctx.moveTo(pX, pY);
    ctx.lineTo(vX, vY);
    ctx.stroke();
  }
};

/*jshint esversion: 6 */
/*
 * Defines an objects position and facing in the map
 */
function MapLocation2(pX = 0, pY = 0, dX = 0, dY = 0) {
  this.position = new Point2(pX,pY);
  this.vector = new Vector2(dX, dY);
}

/*
 * Stores information on a single wall type
 */
function Wall(template) {
  this.name = template.name;
  this.texture = new Image();
  this.texture.src = imagePath + template.texture;
  //Not really needed currently, but could make doors possible in future?
  this.passable = template.passable;
  this.transparent = template.transparent;
}

/*
 * Models a 2d map that can be raytraced.
 * Generates the map data from a template passed.
 */
function RayMap2(template, walls) {
  //Map geometry
  this.width = template.width;
  this.height = template.height;

  this.map = new Array(this.height);

  //Iterates through each template cell and fills out map information
  for (let y = 0; y < this.height; y++) {
    this.map[y] = new Array(this.width);

    for (let x = 0; x < this.width; x++) {
      this.map[y][x] = template.map[y][x];
    }
  }

  //Wall types
  this.walls = [];//new Array();
  for (let i = 0; i < walls.length; i++) {
    this.walls.push(new Wall(walls[i]));
  }

  //Map player spawn point
  this.playerSpawn = new MapLocation2(template.pSpawn[0],   //Position X
                                      template.pSpawn[1],   //Position Y
                                      template.pSpawn[2],   //Vector X
                                      template.pSpawn[3]);  //Vector Y
  //Map object spawn points
  this.objectSpawns = new Array(template.objects);
  for (let i = 0; i < template.objects; i++) {
      this.objectSpawns[i] = new MapLocation2(template.oSpawn[i][0],
                                              template.oSpawn[i][1]);
  }
  //List of objects on the map
  this.objects = [];//new Array();
}

/*
 * Returns true if tile is within map bounds.
 */
RayMap2.prototype.inBounds = function (x, y) {
  return (x >= 0 && y >= 0 && x < this.width && y < this.height);
};

/*
 * Returns the tile type at x,y
 */
RayMap2.prototype.getMapTile = function (x, y) {
  if (this.inBounds(x, y)) {
    return this.map[y][x];
  } else {
    //out of bounds just returns empty space.
    return 0;
  }
};

/*
 * Returns whether a tile at x,y can be traversed
 */
RayMap2.prototype.getTilePassable = function (x, y) {
  let wallType = this.getMapTile(x,y);
  if (wallType === 0) {
    return true;
  } else {
    return this.walls[wallType - 1].passable;
  }
};

/*
 * Adds an object to the map and returns it's location.
 * If no spawn points are available it returns null.
 */
RayMap2.prototype.addObject = function (obj) {
  //Is there an available spawn point for this object?
  if (this.objects.length < this.objectSpawns.length) {
    this.objects.push(obj);
    return this.objectSpawns[this.objects.length - 1];
  }
  return null;
};

/*
 * Returns any object in the tile passed.
 * This is a fairly brute force approach of checking every object on the map.
 * It also assumes only one object can be on a tile at a time.
 */
RayMap2.prototype.getObjects = function (x, y) {
  if (this.inBounds(x, y)) {
    //Iterate through objects and check if they're on this tile.
    for (let i = 0; i < this.objects.length; i++) {
      if ( Math.floor(this.objects[i].position.x) === x &&
           Math.floor(this.objects[i].position.y) === y) {
        return this.objects[i];
      }
    }
  }
  //If not in bounds or no object return null
  return null;
};

/*
 * Returns any object within a given range of the point passed
 */
RayMap2.prototype.getObjectsInRange = function (origin, range) {
  let distance = 0;
  //No need for bounds check, it doesn't matter if the origin is outside of the map
  //Check each objects in list
  for (let i = 0; i < this.objects.length; i++) {
    //Calculate the distance between the origin point and the object
    distance = origin.distanceToPoint(this.objects[i].position);
    //If the distance lower than the range given, return object
    if (distance <= range) return this.objects[i];
  }
  //if no object in range return null
  return null;
};

/*
 * Returns the wall definition at point passed
 */
RayMap2.prototype.getWallType = function (x, y) {
  let wallType = this.getMapTile(x,y);
  if (wallType === 0) {
    return null;  //Empty space has no type
  } else {
    return this.walls[wallType - 1];
  }
};
 //More functions here as needed:

import Phaser from 'phaser';

// Game configuration constants
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const GROUND_Y = 500;
export const SKY_HEIGHT = GROUND_Y;

// Player zones
export const PLAYER1_ZONE = { min: 50, max: 350 };
export const PLAYER2_ZONE = { min: 450, max: 750 };

// Bomb positions
export const BOMB_POSITIONS = {
  player1: { x: 200, y: 450 },
  player2: { x: 600, y: 450 }
};

// Physics constants
export const GRAVITY = 400;
export const WIND_MIN = -15;
export const WIND_MAX = 15;

// Bomb structure
export const BOMB_QUADRANT_HP = 100;
export const BOMB_CORE_HP = 150;
export const BOMB_RADIUS = 30;
export const BOMB_CORE_RADIUS = 12;

// Game timing
export const SETUP_TIME = 30;
export const REARRANGE_TIME = 10;
export const SHOTS_PER_TURN = 3;

// Phaser game configuration
export const gameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#87CEEB',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: GRAVITY },
      debug: false
    }
  },
  scene: [] // Scenes will be added in main.js
};

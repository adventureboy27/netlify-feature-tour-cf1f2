import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { SetupScene } from './scenes/SetupScene.js';
import { CombatScene } from './scenes/CombatScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

// Add all scenes to the game configuration
gameConfig.scene = [
  BootScene,
  MenuScene,
  SetupScene,
  CombatScene,
  GameOverScene
];

// Create and start the game
const game = new Phaser.Game(gameConfig);

// Export game instance for debugging if needed
window.game = game;

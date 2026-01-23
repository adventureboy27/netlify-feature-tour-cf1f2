import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Create a simple particle texture
    const graphics = this.add.graphics();
    graphics.fillStyle(0xFFFFFF);
    graphics.fillCircle(8, 8, 8);
    graphics.generateTexture('particle', 16, 16);
    graphics.destroy();

    // Loading text
    const loadingText = this.add.text(400, 300, 'Loading...', {
      fontSize: '32px',
      fill: '#fff'
    }).setOrigin(0.5);
  }

  create() {
    // Move to menu scene
    this.scene.start('MenuScene');
  }
}

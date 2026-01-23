import Phaser from 'phaser';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(data) {
    const { winner, winnerNum } = data;

    // Background
    this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8);

    // Victory banner
    const bannerColor = winnerNum === 1 ? '#FF0000' : '#0000FF';
    const banner = this.add.rectangle(400, 150, 700, 120, Phaser.Display.Color.HexStringToColor(bannerColor).color);
    banner.setStrokeStyle(5, 0xFFD700);

    // Winner text
    this.add.text(400, 120, 'VICTORY!', {
      fontSize: '48px',
      fill: '#FFD700',
      stroke: '#000',
      strokeThickness: 8,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(400, 180, `${winner} Wins!`, {
      fontSize: '36px',
      fill: '#fff',
      stroke: '#000',
      strokeThickness: 6
    }).setOrigin(0.5);

    // Completion notification
    this.showCompletionNotification(winner);

    // Trophy emoji
    this.add.text(400, 280, '🏆', {
      fontSize: '80px'
    }).setOrigin(0.5);

    // Stats or message
    this.add.text(400, 380, 'The enemy bomb has been destroyed!\nYour junkyard fortress prevails!', {
      fontSize: '20px',
      fill: '#fff',
      align: 'center',
      lineSpacing: 10
    }).setOrigin(0.5);

    // Play again button
    const playAgainButton = this.add.rectangle(400, 480, 200, 50, 0x00FF00);
    playAgainButton.setStrokeStyle(3, 0x000000);

    const playAgainText = this.add.text(400, 480, 'PLAY AGAIN', {
      fontSize: '24px',
      fill: '#000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    playAgainButton.setInteractive();
    playAgainButton.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });

    playAgainButton.on('pointerover', () => {
      playAgainButton.setFillStyle(0x00DD00);
    });

    playAgainButton.on('pointerout', () => {
      playAgainButton.setFillStyle(0x00FF00);
    });

    // Celebration particles
    this.createCelebrationEffect();
  }

  showCompletionNotification(winner) {
    // Visual notification
    const notification = this.add.container(400, 50);

    const notifBg = this.add.rectangle(0, 0, 400, 60, 0x00FF00, 0.95);
    notifBg.setStrokeStyle(3, 0xFFD700);

    const notifIcon = this.add.text(-180, 0, '✓', {
      fontSize: '32px',
      fill: '#fff'
    }).setOrigin(0.5);

    const notifText = this.add.text(0, 0, `Game Complete! ${winner} is victorious!`, {
      fontSize: '18px',
      fill: '#000',
      fontStyle: 'bold',
      wordWrap: { width: 340 }
    }).setOrigin(0.5);

    notification.add([notifBg, notifIcon, notifText]);

    // Animate notification
    notification.setAlpha(0);
    notification.y = 20;

    this.tweens.add({
      targets: notification,
      alpha: 1,
      y: 50,
      duration: 500,
      ease: 'Back.out'
    });

    // Browser notification (if permission granted)
    this.requestNotificationPermission(winner);
  }

  requestNotificationPermission(winner) {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    // Check notification permission
    if (Notification.permission === 'granted') {
      this.sendNotification(winner);
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          this.sendNotification(winner);
        }
      });
    }
  }

  sendNotification(winner) {
    try {
      const notification = new Notification('Junkyard Bomb Defense War', {
        body: `Game Complete! ${winner} has won the battle!`,
        icon: '🏆',
        tag: 'game-complete',
        requireInteraction: false
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.log('Notification error:', error);
    }
  }

  createCelebrationEffect() {
    // Create confetti particles
    const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF];

    for (let i = 0; i < 6; i++) {
      const x = 100 + i * 120;

      const particles = this.add.particles(x, -20, 'particle', {
        speed: { min: 100, max: 200 },
        angle: { min: 60, max: 120 },
        scale: { start: 1, end: 0.5 },
        tint: colors[i],
        lifespan: 3000,
        gravityY: 150,
        frequency: 100,
        quantity: 2
      });

      // Stop after 5 seconds
      this.time.delayedCall(5000, () => {
        particles.stop();
      });
    }
  }
}

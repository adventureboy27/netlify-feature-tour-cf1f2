export class ParticleEffects {
  static createExplosion(scene, x, y, radius = 60) {
    // Create explosion particles
    const particles = scene.add.particles(x, y, 'particle', {
      speed: { min: 100, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.5, end: 0 },
      tint: [0xFF0000, 0xFF6600, 0xFFFF00],
      lifespan: 600,
      gravityY: 100,
      quantity: 20,
      blendMode: 'ADD'
    });

    // Auto-destroy after animation
    scene.time.delayedCall(700, () => {
      particles.destroy();
    });

    // Create flash effect
    const flash = scene.add.circle(x, y, radius, 0xFFFFFF, 0.8);
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 300,
      onComplete: () => flash.destroy()
    });

    return particles;
  }

  static createFireEffect(scene, x, y) {
    const particles = scene.add.particles(x, y, 'particle', {
      speed: { min: 20, max: 40 },
      angle: { min: -100, max: -80 },
      scale: { start: 0.6, end: 0 },
      tint: [0xFF0000, 0xFF6600, 0xFFFF00],
      lifespan: 500,
      gravityY: -50,
      frequency: 50
    });

    return particles;
  }

  static createImpactEffect(scene, x, y) {
    const particles = scene.add.particles(x, y, 'particle', {
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      tint: [0x888888, 0x666666],
      lifespan: 300,
      gravityY: 50,
      quantity: 10
    });

    scene.time.delayedCall(400, () => {
      particles.destroy();
    });

    return particles;
  }

  static createBombExplosion(scene, x, y) {
    // Large explosion for bomb destruction
    const particles = scene.add.particles(x, y, 'particle', {
      speed: { min: 200, max: 400 },
      angle: { min: 0, max: 360 },
      scale: { start: 2, end: 0 },
      tint: [0xFF0000, 0xFF6600, 0xFFFF00, 0xFFFFFF],
      lifespan: 1000,
      gravityY: 100,
      quantity: 50,
      blendMode: 'ADD'
    });

    // Screen flash
    const flash = scene.add.rectangle(400, 300, 800, 600, 0xFFFFFF, 0.8);
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 500,
      onComplete: () => flash.destroy()
    });

    // Camera shake
    scene.cameras.main.shake(500, 0.02);

    scene.time.delayedCall(1100, () => {
      particles.destroy();
    });

    return particles;
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.startScreen = document.getElementById('startScreen');
    this.startButton = document.getElementById('startButton');
    this.statsDisplay = document.getElementById('stats');

    this.gameStarted = false;
    this.setupStartButton();
    this.loadImages();

    // Add constant for projectile speed
    this.PROJECTILE_SPEED = 4; // Unified speed for both arrows and fireballs
  }

  setupStartButton() {
    this.startButton.addEventListener('click', () => {
      this.startGame();
    });
  }

  startGame() {
    // Hide start screen and show game canvas
    this.startScreen.style.display = 'none';
    this.canvas.style.display = 'block';
    this.statsDisplay.style.display = 'block';

    // Initialize game objects
    this.initializeGame();

    // Start the game loop
    this.gameStarted = true;
    this.gameLoop();
  }

  initializeGame() {
    this.player = {
      x: 50,
      y: this.canvas.height / 2,
      width: 20,
      height: 20,
      speed: 5,
      lives: 1,
      direction: 'right'
    };

    this.enemy = {
      x: this.canvas.width - 70,
      y: this.canvas.height / 2,
      width: 20,
      height: 20,
      speed: 4,
      health: 1,
      isDodging: false,
      dodgeSpeed: 10,
      dodgeCooldown: 0,
      dodgeDuration: 1000000,
      moveDirection: 1,  // 1 for down, -1 for up
      lastDirectionChange: 0,
      minY: 20,  // Decreased to allow more vertical movement
      maxY: this.canvas.height - 40  // Increased to allow more vertical movement
    };

    this.arrows = [];
    this.fireballs = [];
    this.lastShot = 0;
    this.keys = {};
    this.setupEventListeners();
  }

  loadImages() {
    this.images = {
      player: new Image(),
      enemy: new Image(),
      arrow: new Image(),
      fireball: new Image()
    };

    this.images.player.src = 'images/player.png';
    this.images.enemy.src = 'images/enemy.png';
    this.images.arrow.src = 'images/arrow.png';
    this.images.fireball.src = 'images/fireball.png';
  }

  gameOver() {
    this.gameStarted = false;
    setTimeout(() => {
      location.reload();
    }, 100);
  }

  setupEventListeners() {
    document.addEventListener('keydown', (e) => this.keys[e.key] = true);
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' && Date.now() - this.lastShot >= 1000) {
        this.shoot();
        if (Math.random() < 0.50) {
          this.handleDodging();
        }
      }
    });
    document.addEventListener('keyup', (e) => this.keys[e.key] = false);
  }

  shoot() {
    if (Date.now() - this.lastShot >= 1000) {
      this.lastShot = Date.now();

      const arrow = {
        x: this.player.x + this.player.width / 2,
        y: this.player.y + this.player.height / 2,
        speed: this.PROJECTILE_SPEED,
        width: 10,
        height: 5,
        direction: 'right'
      };

      switch (this.player.direction) {
        case 'right':
          arrow.width = 15;
          arrow.height = 5;
          break;
        case 'left':
          arrow.width = 15;
          arrow.height = 5;
          break;
        case 'up':
          arrow.width = 15;
          arrow.height = 5;
          break;
        case 'down':
          arrow.width = 15;
          arrow.height = 5;
          break;
      }

      this.arrows.push(arrow);
    }
  }

  update() {
    // Player movement with direction tracking
    let moved = false;

    if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
      this.player.x -= this.player.speed;
      this.player.direction = 'left';
      moved = true;
    }
    if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
      this.player.x += this.player.speed;
      this.player.direction = 'right';
      moved = true;
    }
    if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) {
      this.player.y -= this.player.speed;
      this.player.direction = 'up';
      moved = true;
    }
    if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) {
      this.player.y += this.player.speed;
      this.player.direction = 'down';
      moved = true;
    }

    // Keep player in bounds
    this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));
    this.player.y = Math.max(0, Math.min(this.canvas.height - this.player.height, this.player.y));

    // Enemy movement
    this.updateEnemy();

    // Update arrows with fixed collision detection
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];

      // Update arrow position
      switch (arrow.direction) {
        case 'right':
          arrow.x += arrow.speed;
          break;
        case 'left':
          arrow.x -= arrow.speed;
          break;
        case 'up':
          arrow.y -= arrow.speed;
          break;
        case 'down':
          arrow.y += arrow.speed;
          break;
      }

      // Remove arrows that go off screen
      if (arrow.x > this.canvas.width ||
        arrow.x < 0 ||
        arrow.y > this.canvas.height ||
        arrow.y < 0) {
        this.arrows.splice(i, 1);
        continue;
      }

      // Check collision with enemy
      if (this.checkCollision(arrow, this.enemy)) {
        this.arrows.splice(i, 1);
        this.enemy.health--;

        if (this.enemy.health <= 0) {
          // Stop the game loop before showing victory
          this.gameStarted = false;
          setTimeout(() => this.victory(), 100);
          return;
        }
      }
    }

    // Enemy shoots fireballs
    if (Math.random() < 0.02) {
      this.fireballs.push({
        x: this.enemy.x,
        y: this.enemy.y,
        speed: 4,
        width: 15,
        height: 15,
        dx: this.player.x - this.enemy.x,
        dy: this.player.y - this.enemy.y
      });
    }

    // Update fireballs
    this.fireballs.forEach((fireball, index) => {
      let distance = Math.sqrt(fireball.dx * fireball.dx + fireball.dy * fireball.dy);
      fireball.x += (fireball.dx / distance) * fireball.speed;
      fireball.y += (fireball.dy / distance) * fireball.speed;

      if (fireball.x < 0 || fireball.x > this.canvas.width ||
        fireball.y < 0 || fireball.y > this.canvas.height) {
        this.fireballs.splice(index, 1);
      }

      // Check collision with player
      if (this.checkCollision(fireball, this.player)) {
        this.player.lives--;
        if (this.player.lives <= 0) {
          location.reload();
        }
        this.fireballs.splice(index, 1);
      }
    });
  }

  updateEnemy() {
    if (this.enemy.isDodging) {
      // Only handle dodge movement
      if (this.enemy.dodgeDirection === 'up') {
        this.enemy.y -= this.enemy.dodgeSpeed;
      } else {
        this.enemy.y += this.enemy.dodgeSpeed;
      }

      // Keep enemy within bounds while dodging
      this.enemy.y = Math.max(10, Math.min(this.canvas.height - 30, this.enemy.y));
      return; // Exit early to skip other movement logic
    }

    // Regular movement (only happens when not dodging)
    if (Math.random() < 0.02) { // 2% chance each frame to change direction
      this.enemy.moveDirection *= -1;
    }

    // Move up and down
    this.enemy.y += this.enemy.speed * this.enemy.moveDirection;

    // Boundary checks
    if (this.enemy.y <= 10) {  // Top boundary
      this.enemy.moveDirection = 1;
    } else if (this.enemy.y >= this.canvas.height - 30) {  // Bottom boundary
      this.enemy.moveDirection = -1;
    }

    // Keep enemy on the right side
    const targetX = this.canvas.width - 70;
    if (Math.abs(this.enemy.x - targetX) > 30) {
      this.enemy.x += (targetX - this.enemy.x) * 0.05;
    }

    // Update dodge cooldown
    if (this.enemy.dodgeCooldown > 0) {
      this.enemy.dodgeCooldown -= 16;
    }
  }

  checkCollision(rect1, rect2) {
    // Improved collision detection
    const rect1Center = {
      x: rect1.x + rect1.width / 2,
      y: rect1.y + rect1.height / 2
    };

    const rect2Center = {
      x: rect2.x + rect2.width / 2,
      y: rect2.y + rect2.height / 2
    };

    // Calculate distances between centers
    const distanceX = Math.abs(rect1Center.x - rect2Center.x);
    const distanceY = Math.abs(rect1Center.y - rect2Center.y);

    // Calculate minimum distance needed for collision
    const minDistanceX = (rect1.width + rect2.width) / 2;
    const minDistanceY = (rect1.height + rect2.height) / 2;

    return distanceX < minDistanceX && distanceY < minDistanceY;
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw player with rotation based on direction
    this.ctx.save();
    this.ctx.translate(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
    this.ctx.rotate(this.player.direction === 'left' ? Math.PI : this.player.direction === 'up' ? Math.PI / 2 : this.player.direction === 'down' ? -Math.PI / 2 : 0);
    this.ctx.drawImage(this.images.player, -this.player.width / 2, -this.player.height / 2, this.player.width, this.player.height);
    this.ctx.restore();

    // Draw enemy
    this.ctx.fillStyle = 'red';
    this.ctx.fillRect(this.enemy.x, this.enemy.y, this.enemy.width, this.enemy.height);

    // Draw arrows
    this.ctx.fillStyle = 'black';
    this.arrows.forEach(arrow => {
      this.ctx.fillRect(arrow.x, arrow.y, arrow.width, arrow.height);
    });

    // Draw fireballs
    this.ctx.fillStyle = 'orange';
    this.fireballs.forEach(fireball => {
      this.ctx.fillRect(fireball.x, fireball.y, fireball.width, fireball.height);
    });

    // Update stats
    document.getElementById('lives').textContent = this.player.lives;
  }

  gameLoop() {
    if (!this.gameStarted) return;
    this.update();
    this.draw();
    requestAnimationFrame(() => this.gameLoop());
  }

  victory() {
    this.gameStarted = false;
    setTimeout(() => {
      location.reload();
    }, 100);
  }

  handleDodging() {
    for (let arrow of this.arrows) {
      const arrowDx = arrow.x - this.enemy.x;
      const arrowDy = arrow.y - this.enemy.y;
      const arrowDistance = Math.sqrt(arrowDx * arrowDx + arrowDy * arrowDy);

      // Changed dodge chance from 0.10 to 0.50 (50%)
      if (arrowDistance < 120 && !this.enemy.isDodging && this.enemy.dodgeCooldown <= 0) {
        if (Math.random() < 0.50) {  // 50% chance to dodge
          this.enemy.isDodging = true;
          this.enemy.dodgeCooldown = 1500;  // 1.5 second cooldown

          // Choose dodge direction based on arrow and current position
          if (this.enemy.y > this.canvas.height / 2) {
            this.enemy.dodgeDirection = 'up';
          } else {
            this.enemy.dodgeDirection = 'down';
          }

          // Visual feedback for dodge
          this.enemy.isDodging = true;

          setTimeout(() => {
            this.enemy.isDodging = false;
            this.chooseNewDirection(); // Choose new direction after dodge
          }, this.enemy.dodgeDuration);
        }
      }
    }
  }
}

// Start the game when the page loads
window.onload = () => new Game(); 
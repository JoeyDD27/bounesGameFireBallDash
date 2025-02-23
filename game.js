class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.startScreen = document.getElementById('startScreen');
    this.startButton = document.getElementById('startButton');
    this.statsDisplay = document.getElementById('stats');
    this.contractScreen = document.getElementById('contractScreen');
    this.acceptButton = document.getElementById('acceptContract');

    this.gameStarted = false;
    this.PROJECTILE_SPEED = 4;
    this.level = 1;

    // Setup contract first
    this.setupContract();
    // Load saved level when game initializes
    this.loadSavedLevel();
    this.setupStartButton();
    this.loadImages();
    this.lastTNTSpawn = 0;
    this.TNT_SPAWN_INTERVAL = 4000; // 4 seconds for level 5 (slower than level 4)
    this.MAX_TNTS = 4; // Fewer max TNTs for level 5 to balance difficulty

    // Add level selector elements
    this.levelSelectorBtn = document.getElementById('levelSelectorBtn');
    this.levelDropdown = document.getElementById('levelDropdown');

    // Setup level selector
    this.setupLevelSelector();
  }

  setupContract() {
    // Show contract screen initially
    this.contractScreen.style.display = 'flex';
    this.startScreen.style.display = 'none';

    // Add click listener to accept button
    if (this.acceptButton) {
      this.acceptButton.onclick = () => {
        console.log('Accept button clicked'); // Debug log
        this.contractScreen.style.display = 'none';
        this.startScreen.style.display = 'flex';
      };
    }
  }

  async loadSavedLevel() {
    try {
      const result = await chrome.storage.local.get(['gameLevel']);
      if (result.gameLevel) {
        this.level = result.gameLevel;
        const gameResult = document.getElementById('gameResult');
        gameResult.textContent = `Continue Level ${this.level}`;
        this.startButton.textContent = `Start Level ${this.level}`;
      }
    } catch (error) {
      console.error('Error loading saved level:', error);
    }
  }

  setupStartButton() {
    this.startButton.addEventListener('click', () => {
      this.startGame();
    });
  }

  startGame() {
    // Clear any previous game result
    const gameResult = document.getElementById('gameResult');
    gameResult.textContent = '';
    gameResult.className = 'game-result';

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
      lives: this.level === 10 ? 10 : this.level === 9 ? 3 : this.level === 4 || this.level === 5 ? 5 : 1,
      direction: 'right',
      lastAutoShot: 0
    };

    if (this.level === 10) {
      // Create array of 5 enemies for level 10
      this.enemies = Array(5).fill(null).map(() => ({
        x: this.canvas.width - 70,
        y: Math.random() * (this.canvas.height - 40) + 20,
        width: 20,
        height: 20,
        speed: 3,
        health: this.getEnemyHealth(),
        lastTeleport: 0,
        lastShotTime: 0
      }));
      this.enemy = this.enemies[0]; // Keep reference for compatibility
    } else {
      // Normal single enemy setup
      this.enemy = {
        x: this.canvas.width - 70,
        y: this.canvas.height / 2,
        width: 20,
        height: 20,
        speed: 3,
        health: this.getEnemyHealth(),
        isDodging: false,
        dodgeSpeed: 10,
        dodgeCooldown: 0,
        dodgeDuration: 1000000,
        moveDirection: 1,
        lastDirectionChange: 0,
        minY: 20,
        maxY: this.canvas.height - 40,
        chaseMode: false,
        chaseCooldown: 0,
        lastShotTime: 0,
        isShielded: this.level === 8,
        lastTeleport: 0 // for level 9 teleportation
      };
      this.enemies = [this.enemy];
    }

    this.arrows = [];
    this.fireballs = [];
    this.tnts = (this.level === 4 || this.level === 5) ? [new TNT(this.canvas), new TNT(this.canvas)] : [];
    this.lastShot = 0;
    this.keys = {};
    this.setupEventListeners();
    document.getElementById('enemyHealth').textContent = this.enemy.health;
    document.getElementById('lives').textContent = this.player.lives;
    this.lastTNTSpawn = Date.now();
  }

  getEnemyHealth() {
    switch (this.level) {
      case 1: return 1;
      case 2: return 3;
      case 3: return 10;
      case 4: return 4;
      case 5: return 10;
      case 6: return 5;
      case 7: return 5;
      case 8: return 5;
      case 9: return 5;
      case 10: return 5; // Level 10 enemies have 5 HP each
      default: return 1;
    }
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
    this.tnts = []; // Clear TNTs on game over too
    const gameResult = document.getElementById('gameResult');
    gameResult.textContent = 'Game Over!';
    gameResult.className = 'game-result lose';
    this.canvas.style.display = 'none';
    this.statsDisplay.style.display = 'none';
    this.startScreen.style.display = 'flex';
    this.startButton.textContent = 'Try Again';
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

    // Update arrows with movement
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];

      // Move arrows
      if (this.level === 10) {
        arrow.x += arrow.dx * arrow.speed;
        arrow.y += arrow.dy * arrow.speed;
      } else {
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
      }

      // Remove arrows that go off screen
      if (arrow.x > this.canvas.width || arrow.x < 0 ||
        arrow.y > this.canvas.height || arrow.y < 0) {
        this.arrows.splice(i, 1);
        continue;
      }

      // Check collision with enemies
      if (this.level === 10) {
        for (let enemy of this.enemies) {
          if (enemy.health > 0 && this.checkCollision(arrow, enemy)) {
            enemy.health -= 1;
            this.arrows.splice(i, 1);
            break;
          }
        }
      } else {
        // Check collision with enemy
        if (this.checkCollision(arrow, this.enemy)) {
          if (this.level === 8) {
            const timeSinceLastShot = Date.now() - this.enemy.lastShotTime;
            if (timeSinceLastShot < 1000) {
              this.enemy.health -= 1;
              document.getElementById('enemyHealth').textContent = this.enemy.health;
            }
          } else {
            const arrowDamage = this.level === 5 ? 3 : 1;
            this.enemy.health -= arrowDamage;
            document.getElementById('enemyHealth').textContent = this.enemy.health;
          }
          this.arrows.splice(i, 1);

          if (this.enemy.health <= 0) {
            this.gameStarted = false;
            setTimeout(() => this.victory(), 100);
            return;
          }
        }
      }
    }

    // Enemy shoots fireballs - Add level check
    if ((this.level === 1 || this.level === 6 || this.level === 7 || this.level === 8) && Math.random() < 0.02) {
      this.enemy.lastShotTime = Date.now();
      this.fireballs.push({
        x: this.enemy.x,
        y: this.enemy.y,
        speed: this.level === 7 ? 10 : this.level === 8 || this.level === 6 ? 6 : 4,
        width: 15,
        height: 15,
        dx: this.player.x - this.enemy.x,
        dy: this.player.y - this.enemy.y
      });
    }

    // Update fireballs - Only if in level 1
    if (this.level === 1) {
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
            this.gameOver();
          }
          this.fireballs.splice(index, 1);
        }
      });
    }

    // Level 5 enemy shooting (similar to level 1 but less frequent)
    if (this.level === 5 && Math.random() < 0.01) {
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

    // Level 9 special mechanics
    if (this.level === 9) {
      // Teleport every 2 seconds
      if (Date.now() - this.enemy.lastTeleport > 2000) {
        this.enemy.x = Math.random() * (this.canvas.width - 100) + 50;
        this.enemy.y = Math.random() * (this.canvas.height - 100) + 50;
        this.enemy.lastTeleport = Date.now();
      }

      // Multi-fireball attack with damage of 1
      if (Math.random() < 0.02) {
        // Shoot 3 fireballs in different directions
        for (let i = 0; i < 3; i++) {
          const angle = (Math.PI * 2 / 3) * i;
          const baseX = this.player.x - this.enemy.x;
          const baseY = this.player.y - this.enemy.y;

          // Calculate spread directions
          const dx = baseX * Math.cos(angle) - baseY * Math.sin(angle);
          const dy = baseX * Math.sin(angle) + baseY * Math.cos(angle);

          this.fireballs.push({
            x: this.enemy.x,
            y: this.enemy.y,
            speed: 5,
            width: 15,
            height: 15,
            dx: dx,
            dy: dy,
            damage: 1 // Explicitly set fireball damage to 1
          });
        }
      }
    }

    // Level 10 auto-aim and auto-shoot
    if (this.level === 10) {
      // Auto-aim and auto-shoot every 500ms
      if (Date.now() - this.player.lastAutoShot > 500) {
        // Find closest enemy
        let closestEnemy = null;
        let closestDistance = Infinity;

        this.enemies.forEach(enemy => {
          if (enemy.health > 0) {
            const dx = enemy.x - this.player.x;
            const dy = enemy.y - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestEnemy = enemy;
            }
          }
        });

        if (closestEnemy) {
          // Calculate perfect aim to hit the enemy
          const dx = closestEnemy.x - this.player.x;
          const dy = closestEnemy.y - this.player.y;
          const angle = Math.atan2(dy, dx);

          this.arrows.push({
            x: this.player.x,
            y: this.player.y,
            speed: this.PROJECTILE_SPEED,
            width: 15,
            height: 15,
            dx: Math.cos(angle),
            dy: Math.sin(angle)
          });
          this.player.lastAutoShot = Date.now();
        }
      }

      // Update all enemies and their fireballs
      this.enemies.forEach(enemy => {
        // Teleport logic
        if (Date.now() - enemy.lastTeleport > 2000) {
          enemy.x = Math.random() * (this.canvas.width - 100) + 50;
          enemy.y = Math.random() * (this.canvas.height - 100) + 50;
          enemy.lastTeleport = Date.now();
        }

        // Multi-fireball attack
        if (Math.random() < 0.01) {
          for (let i = 0; i < 3; i++) {
            const angle = (Math.PI * 2 / 3) * i;
            const baseX = this.player.x - enemy.x;
            const baseY = this.player.y - enemy.y;

            const dx = baseX * Math.cos(angle) - baseY * Math.sin(angle);
            const dy = baseX * Math.sin(angle) + baseY * Math.cos(angle);

            this.fireballs.push({
              x: enemy.x,
              y: enemy.y,
              speed: 5,
              width: 15,
              height: 15,
              dx: dx,
              dy: dy
            });
          }
          enemy.lastShotTime = Date.now();
        }
      });

      // Check for level completion
      if (this.enemies.every(enemy => enemy.health <= 0)) {
        this.gameStarted = false;
        setTimeout(() => this.victory(), 100);
        return;
      }
    }

    // Update fireballs for all levels including level 10
    if (this.level === 1 || this.level === 5 || this.level === 6 ||
      this.level === 7 || this.level === 8 || this.level === 9 || this.level === 10) {
      this.fireballs.forEach((fireball, index) => {
        let distance = Math.sqrt(fireball.dx * fireball.dx + fireball.dy * fireball.dy);
        fireball.x += (fireball.dx / distance) * fireball.speed;
        fireball.y += (fireball.dy / distance) * fireball.speed;

        if (fireball.x < 0 || fireball.x > this.canvas.width ||
          fireball.y < 0 || fireball.y > this.canvas.height) {
          this.fireballs.splice(index, 1);
        }

        if (this.checkCollision(fireball, this.player)) {
          this.player.lives--;
          if (this.player.lives <= 0) {
            this.gameOver();
          }
          this.fireballs.splice(index, 1);
        }
      });
    }

    // TNT spawning for levels 4 and 5
    if (this.level === 4 || this.level === 5) {
      const currentTime = Date.now();
      if (currentTime - this.lastTNTSpawn > this.TNT_SPAWN_INTERVAL &&
        this.tnts.length < this.MAX_TNTS) {
        this.tnts.push(new TNT(this.canvas));
        this.lastTNTSpawn = currentTime;
      }

      // Update TNTs
      this.tnts = this.tnts.filter(tnt => {
        tnt.update(this.canvas);

        // Check collision with player
        if (this.checkCollision(tnt, this.player)) {
          this.player.lives -= tnt.damage;
          if (this.player.lives <= 0) {
            this.gameOver();
          }
          return false; // Remove TNT after hitting player
        }
        return true;
      });
    }
  }

  updateEnemy() {
    if (this.level === 5) {
      // Switch between chase and normal modes
      if (this.enemy.chaseCooldown <= 0) {
        this.enemy.chaseMode = !this.enemy.chaseMode;
        this.enemy.chaseCooldown = 120; // Switch modes every 2 seconds
      }
      this.enemy.chaseCooldown--;

      if (this.enemy.chaseMode) {
        // Chase behavior
        const dx = this.player.x - this.enemy.x;
        const dy = this.player.y - this.enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        this.enemy.x += (dx / distance) * this.enemy.speed;
        this.enemy.y += (dy / distance) * this.enemy.speed;

        // Check for collision with player
        if (this.checkCollision(this.enemy, this.player)) {
          this.player.lives -= 3; // 3 HP damage on crash
          // Push player away
          this.player.x += (dx / distance) * -20;
          this.player.y += (dy / distance) * -20;

          if (this.player.lives <= 0) {
            this.gameOver();
          }
          this.enemy.chaseMode = false;
        }
      } else {
        // Normal movement
        if (Math.random() < 0.02) {
          this.enemy.moveDirection *= -1;
        }
        this.enemy.y += this.enemy.speed * this.enemy.moveDirection;

        if (this.enemy.y <= 10) {
          this.enemy.moveDirection = 1;
        } else if (this.enemy.y >= this.canvas.height - 30) {
          this.enemy.moveDirection = -1;
        }
      }
    } else if (this.level === 1 || this.level === 4 || this.level === 6 || this.level === 7) { // Added level 7
      // Level 1, 4, 6, and 7 behavior
      if (this.enemy.isDodging) {
        if (this.enemy.dodgeDirection === 'up') {
          this.enemy.y -= this.enemy.dodgeSpeed;
        } else {
          this.enemy.y += this.enemy.dodgeSpeed;
        }
        this.enemy.y = Math.max(10, Math.min(this.canvas.height - 30, this.enemy.y));
        return;
      }

      // Regular movement
      if (Math.random() < 0.02) {
        this.enemy.moveDirection *= -1;
      }
      this.enemy.y += this.enemy.speed * this.enemy.moveDirection;

      // Boundary checks
      if (this.enemy.y <= 10) {
        this.enemy.moveDirection = 1;
      } else if (this.enemy.y >= this.canvas.height - 30) {
        this.enemy.moveDirection = -1;
      }

      const targetX = this.canvas.width - 70;
      if (Math.abs(this.enemy.x - targetX) > 30) {
        this.enemy.x += (targetX - this.enemy.x) * 0.05;
      }
    } else if (this.level === 2 || this.level === 3) {
      // Level 2 and 3 share the same chase behavior
      const dx = this.player.x - this.enemy.x;
      const dy = this.player.y - this.enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Move towards player
      this.enemy.x += (dx / distance) * this.enemy.speed;
      this.enemy.y += (dy / distance) * this.enemy.speed;

      // Check for collision with player (crushing)
      if (this.checkCollision(this.enemy, this.player)) {
        this.player.lives--;
        // Push player away from enemy
        this.player.x += (dx / distance) * -20;
        this.player.y += (dy / distance) * -20;

        if (this.player.lives <= 0) {
          this.gameOver();
        }
      }

      // Keep enemy within bounds
      this.enemy.x = Math.max(0, Math.min(this.canvas.width - this.enemy.width, this.enemy.x));
      this.enemy.y = Math.max(0, Math.min(this.canvas.height - this.enemy.height, this.enemy.y));
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

    // Draw shield for level 8 when active
    if (this.level === 8) {
      const timeSinceLastShot = Date.now() - this.enemy.lastShotTime;
      if (timeSinceLastShot >= 1000) {
        this.ctx.beginPath();
        this.ctx.arc(
          this.enemy.x + this.enemy.width / 2,
          this.enemy.y + this.enemy.height / 2,
          this.enemy.width * 0.8,
          0,
          Math.PI * 2
        );
        this.ctx.strokeStyle = 'blue';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }
    }

    // Update stats
    document.getElementById('lives').textContent = this.player.lives;
    document.getElementById('enemyHealth').textContent = this.enemy.health;

    if (this.level === 4) {
      // Draw TNTs
      this.ctx.fillStyle = '#FF4500';
      this.tnts.forEach(tnt => {
        this.ctx.fillRect(tnt.x, tnt.y, tnt.width, tnt.height);
        // Draw "TNT" text
        this.ctx.fillStyle = 'white';
        this.ctx.font = '10px Arial';
        this.ctx.fillText('TNT', tnt.x + 2, tnt.y + 12);
        this.ctx.fillStyle = '#FF4500';
      });
    }

    // Draw all enemies for level 10
    if (this.level === 10) {
      this.enemies.forEach(enemy => {
        if (enemy.health > 0) {
          this.ctx.fillStyle = 'red';
          this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);

          // Draw teleport effect
          if (Date.now() - enemy.lastTeleport < 200) {
            this.ctx.beginPath();
            this.ctx.arc(
              enemy.x + enemy.width / 2,
              enemy.y + enemy.height / 2,
              enemy.width * 1.2,
              0,
              Math.PI * 2
            );
            this.ctx.strokeStyle = 'purple';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
          }
        }
      });
    }
  }

  gameLoop() {
    if (!this.gameStarted) return;
    this.update();
    this.draw();
    requestAnimationFrame(() => this.gameLoop());
  }

  async victory() {
    if (this.level === 1) {
      this.level = 2;
      await this.saveLevel(2);
      this.showLevelComplete("Level 1 Complete! Ready for Level 2");
    } else if (this.level === 2) {
      this.level = 3;
      await this.saveLevel(3);
      this.showLevelComplete("Level 2 Complete! Ready for Level 3");
    } else if (this.level === 3) {
      this.level = 4;
      await this.saveLevel(4);
      this.showLevelComplete("Level 3 Complete! Ready for Level 4");
    } else if (this.level === 4) {
      this.level = 5;
      await this.saveLevel(5);
      this.showLevelComplete("Level 4 Complete! Ready for Level 5");
    } else if (this.level === 5) {
      this.level = 6;
      await this.saveLevel(6);
      this.showLevelComplete("Level 5 Complete! Ready for Level 6");
    } else if (this.level === 6) {
      this.level = 7;
      await this.saveLevel(7);
      this.showLevelComplete("Level 6 Complete! Ready for Level 7");
    } else if (this.level === 7) {
      this.level = 8;
      await this.saveLevel(8);
      this.showLevelComplete("Level 7 Complete! Ready for Level 8");
    } else if (this.level === 8) {
      this.level = 9;
      await this.saveLevel(9);
      this.showLevelComplete("Level 8 Complete! Ready for Level 9");
    } else if (this.level === 9) {
      this.level = 10;
      await this.saveLevel(10);
      this.showLevelComplete("Level 9 Complete! Ready for Level 10");
    } else {
      this.gameStarted = false;
      this.tnts = []; // Clear all TNTs
      await this.saveLevel(1);
      this.showEndScreen();
    }
  }

  showLevelComplete(message) {
    const gameResult = document.getElementById('gameResult');
    gameResult.textContent = message;
    gameResult.className = 'game-result win';
    this.canvas.style.display = 'none';
    this.statsDisplay.style.display = 'none';
    this.startScreen.style.display = 'flex';
    this.startButton.textContent = `Start Level ${this.level}`;
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

  updateFireballs() {
    // Only shoot fireballs in level 1
    if (this.level === 1) {
      // Create new fireball
      if (Math.random() < 0.02) {  // 2% chance each frame to shoot
        this.fireballs.push({
          x: this.enemy.x,
          y: this.enemy.y + this.enemy.height / 2,
          width: 10,
          height: 10,
          speed: -5
        });
      }

      // Update existing fireballs
      for (let i = this.fireballs.length - 1; i >= 0; i--) {
        this.fireballs[i].x += this.fireballs[i].speed;

        // Remove fireballs that are off screen
        if (this.fireballs[i].x + this.fireballs[i].width < 0) {
          this.fireballs.splice(i, 1);
        }
      }
    }
  }

  shootArrow() {
    const currentTime = Date.now();
  }

  updatePlayer() {
    // Normal movement controls
    if (this.keys['ArrowLeft'] && this.player.x > 0) {
      this.player.x -= this.player.speed;
    }
    if (this.keys['ArrowRight'] && this.player.x < this.canvas.width - this.player.width) {
      this.player.x += this.player.speed;
    }
    if (this.keys['ArrowUp'] && this.player.y > 0) {
      this.player.y -= this.player.speed;
    }
    if (this.keys['ArrowDown'] && this.player.y < this.canvas.height - this.player.height) {
      this.player.y += this.player.speed;
    }
  }

  async saveLevel(level) {
    try {
      await chrome.storage.local.set({ gameLevel: level });
    } catch (error) {
      console.error('Error saving level:', error);
    }
  }

  showEndScreen() {
    const gameResult = document.getElementById('gameResult');
    gameResult.textContent = 'You Win! Game Complete!';
    gameResult.className = 'game-result win';
    this.canvas.style.display = 'none';
    this.statsDisplay.style.display = 'none';
    this.startScreen.style.display = 'flex';
    this.startButton.textContent = 'Play Again';
    this.level = 1;
  }

  setupButtons() {
    // Setup contract acceptance button
    this.acceptButton.addEventListener('click', () => {
      chrome.storage.local.set({ contractAccepted: true });
      this.contractScreen.style.display = 'none';
      this.startScreen.style.display = 'flex';
    });

    // Setup start button
    this.startButton.addEventListener('click', () => {
      this.startGame();
    });
  }

  async checkContract() {
    try {
      const result = await chrome.storage.local.get(['contractAccepted']);
      if (!result.contractAccepted) {
        // Show contract screen, hide start screen
        this.contractScreen.style.display = 'flex';
        this.startScreen.style.display = 'none';
      } else {
        // Contract already accepted, show start screen
        this.contractScreen.style.display = 'none';
        this.startScreen.style.display = 'flex';
      }
    } catch (error) {
      console.error('Error checking contract:', error);
    }
  }

  setupLevelSelector() {
    // Toggle dropdown
    this.levelSelectorBtn.addEventListener('click', () => {
      const isHidden = this.levelDropdown.style.display === 'none';
      this.levelDropdown.style.display = isHidden ? 'block' : 'none';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
      if (!event.target.matches('#levelSelectorBtn') &&
        !event.target.matches('.level-option')) {
        this.levelDropdown.style.display = 'none';
      }
    });

    // Handle level selection
    const levelOptions = document.querySelectorAll('.level-option');
    levelOptions.forEach(option => {
      option.addEventListener('click', async () => {
        const selectedLevel = parseInt(option.getAttribute('data-level'));
        this.level = selectedLevel;
        await this.saveLevel(selectedLevel);

        // Update UI
        const gameResult = document.getElementById('gameResult');
        gameResult.textContent = `Switched to Level ${selectedLevel}`;
        this.startButton.textContent = `Start Level ${selectedLevel}`;

        // Hide dropdown
        this.levelDropdown.style.display = 'none';
      });
    });
  }
}

class TNT {
  constructor(canvas) {
    this.width = 20;
    this.height = 20;
    this.damage = 3;
    this.x = Math.random() * (canvas.width - this.width);
    this.y = Math.random() * (canvas.height - this.height);
    this.moveSpeed = 2;
    this.direction = Math.random() * Math.PI * 2;
    this.changeDirectionCounter = 0;
  }

  update(canvas) {
    this.x += Math.cos(this.direction) * this.moveSpeed;
    this.y += Math.sin(this.direction) * this.moveSpeed;

    // Bounce off walls
    if (this.x <= 0 || this.x >= canvas.width - this.width) {
      this.direction = Math.PI - this.direction;
    }
    if (this.y <= 0 || this.y >= canvas.height - this.height) {
      this.direction = -this.direction;
    }

    // Randomly change direction
    this.changeDirectionCounter++;
    if (this.changeDirectionCounter > 60) { // Change direction every ~1 second
      if (Math.random() < 0.3) { // 30% chance to change direction
        this.direction = Math.random() * Math.PI * 2;
      }
      this.changeDirectionCounter = 0;
    }
  }
}

// Start the game when the page loads
window.onload = () => new Game(); 
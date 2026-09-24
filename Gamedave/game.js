// ==================== KONFIGURASI GAME ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const scoreElement = document.getElementById('scoreValue');
const waveElement = document.getElementById('waveValue');
const livesElement = document.getElementById('livesValue');
const gameOverScreen = document.getElementById('gameOver');
const startScreen = document.getElementById('startScreen');
const finalScoreElement = document.getElementById('finalScore');

// ==================== ALIEN STATES (TUGAS 1) ====================
const ALIEN_STATES = {
    FORMATION: 'FORMATION',
    DIVE_OUT: 'DIVE_OUT',
    DIVE_ATTACK: 'DIVE_ATTACK',
    RETURN: 'RETURN'
};

// ==================== GAME VARIABLES ====================
let gameRunning = false;
let score = 0;
let wave = 1;
let lives = 3;
let player;
let aliens = [];
let bullets = [];
let particles = [];
let stars = [];
let keys = {};
let lastDiveTime = 0;
let formationDirection = 1;
let formationMoveTimer = 0;

// ==================== CLASS STAR (BACKGROUND) ====================
class Star {
    constructor() {
        this.reset();
        this.y = Math.random() * canvas.height;
    }
    
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = -10;
        this.speed = Math.random() * 2 + 0.5;
        this.size = Math.random() * 2 + 1;
        this.brightness = Math.random();
    }
    
    update() {
        this.y += this.speed;
        if (this.y > canvas.height) {
            this.reset();
        }
    }
    
    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.brightness})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

// ==================== CLASS PARTICLE (EXPLOSION) ====================
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.02;
        this.color = color;
        this.size = Math.random() * 5 + 3;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.size *= 0.98;
    }
    
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

// ==================== CLASS ALIEN ====================
class Alien {
    constructor(x, y, type = 0) {
        this.startX = x;
        this.startY = y;
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 40;
        this.height = 40;
        
        // TUGAS 1: Property state
        this.state = ALIEN_STATES.FORMATION;
        
        // Properti gerakan
        this.homeY = y;
        this.diveProgress = 0;
        this.hasShot = false;
        this.returnTimer = 0;
        
        // TUGAS 5: Amplitude berbeda berdasarkan type
        // Type 0 (Flagship - baris atas): lengkungan lebih lebar dan cepat
        this.amplitude = type === 0 ? 200 : (type === 1 ? 100 : 50);
        this.diveSpeed = type === 0 ? 0.03 : (type === 1 ? 0.02 : 0.015);
        this.frequency = 0.08;
        
        // Animasi
        this.animationFrame = 0;
    }
    
    update(player, bullets) {
        switch(this.state) {
            case ALIEN_STATES.FORMATION:
                this.updateFormation();
                break;
            case ALIEN_STATES.DIVE_OUT:
                this.updateDiveOut();
                break;
            case ALIEN_STATES.DIVE_ATTACK:
                this.updateDiveAttack(player, bullets);
                break;
            case ALIEN_STATES.RETURN:
                this.updateReturn();
                break;
        }
        
        this.animationFrame += 0.1;
    }
    
    // Gerakan dalam formasi
    updateFormation() {
        // Gerakan sinusoidal horizontal
        this.x = this.startX + Math.sin(Date.now() * 0.001 + this.startY * 0.01) * 30;
        this.y = this.homeY;
    }
    
    // TUGAS 2: updateDive - Alien menukik dengan gerakan melengkung
    updateDiveOut() {
        this.diveProgress += this.diveSpeed;
        
        // Gerakan melengkung menggunakan sinus
        const curveX = Math.sin(this.diveProgress * Math.PI) * this.amplitude;
        this.x = this.startX + curveX;
        this.y = this.homeY + (this.diveProgress * 500);
        
        // Jika sudah sampai bawah, masuk ke state attack
        if (this.diveProgress >= 1.0) {
            this.state = ALIEN_STATES.DIVE_ATTACK;
            this.diveProgress = 0;
        }
    }
    
    // Menyerang player
    updateDiveAttack(player, bullets) {
        // Tembakan sekali saja
        if (!this.hasShot) {
            this.shoot(bullets);
            this.hasShot = true;
        }
        
        // Lanjutkan gerakan ke bawah
        this.diveProgress += this.diveSpeed;
        this.y = this.homeY + (this.diveProgress * 500);
        
        // Jika sudah keluar layar, mulai return
        if (this.y > canvas.height + 50) {
            this.state = ALIEN_STATES.RETURN;
            this.returnTimer = 0;
        }
    }
    
    // TUGAS 2: updateReturn - Kembali ke formasi (gerakan lurus ke atas)
    updateReturn() {
        this.returnTimer += 0.02;
        
        // Gerakan lurus ke atas menuju homeY
        this.y = canvas.height + 50 - (this.returnTimer * 600);
        
        // Jika sudah kembali ke atas, reset ke formasi
        if (this.y <= this.homeY) {
            this.y = this.homeY;
            this.x = this.startX;
            this.state = ALIEN_STATES.FORMATION;
            this.diveProgress = 0;
            this.hasShot = false; // Reset agar bisa menembak lagi
        }
    }
    
    // Menembak
    shoot(bullets) {
        bullets.push({
            x: this.x,
            y: this.y + 20,
            width: 4,
            height: 15,
            speed: 6,
            isPlayer: false,
            color: '#ff00ff'
        });
    }
    
    // Render alien
    draw() {
        // Warna berdasarkan type
        const colors = ['#ff0000', '#ffff00', '#00ff00'];
        const color = colors[this.type] || '#00ff00';
        
        // Body alien
        ctx.fillStyle = color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        
        // Bentuk alien berbeda berdasarkan type
        if (this.type === 0) {
            // Flagship - lebih besar
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - 25);
            ctx.lineTo(this.x + 25, this.y);
            ctx.lineTo(this.x + 20, this.y + 25);
            ctx.lineTo(this.x - 20, this.y + 25);
            ctx.lineTo(this.x - 25, this.y);
            ctx.closePath();
            ctx.fill();
        } else {
            // Alien biasa
            ctx.fillRect(this.x - 20, this.y - 20, 40, 40);
        }
        
        ctx.shadowBlur = 0;
        
        // Mata
        ctx.fillStyle = 'white';
        const eyeOffset = Math.sin(this.animationFrame) * 3;
        ctx.fillRect(this.x - 10 + eyeOffset, this.y - 10, 8, 8);
        ctx.fillRect(this.x + 2 + eyeOffset, this.y - 10, 8, 8);
        
        // State indicator (untuk debugging)
        // ctx.fillStyle = 'white';
        // ctx.font = '10px Arial';
        // ctx.fillText(this.state, this.x - 20, this.y - 30);
    }
    
    // Cek collision dengan bullet
    checkCollision(bullet) {
        return bullet.x > this.x - this.width/2 &&
               bullet.x < this.x + this.width/2 &&
               bullet.y > this.y - this.height/2 &&
               bullet.y < this.y + this.height/2;
    }
}

// ==================== CLASS PLAYER ====================
class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height - 80;
        this.width = 40;
        this.height = 40;
        this.speed = 7;
        this.shootCooldown = 0;
        this.invulnerable = 0;
    }
    
    update() {
        // Kontrol keyboard
        if (keys['ArrowLeft'] && this.x > this.width) {
            this.x -= this.speed;
        }
        if (keys['ArrowRight'] && this.x < canvas.width - this.width) {
            this.x += this.speed;
        }
        
        // Cooldown shooting
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }
        
        // Invulnerability
        if (this.invulnerable > 0) {
            this.invulnerable--;
        }
    }
    
    shoot(bullets) {
        if (this.shootCooldown <= 0) {
            bullets.push({
                x: this.x,
                y: this.y - 20,
                width: 4,
                height: 15,
                speed: 10,
                isPlayer: true,
                color: '#00ffff'
            });
            this.shootCooldown = 10;
        }
    }
    
    draw() {
        // Blink jika invulnerable
        if (this.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
            return;
        }
        
        ctx.fillStyle = '#00ffff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
        
        // Gambar pesawat segitiga
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - 25);
        ctx.lineTo(this.x - 20, this.y + 20);
        ctx.lineTo(this.x + 20, this.y + 20);
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // Engine flame
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(this.x - 10, this.y + 20);
        ctx.lineTo(this.x, this.y + 35 + Math.random() * 10);
        ctx.lineTo(this.x + 10, this.y + 20);
        ctx.closePath();
        ctx.fill();
    }
    
    checkCollision(bullet) {
        if (this.invulnerable > 0) return false;
        
        return bullet.x > this.x - this.width/2 &&
               bullet.x < this.x + this.width/2 &&
               bullet.y > this.y - this.height/2 &&
               bullet.y < this.y + this.height/2;
    }
    
    hit() {
        if (this.invulnerable <= 0) {
            lives--;
            this.invulnerable = 120; // 2 detik invulnerable
            updateUI();
            createExplosion(this.x, this.y, '#00ffff');
            
            if (lives <= 0) {
                endGame();
            }
        }
    }
}

// ==================== FUNGSI UTAMA ====================

// Inisialisasi bintang background
function initStars() {
    stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push(new Star());
    }
}

// Inisialisasi alien dalam formasi
function initAliens() {
    aliens = [];
    const rows = 3;
    const cols = 6;
    const startX = 80;
    const startY = 60;
    const spacingX = 100;
    const spacingY = 60;
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = startX + col * spacingX;
            const y = startY + row * spacingY;
            const type = row; // 0 = flagship, 1 = middle, 2 = bottom
            aliens.push(new Alien(x, y, type));
        }
    }
}

// TUGAS 3: Trigger alien dive
function triggerAlienDive() {
    const now = Date.now();
    
    // Interval dive berdasarkan wave
    // TUGAS 4: Math.max untuk batasan minimal 30ms
    let diveInterval = Math.max(30, 120 - (wave * 10));
    
    if (now - lastDiveTime > diveInterval * 50) {
        // Pilih alien random yang dalam formasi
        const formationAliens = aliens.filter(a => a.state === ALIEN_STATES.FORMATION);
        
        if (formationAliens.length > 0) {
            const randomAlien = formationAliens[Math.floor(Math.random() * formationAliens.length)];
            randomAlien.state = ALIEN_STATES.DIVE_OUT;
            randomAlien.diveProgress = 0;
            randomAlien.hasShot = false;
            lastDiveTime = now;
        }
    }
}

// Create explosion effect
function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Update UI
function updateUI() {
    scoreElement.textContent = score;
    waveElement.textContent = wave;
    livesElement.textContent = lives;
}

// Cek collision
function checkCollisions() {
    // Player bullets hit aliens
    bullets.forEach((bullet, bIndex) => {
        if (bullet.isPlayer) {
            aliens.forEach((alien, aIndex) => {
                if (alien.state !== ALIEN_STATES.FORMATION && alien.checkCollision(bullet)) {
                    // Alien hit
                    createExplosion(alien.x, alien.y, '#ff0000');
                    aliens.splice(aIndex, 1);
                    bullets.splice(bIndex, 1);
                    score += (alien.type + 1) * 100;
                    updateUI();
                }
            });
        } else {
            // Enemy bullets hit player
            if (player.checkCollision(bullet)) {
                player.hit();
                bullets.splice(bIndex, 1);
            }
        }
    });
}

// Cek wave selesai
function checkWaveComplete() {
    const activeAliens = aliens.filter(a => a.state !== ALIEN_STATES.FORMATION).length;
    
    if (activeAliens === 0 && aliens.length > 0) {
        // Wave selesai, buat wave baru
        wave++;
        initAliens();
        updateUI();
        
        // Tampilkan pesan wave baru
        showWaveMessage();
    }
}

// Tampilkan pesan wave
let waveMessageTimer = 0;
function showWaveMessage() {
    waveMessageTimer = 120;
}

function drawWaveMessage() {
    if (waveMessageTimer > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(0, 255, 255, ${waveMessageTimer / 120})`;
        ctx.font = 'bold 48px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(`WAVE ${wave}`, canvas.width / 2, canvas.height / 2);
        ctx.restore();
        waveMessageTimer--;
    }
}

// ==================== GAME LOOP ====================
function gameLoop() {
    if (!gameRunning) return;
    
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update & draw stars
    stars.forEach(star => {
        star.update();
        star.draw();
    });
    
    // Update player
    player.update();
    player.draw();
    
    // Update & draw aliens
    aliens.forEach(alien => {
        alien.update(player, bullets);
        alien.draw();
    });
    
    // Update & draw bullets
    bullets = bullets.filter(bullet => {
        bullet.y += bullet.isPlayer ? -bullet.speed : bullet.speed;
        
        ctx.fillStyle = bullet.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = bullet.color;
        ctx.fillRect(bullet.x - bullet.width/2, bullet.y - bullet.height/2, bullet.width, bullet.height);
        ctx.shadowBlur = 0;
        
        return bullet.y > -10 && bullet.y < canvas.height + 10;
    });
    
    // Update & draw particles
    particles = particles.filter(particle => {
        particle.update();
        particle.draw();
        return particle.life > 0;
    });
    
    // Trigger alien dive (TUGAS 3)
    triggerAlienDive();
    
    // Cek collision
    checkCollisions();
    
    // Cek wave selesai
    checkWaveComplete();
    
    // Draw wave message
    drawWaveMessage();
    
    requestAnimationFrame(gameLoop);
}

// ==================== GAME CONTROL ====================
function startGame() {
    gameRunning = true;
    score = 0;
    wave = 1;
    lives = 3;
    bullets = [];
    particles = [];
    
    player = new Player();
    initStars();
    initAliens();
    updateUI();
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    gameLoop();
}

function endGame() {
    gameRunning = false;
    finalScoreElement.textContent = score;
    gameOverScreen.classList.remove('hidden');
}

function restartGame() {
    startGame();
}

// ==================== EVENT LISTENERS ====================
window.addEventListener('keydown', e => {
    keys[e.key] = true;
    
    // Player shoot dengan SPACE
    if (e.key === ' ' && gameRunning) {
        player.shoot(bullets);
    }
});

window.addEventListener('keyup', e => {
    keys[e.key] = false;
});

// ==================== INITIALIZATION ====================
initStars();

// Draw initial stars
function initialDraw() {
    if (!gameRunning) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        stars.forEach(star => {
            star.update();
            star.draw();
        });
        
        requestAnimationFrame(initialDraw);
    }
}
initialDraw();

console.log("🎮 Game Space Shooter FSM siap!");
console.log("Kontrol: Arrow Keys untuk gerak, SPACE untuk menembak");
/**
 * "The Fry Catcher" - Katia's Birthday Edition
 * Developed for Vercel deployment (Vanilla JS + Canvas)
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startOverlay = document.getElementById('start-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const scoreVal = document.getElementById('score-val');
const timerVal = document.getElementById('timer-val');
const finalScoreVal = document.getElementById('final-score-val');
const invincibilityUI = document.getElementById('invincibility-ui');
const bgm = document.getElementById('bgm');
const partyBgm = document.getElementById('party-bgm');


// Game Constants (Dynamic)
let GAME_WIDTH = window.innerWidth;
let GAME_HEIGHT = window.innerHeight;
let PLAYER_WIDTH = 150;
let PLAYER_HEIGHT = 150;
const BASE_PLAYER_SIZE = 150;
const MAX_FRIES_FOR_FULL = 50; 
const FRY_TYPES = {
    GOLDEN: { color: '#ffcc33', points: 10, speed: 3, label: 'Perfectly Golden' },
    BAKED: { color: '#f39c12', points: 15, speed: 4.5, label: 'Nicely Baked' },
    SOGGY: { color: '#f5e0a3', points: -5, speed: 2, label: 'Soggy' },
    BURNT: { color: '#3e2723', points: -10, speed: 4, label: 'Burnt Black' },
    CAKE: { color: 'rainbow', points: 0, speed: 5, label: 'Birthday Cake Fry', type: 'special' }
};


// Assets & Audio Pooling
const CRUNCH_POOL_SIZE = 8;
const crunchPool = [];

const assets = {
    player: {
        neutral: new Image(),
        happy: new Image(),
        sad: new Image()
    },
    crunchSamples: [
        'assets/crunch1.WAV',
        'assets/crunch2.WAV',
        'assets/crunch3.WAV'
    ]
};

function initAudioPool() {
    for (let i = 0; i < CRUNCH_POOL_SIZE; i++) {
        const audio = new Audio();
        audio.src = assets.crunchSamples[i % assets.crunchSamples.length];
        audio.preload = 'auto';
        crunchPool.push(audio);
    }
}

assets.player.neutral.src = 'assets/neutral.png';
assets.player.happy.src = 'assets/happy.png';
assets.player.sad.src = 'assets/sad.png';

// Game State
let gameState = 'MENU'; // MENU, PLAYING, OVER
let score = 0;
let friesCaught = 0;
let timeLeft = 60;
let fries = [];
let particles = [];
let isInvincible = false;
let invincibilityTimer = 0;
let lastTime = 0;
let spawnTimer = 0;
let gameTimerId = null;
let floatingTexts = [];
let hasSpawnedCake = false;


// Player Object
const player = {
    x: GAME_WIDTH / 2 - PLAYER_WIDTH / 2,
    y: GAME_HEIGHT - PLAYER_HEIGHT, // Stick to bottom (removed -10 gap)
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    speed: 12,
    dx: 0,
    targetX: GAME_WIDTH / 2 - PLAYER_WIDTH / 2,
    expression: 'neutral',
    expressionTimer: 0
};

// --- Initialization ---

function init() {
    initAudioPool();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Controls
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove);

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);

    // Control bar touch handling
    const controlBar = document.getElementById('control-bar');
    if (controlBar) {
        controlBar.addEventListener('touchstart', handleTouchMove, { passive: false });
        controlBar.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    // Get actual dimensions from the container (account for flex layout and control bar)
    const container = canvas.parentElement;
    GAME_WIDTH = container.clientWidth;
    GAME_HEIGHT = canvas.clientHeight; // Use canvas client height directly
    
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    // Scale player for mobile if screen is small
    if (GAME_WIDTH < 600) {
        PLAYER_WIDTH = Math.min(BASE_PLAYER_SIZE, GAME_WIDTH * 0.35);
        PLAYER_HEIGHT = PLAYER_WIDTH; // Keep square
    } else {
        PLAYER_WIDTH = BASE_PLAYER_SIZE;
        PLAYER_HEIGHT = BASE_PLAYER_SIZE;
    }

    // Update player Y to stick to bottom
    player.width = PLAYER_WIDTH;
    player.height = PLAYER_HEIGHT;
    player.y = GAME_HEIGHT - PLAYER_HEIGHT;

    // Enable Nearest Neighbor Scaling for crisp pixels
    ctx.imageSmoothingEnabled = false;
}


// --- Classes ---

class Fry {
    constructor(type) {
        this.type = type;
        this.width = (type === FRY_TYPES.CAKE) ? 60 : 12;
        this.height = (type === FRY_TYPES.CAKE) ? 60 : 46; // 30% longer (35 * 1.3 ≈ 46)
        this.x = Math.random() * (GAME_WIDTH - this.width);
        this.y = -50;
        this.speed = type.speed + (Math.random() * 2);
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.1;
    }

    update() {
        this.y += this.speed;
        this.rotation += this.rotSpeed;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);

        if (this.type === FRY_TYPES.CAKE) {
            // Draw Birthday Cake Icon (Larger for visibility)
            ctx.font = '50px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🎂', 0, 0);
        } else {
            // Draw stylized Fry
            ctx.fillStyle = this.type.color;
            ctx.beginPath();
            ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, 3);
            ctx.fill();
            
            // Highlights
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width / 3, this.height);
        }
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 6 + 2;
        this.speedX = (Math.random() - 0.5) * 10;
        this.speedY = (Math.random() - 0.5) * 10;
        this.gravity = 0.2;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.005;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedY += this.gravity;
        this.life -= this.decay;
    }

    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        if (Math.random() > 0.5) {
            ctx.rect(this.x, this.y, this.size, this.size);
        } else {
            ctx.arc(this.x, this.y, this.size/2, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.opacity = 1;
        this.life = 1000; // 1 second
    }

    update(deltaTime) {
        this.y -= 1.2; // Drift up
        this.life -= deltaTime;
        this.opacity = Math.max(0, this.life / 1000);
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 24px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// --- Logic ---

function startGame() {
    score = 0;
    friesCaught = 0;
    timeLeft = 60;
    fries = [];
    particles = [];
    floatingTexts = [];
    isInvincible = false;
    invincibilityTimer = 0;
    hasSpawnedCake = false;
    player.expression = 'neutral';
    gameState = 'PLAYING';

    
    scoreVal.textContent = score;
    timerVal.textContent = timeLeft;
    updateProgressUI();
    
    // iOS Audio Unlock Logic
    unlockAudio();

    // Start Soundtrack
    bgm.currentTime = 0;
    bgm.play().catch((e) => console.log("BGM play error:", e)); 

    startOverlay.classList.remove('active');
    gameOverOverlay.classList.remove('active');
    invincibilityUI.classList.remove('active');

    if (gameTimerId) clearInterval(gameTimerId);
    gameTimerId = setInterval(updateTimer, 1000);
}

function updateTimer() {
    if (gameState !== 'PLAYING') return;
    timeLeft--;
    timerVal.textContent = timeLeft;

    // Pulse BGM volume slightly or check playback
    if (bgm.paused && timeLeft > 0) bgm.play().catch(() => {});

    if (timeLeft <= 0) endGame();
}

function unlockAudio() {
    const allAudio = [bgm, partyBgm, ...crunchPool];
    allAudio.forEach(a => {
        a.muted = true;
        a.play().then(() => {
            a.pause();
            a.muted = false;
        }).catch(e => console.log("Unlock failed for one element", e));
    });
}

function endGame() {
    gameState = 'OVER';
    clearInterval(gameTimerId);
    
    // Calculate Grade
    const percent = Math.min(100, Math.floor((friesCaught / MAX_FRIES_FOR_FULL) * 100));
    let grade = 'F';
    let gradeColor = '#e74c3c';

    if (percent >= 90) { grade = 'A+'; gradeColor = '#f1c40f'; }
    else if (percent >= 80) { grade = 'A'; gradeColor = '#2ecc71'; }
    else if (percent >= 70) { grade = 'B'; gradeColor = '#3498db'; }
    else if (percent >= 50) { grade = 'C'; gradeColor = '#9b59b6'; }
    else if (percent >= 30) { grade = 'D'; gradeColor = '#e67e22'; }

    finalScoreVal.textContent = score;
    const gradeVal = document.getElementById('final-grade-val');
    gradeVal.textContent = grade;
    gradeVal.style.color = gradeColor;
    
    gameOverOverlay.classList.add('active');
}

let crunchIndex = 0;
function playCrunch() {
    const sound = crunchPool[crunchIndex];
    sound.currentTime = 0;
    sound.volume = 0.5; // Lowered further for iOS overlap comfort
    sound.play().catch(() => {});
    
    crunchIndex = (crunchIndex + 1) % CRUNCH_POOL_SIZE;
}

function handleKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a') player.dx = -player.speed;
    if (e.key === 'ArrowRight' || e.key === 'd') player.dx = player.speed;
}

function handleKeyUp(e) {
    if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) player.dx = 0;
}

function handleMouseMove(e) {
    if (gameState !== 'PLAYING') return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    player.targetX = (e.clientX - rect.left) * scaleX - player.width / 2;
}

function handleTouchMove(e) {
    if (gameState !== 'PLAYING') return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    player.targetX = (e.touches[0].clientX - rect.left) * scaleX - player.width / 2;
}

function updatePlayer() {
    // Keyboard movement
    if (player.dx !== 0) {
        player.x += player.dx;
        player.targetX = player.x; // Sync target for mouse logic
    } else {
        // Smooth Mouse following
        const diff = player.targetX - player.x;
        player.x += diff * 0.15;
    }

    // Bounds
    if (player.x < 0) player.x = 0;
    if (player.x > GAME_WIDTH - player.width) player.x = GAME_WIDTH - player.width;
}

function drawPlayer() {
    ctx.save();
    
    const x = player.x;
    const y = player.y;
    const w = player.width;
    const h = player.height;

    // Determine which image to draw
    let img = assets.player.neutral;
    if (player.expression === 'happy') img = assets.player.happy;
    if (player.expression === 'sad') img = assets.player.sad;

    // If invincible, add a neon pulsing border
    if (isInvincible) {
        ctx.strokeStyle = `hsl(${Date.now() % 360}, 100%, 50%)`;
        ctx.lineWidth = 5;
        ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
        
        // Add a pulsing inner glow manually (fast)
        ctx.fillStyle = `hsla(${Date.now() % 360}, 100%, 50%, 0.2)`;
        ctx.fillRect(x, y, w, h);
    }

    // Draw Avatar Image
    if (img.complete) {
        ctx.drawImage(img, x, y, w, h);
    } else {
        // Fallback to simple rectangle if image not loaded
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x, y + 20, w, h - 20);
    }

    ctx.restore();
}

function updateProgressUI() {
    const percent = Math.min(100, Math.floor((friesCaught / MAX_FRIES_FOR_FULL) * 100));
    const displayPercent = Math.floor(percent / 5) * 5; // Finer grain (5%)
    
    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-percent');
    
    fill.style.width = `${displayPercent}%`;
    text.textContent = `${displayPercent}%`;
}


function spawnFry() {
    const r = Math.random();
    let type;
    
    // Cake only appears after 15 seconds ( timeLeft <= 45 )
    // OR force spawn if 30 seconds left and none have spawned
    const shouldForceCake = (timeLeft <= 30 && !hasSpawnedCake);
    
    if ((r < 0.05 && timeLeft <= 45) || shouldForceCake) {
        type = FRY_TYPES.CAKE;
        hasSpawnedCake = true;
    } else if (r < 0.2) {

        type = FRY_TYPES.BURNT;
    } else if (r < 0.4) {
        type = FRY_TYPES.SOGGY;
    } else if (r < 0.65) {
        type = FRY_TYPES.BAKED;
    } else {
        type = FRY_TYPES.GOLDEN;
    }

    fries.push(new Fry(type));
}


function createConfetti(x, y) {
    const colors = ['#f39c12', '#e74c3c', '#9b59b6', '#3498db', '#2ecc71', '#ff00ff', '#00ffff'];
    for (let i = 0; i < 30; i++) {
        particles.push(new Particle(x, y, colors[Math.floor(Math.random() * colors.length)]));
    }
}

function update(deltaTime) {
    if (gameState !== 'PLAYING') {
        // Background particles always update
        particles.forEach((p, index) => {
            p.update();
            if (p.life <= 0) particles.splice(index, 1);
        });
        return;
    }

    updatePlayer();

    // Spawn logic
    spawnTimer += deltaTime;
    if (spawnTimer > 800) { // Spawn every 0.8s
        spawnFry();
        spawnTimer = 0;
    }

    // Fries logic
    fries.forEach((f, index) => {
        f.update();

        // Collision detection (offset by ~35% height to fit bucket location)
        if (f.y + f.height > player.y + (player.height * 0.35) && 
            f.y < player.y + (player.height * 0.6) && 
            f.x + f.width > player.x && 
            f.x < player.x + player.width) {
            
            // Caught!
            playCrunch();
            if (f.type === FRY_TYPES.CAKE) {
                const hadInvincibility = isInvincible;
                triggerInvincibility();
                createConfetti(GAME_WIDTH / 2, GAME_HEIGHT / 2);
                player.expression = 'happy';
                player.expressionTimer = 1000;
                
                if (hadInvincibility) {
                    // Visual feedback for extension
                    floatingTexts.push(new FloatingText(player.x + player.width/2, player.y - 40, "+3s EXTENDED!", "#ff00ff"));
                }
            } else {

                let p = f.type.points;
                let multiplier = 1;
                let pText = "";
                let pColor = (p > 0) ? '#2ecc71' : '#e74c3c';

                if (isInvincible) {
                    if (p > 0) {
                        multiplier = 2;
                        p *= 2;
                        pText = "x2! ";
                        pColor = "#ff00ff"; // Party color
                    } else {
                        // Logic for blocked negative points
                        floatingTexts.push(new FloatingText(player.x + player.width/2, player.y, "🚫 BLOCKED!", "#ffffff"));
                        p = 0; // Negative points not counting
                    }
                }

                if (p !== 0 || (isInvincible && f.type.points > 0)) {
                    score += p;
                    player.expression = (f.type.points > 0) ? 'happy' : 'sad';
                    
                    if (p !== 0) {
                        floatingTexts.push(new FloatingText(player.x + player.width/2, player.y, pText + (p > 0 ? "+" : "") + p, pColor));
                    }
                    
                    // Progress adjustment for double points
                    friesCaught += multiplier;
                    updateProgressUI();
                }
                player.expressionTimer = 500;
            }
            
            if (score < 0) score = 0;
            scoreVal.textContent = score;
            fries.splice(index, 1);
            
            // Small hit effect
            createConfetti(f.x, f.y);

        }

        // Out of bounds
        if (f.y > GAME_HEIGHT) {
            fries.splice(index, 1);
        }
    });

    // Particles logic
    particles.forEach((p, index) => {
        p.update();
        if (p.life <= 0) particles.splice(index, 1);
    });

    // Floating text logic
    floatingTexts.forEach((ft, index) => {
        ft.update(deltaTime);
        if (ft.life <= 0) floatingTexts.splice(index, 1);
    });

    // Player expression timer
    if (player.expressionTimer > 0) {
        player.expressionTimer -= deltaTime;
        if (player.expressionTimer <= 0) {
            player.expression = 'neutral';
        }
    }

    // Invincibility management
    if (isInvincible) {
        invincibilityTimer -= deltaTime;
        
        // Update Party Timer UI
        const partyTimerDisplay = document.getElementById('party-timer');
        if (partyTimerDisplay) {
            partyTimerDisplay.textContent = (Math.max(0, invincibilityTimer) / 1000).toFixed(1) + "s";
        }

        // Celebration confetti

        if (Math.random() < 0.2) {
            createConfetti(Math.random() * GAME_WIDTH, 0);
        }
        if (invincibilityTimer <= 0) {
            isInvincible = false;
            invincibilityUI.classList.remove('active');
            // Unmute BGM and stop party music
            bgm.muted = false;
            partyBgm.pause();
            partyBgm.currentTime = 0;
        }

    }
}

function triggerInvincibility() {
    if (isInvincible) {
        // Extend duration
        invincibilityTimer += 3000; // Add 3 seconds
    } else {
        // New activation
        isInvincible = true;
        invincibilityTimer = 12000; 
        invincibilityUI.classList.add('active');
        
        // Mute BGM and play party music
        bgm.muted = true;
        partyBgm.currentTime = 0;
        partyBgm.play().catch(() => {});
    }
}



function draw() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (gameState === 'PLAYING' || gameState === 'OVER') {
        fries.forEach(f => f.draw());
        drawPlayer();
    }

    particles.forEach(p => p.draw());
    floatingTexts.forEach(ft => ft.draw());

    // Decorative background if MENU
    if (gameState === 'MENU' && Math.random() < 0.05) {
        createConfetti(Math.random() * GAME_WIDTH, -10);
    }
}

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

// Start
init();

const RAD = Math.PI / 180;
const scrn = document.getElementById("canvas");
const sctx = scrn.getContext("2d");
scrn.tabIndex = 1;

// Set image smoothing to false to prevent blurriness when scaling
sctx.imageSmoothingEnabled = false;

// Define a scaling factor
const SCALE_FACTOR = 2;

// ------------------ FLASH EFFECT ------------------
const flash = {
    opacity: 0,
    draw: function () {
        if (this.opacity > 0) {
            sctx.fillStyle = `rgba(255,255,255,${this.opacity})`;
            sctx.fillRect(0, 0, scrn.width, scrn.height);
            this.opacity -= 0.05;
            if (this.opacity < 0) this.opacity = 0;
        }
    },
    trigger: function () {
        this.opacity = 1;
    },
};

// ------------------ GAME STATE ------------------
let frames = 0;
let dx = 1.5 * SCALE_FACTOR; // pipe speed, scaled
const state = { curr: 0, getReady: 0, Play: 1, gameOver: 2 };

// ------------------ AUDIO ------------------
const SFX = {
    start: new Audio(),
    // flap sound is now handled by a new Audio() instance in the flap function
    score: new Audio(),
    hit: new Audio(),
    die: new Audio(),
    played: false,
};

// ------------------ GROUND ------------------
const gnd = {
    sprite: new Image(),
    x: 0,
    y: 0,
    draw: function () {
        this.y = parseFloat(scrn.height - this.sprite.height * SCALE_FACTOR);
        sctx.drawImage(this.sprite, this.x, this.y, this.sprite.width * SCALE_FACTOR, this.sprite.height * SCALE_FACTOR);
        sctx.drawImage(this.sprite, this.x + this.sprite.width * SCALE_FACTOR, this.y, this.sprite.width * SCALE_FACTOR, this.sprite.height * SCALE_FACTOR);
    },
    update: function (delta) {
        if (state.curr != state.Play) return;
        this.x -= dx * delta * 60;
        if (this.x < -this.sprite.width * SCALE_FACTOR) {
            this.x = 0;
        }
    },
};

// ------------------ BACKGROUND ------------------
const bg = {
    sprite: new Image(),
    x: 0,
    y: 0,
    draw: function () {
        let y = parseFloat(scrn.height - this.sprite.height * SCALE_FACTOR);
        sctx.drawImage(this.sprite, this.x, y, this.sprite.width * SCALE_FACTOR, this.sprite.height * SCALE_FACTOR);
    },
};

// ------------------ PIPES ------------------
let timeSinceLastPipe = 0;
const pipeInterval = 1.7; // seconds between new pipes

const pipe = {
    top: { sprite: new Image() },
    bot: { sprite: new Image() },
    gap: 85 * SCALE_FACTOR,
    moved: true,
    pipes: [],
    draw: function () {
        for (let i = 0; i < this.pipes.length; i++) {
            let p = this.pipes[i];
            sctx.drawImage(this.top.sprite, p.x, p.y, this.top.sprite.width * SCALE_FACTOR, this.top.sprite.height * SCALE_FACTOR);
            sctx.drawImage(this.bot.sprite, p.x, p.y + parseFloat(this.top.sprite.height * SCALE_FACTOR) + this.gap, this.bot.sprite.width * SCALE_FACTOR, this.bot.sprite.height * SCALE_FACTOR);
        }
    },
    update: function (delta) {
        if (state.curr != state.Play) return;

        timeSinceLastPipe += delta;
        if (timeSinceLastPipe >= pipeInterval) {
            this.pipes.push({
                x: parseFloat(scrn.width),
                y: -210 * Math.min(Math.random() + 1, 1.8) * SCALE_FACTOR,
            });
            timeSinceLastPipe = 0;
        }

        this.pipes.forEach((pipe) => {
            pipe.x -= dx * delta * 60;
        });

        if (this.pipes.length && this.pipes[0].x < -this.top.sprite.width * SCALE_FACTOR) {
            this.pipes.shift();
            this.moved = true;
        }
    },
};

// ------------------ BIRD ------------------
const bird = {
    animations: [
        { sprite: new Image() },
        { sprite: new Image() },
        { sprite: new Image() },
        { sprite: new Image() },
    ],
    rotatation: 0,
    x: 50 * SCALE_FACTOR,
    y: 100 * SCALE_FACTOR,
    speed: 0,
    gravity: 0.08 * SCALE_FACTOR,
    thrust: 2.5 * SCALE_FACTOR,
    frame: 0,
    draw: function () {
        let h = this.animations[this.frame].sprite.height * SCALE_FACTOR;
        let w = this.animations[this.frame].sprite.width * SCALE_FACTOR;
        sctx.save();
        sctx.translate(this.x, this.y);
        sctx.rotate(this.rotatation * RAD);
        sctx.drawImage(this.animations[this.frame].sprite, -w / 2, -h / 2, w, h);
        sctx.restore();
    },
    update: function (delta) {
        let r = parseFloat(this.animations[0].sprite.width * SCALE_FACTOR) / 2;
        switch (state.curr) {
            case state.getReady:
                this.rotatation = 0;
                this.y += frames % 10 == 0 ? Math.sin(frames * RAD) * SCALE_FACTOR : 0;
                this.frame += frames % 10 == 0 ? 1 : 0;
                break;
            case state.Play:
                this.frame += frames % 5 == 0 ? 1 : 0;
                this.y += this.speed * delta * 60;
                this.setRotation();
                this.speed += this.gravity * delta * 60;
                if (this.y + r >= gnd.y || this.collisioned()) {
                    state.curr = state.gameOver;
                }
                break;
            case state.gameOver:
                this.frame = 1;
                if (this.y + r < gnd.y) {
                    this.y += this.speed * delta * 60;
                    this.setRotation();
                    this.speed += this.gravity * 2 * delta * 60;
                } else {
                    this.speed = 0;
                    this.y = gnd.y - r;
                    this.rotatation = 90;
                    if (!SFX.played) {
                        SFX.die.play();
                        SFX.played = true;
                    }
                }
                break;
        }
        this.frame = this.frame % this.animations.length;
    },
    flap: function () {
        if (this.y > 0) {
            new Audio("sfx/flap.wav").play();
            this.speed = -this.thrust;
        }
    },
    setRotation: function () {
        if (this.speed <= 0) {
            this.rotatation = Math.max(-25, (-25 * this.speed) / (-1 * this.thrust));
        } else if (this.speed > 0) {
            this.rotatation = Math.min(90, (90 * this.speed) / (this.thrust * 2));
        }
    },
    collisioned: function () {
        if (!pipe.pipes.length) return;
        let birdSprite = this.animations[0].sprite;
        let x = pipe.pipes[0].x;
        let y = pipe.pipes[0].y;
        let r = (birdSprite.height / 4 + birdSprite.width / 4) * SCALE_FACTOR;
        let roof = y + parseFloat(pipe.top.sprite.height * SCALE_FACTOR);
        let floor = roof + pipe.gap;
        let w = parseFloat(pipe.top.sprite.width * SCALE_FACTOR);
        if (this.x + r >= x) {
            if (this.x + r < x + w) {
                if (this.y - r <= roof || this.y + r >= floor) {
                    SFX.hit.play();
                    flash.trigger();
                    return true;
                }
            } else if (pipe.moved) {
                UI.score.curr++;
                SFX.score.play();
                pipe.moved = false;
            }
        }
    },
};

// ------------------ UI ------------------
const UI = {
    getReady: { sprite: new Image() },
    gameOver: { sprite: new Image() },
    tap: [{ sprite: new Image() }, { sprite: new Image() }],
    score: { curr: 0, best: 0 },
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    frame: 0,
    animating: false,
    currentY: 0,
    targetY: 0,
    draw: function () {
        switch (state.curr) {
            case state.getReady:
                this.y = parseFloat(scrn.height - this.getReady.sprite.height * SCALE_FACTOR) / 2;
                this.x = parseFloat(scrn.width - this.getReady.sprite.width * SCALE_FACTOR) / 2;
                this.tx = parseFloat(scrn.width - this.tap[0].sprite.width * SCALE_FACTOR) / 2;
                this.ty = this.y + this.getReady.sprite.height * SCALE_FACTOR - this.tap[0].sprite.height * SCALE_FACTOR;
                sctx.drawImage(this.getReady.sprite, this.x, this.y, this.getReady.sprite.width * SCALE_FACTOR, this.getReady.sprite.height * SCALE_FACTOR);
                sctx.drawImage(this.tap[this.frame].sprite, this.tx, this.ty, this.tap[this.frame].sprite.width * SCALE_FACTOR, this.tap[this.frame].sprite.height * SCALE_FACTOR);
                break;
            case state.gameOver:
                if (!this.animating) {
                    this.animating = true;
                    this.currentY = scrn.height;
                    this.targetY = parseFloat(scrn.height - this.gameOver.sprite.height * SCALE_FACTOR) / 2;
                }

                let speed = 0.15;
                this.currentY += (this.targetY - this.currentY) * speed;

                this.x = parseFloat(scrn.width - this.gameOver.sprite.width * SCALE_FACTOR) / 2;
                this.tx = parseFloat(scrn.width - this.tap[0].sprite.width * SCALE_FACTOR) / 2;
                this.ty = this.currentY + this.gameOver.sprite.height * SCALE_FACTOR - this.tap[0].sprite.height * SCALE_FACTOR;

                sctx.drawImage(this.gameOver.sprite, this.x, this.currentY, this.gameOver.sprite.width * SCALE_FACTOR, this.gameOver.sprite.height * SCALE_FACTOR);
                sctx.drawImage(this.tap[this.frame].sprite, this.tx, this.ty, this.tap[this.frame].sprite.width * SCALE_FACTOR, this.tap[this.frame].sprite.height * SCALE_FACTOR);
                break;
        }
        this.drawScore();
    },
    drawScore: function () {
        sctx.fillStyle = "#FFFFFF";
        sctx.strokeStyle = "#000000";

        switch (state.curr) {
            case state.Play:
                sctx.lineWidth = "4";
                sctx.font = "70px Squada One";
                sctx.fillText(this.score.curr, scrn.width / 2 - 10, 100);
                sctx.strokeText(this.score.curr, scrn.width / 2 - 10, 100);
                break;

            case state.gameOver:
                sctx.lineWidth = "4";
                sctx.font = "80px Squada One";

                let sc = `SCORE : ${this.score.curr}`;
                try {
                    this.score.best = Math.max(this.score.curr, localStorage.getItem("best"));
                    localStorage.setItem("best", this.score.best);
                    let bs = `BEST : ${this.score.best}`;
                    sctx.fillText(sc, scrn.width / 2 - 160, this.currentY + 136);
                    sctx.strokeText(sc, scrn.width / 2 - 160, this.currentY + 136);
                    sctx.fillText(bs, scrn.width / 2 - 160, this.currentY + 216);
                    sctx.strokeText(bs, scrn.width / 2 - 160, this.currentY + 216);
                } catch (e) {
                    sctx.fillText(sc, scrn.width / 2 - 170, this.currentY + 136);
                    sctx.strokeText(sc, scrn.width / 2 - 170, this.currentY + 136);
                }
                break;
        }
    },
    update: function () {
        if (state.curr == state.Play) return;
        this.frame += frames % 40 == 0 ? 1 : 0;
        this.frame = this.frame % this.tap.length;
    },
};

// ------------------ INPUT ------------------
function canTap() {
    return state.curr !== state.gameOver || (state.curr === state.gameOver && Math.abs(UI.currentY - UI.targetY) < 1);
}

scrn.addEventListener("click", () => {
    if (!canTap()) return;
    switch (state.curr) {
        case state.getReady:
            state.curr = state.Play;
            SFX.start.play();
            break;
        case state.Play:
            bird.flap();
            break;
        case state.gameOver:
            state.curr = state.getReady;
            bird.speed = 0;
            bird.y = 100 * SCALE_FACTOR;
            pipe.pipes = [];
            UI.score.curr = 0;
            SFX.played = false;
            UI.animating = false;
            break;
    }
});

scrn.onkeydown = function keyDown(e) {
    if (!canTap()) return;
    if (e.keyCode == 32 || e.keyCode == 87 || e.keyCode == 38) {
        switch (state.curr) {
            case state.getReady:
                state.curr = state.Play;
                SFX.start.play();
                break;
            case state.Play:
                bird.flap();
                break;
            case state.gameOver:
                state.curr = state.getReady;
                bird.speed = 0;
                bird.y = 100 * SCALE_FACTOR;
                pipe.pipes = [];
                UI.score.curr = 0;
                SFX.played = false;
                UI.animating = false;
                break;
        }
    }
};

// ------------------ RESOURCES ------------------
gnd.sprite.src = "img/ground.png";
bg.sprite.src = "img/BG.png";
pipe.top.sprite.src = "img/toppipe.png";
pipe.bot.sprite.src = "img/botpipe.png";
UI.gameOver.sprite.src = "img/go.png";
UI.getReady.sprite.src = "img/getready.png";
UI.tap[0].sprite.src = "img/tap/t0.png";
UI.tap[1].sprite.src = "img/tap/t1.png";
bird.animations[0].sprite.src = "img/bird/b0.png";
bird.animations[1].sprite.src = "img/bird/b1.png";
bird.animations[2].sprite.src = "img/bird/b2.png";
bird.animations[3].sprite.src = "img/bird/b0.png";
SFX.start.src = "sfx/start.wav";
SFX.score.src = "sfx/score.wav";
SFX.hit.src = "sfx/hit.wav";
SFX.die.src = "sfx/die.wav";

// ------------------ GAME LOOP ------------------
let lastTime = performance.now();

function gameLoop(now) {
    const delta = (now - lastTime) / 1000; // seconds since last frame
    lastTime = now;

    update(delta);
    draw();
    frames++;
    requestAnimationFrame(gameLoop);
}

function update(delta) {
    bird.update(delta);
    gnd.update(delta);
    pipe.update(delta);
    UI.update(delta);
}

function draw() {
    sctx.fillStyle = "#30c0df";
    sctx.fillRect(0, 0, scrn.width, scrn.height);
    bg.draw();
    pipe.draw();
    bird.draw();
    gnd.draw();
    UI.draw();
    flash.draw();
}

// Start the game
requestAnimationFrame(gameLoop);

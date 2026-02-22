import { playSound } from './audio.js';
import { MAX_PARTICLES } from './config.js';

let comboFireTimeout = null;

function getTileEl(r, c) {
    return document.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
}

export function showCombo(n) {
    const el = document.createElement('div');
    el.className = 'combo';

    if (n >= 7) {
        el.classList.add('combo-level-3');
        el.textContent = `🔥🔥 MEGA x${n}! 🔥🔥`;
    } else if (n >= 5) {
        el.classList.add('combo-level-2');
        el.textContent = `🔥 Combo x${n}! 🔥`;
    } else {
        el.classList.add('combo-level-1');
        el.textContent = `Combo x${n}! 🔥`;
    }

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);

    const boardEl = document.getElementById('board');
    if (boardEl && n >= 3) {
        const shakeClass = n >= 5 ? 'board-shake-strong' : 'board-shake';
        boardEl.classList.remove('board-shake', 'board-shake-strong');
        void boardEl.offsetWidth;
        boardEl.classList.add(shakeClass);
        setTimeout(() => boardEl.classList.remove(shakeClass), 500);
    }

    const container = document.querySelector('.board-container');
    if (container) {
        container.classList.remove('combo-fire', 'combo-fire-intense', 'combo-fire-max');
        if (n >= 7) {
            container.classList.add('combo-fire-max');
        } else if (n >= 5) {
            container.classList.add('combo-fire-intense');
        } else if (n >= 3) {
            container.classList.add('combo-fire');
        }

        clearTimeout(comboFireTimeout);
        comboFireTimeout = setTimeout(() => {
            container.classList.remove('combo-fire', 'combo-fire-intense', 'combo-fire-max');
        }, 2000);
    }

    if (n >= 7) {
        spawnGodRays();
        showCinematicVignette(1200);
        showScreenTint('golden', 1000);
    } else if (n >= 5) {
        boardCinematicZoom(800);
        showScreenTint('golden', 600);
    } else if (n >= 3) {
        showScreenTint('pink', 500);
    }
}

export function spawnRocketTrail(r, c, direction) {
    const board = document.getElementById('board');
    if (!board) return;
    const tile = getTileEl(r, c);
    if (!tile) return;
    playSound('rocket');

    const trail = document.createElement('div');
    trail.className = 'rocket-trail';

    if (direction === 'h') {
        trail.classList.add('rocket-trail-h');
        const tileRect = tile.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();
        trail.style.top = (tileRect.top - boardRect.top + tileRect.height / 2) + 'px';
        trail.style.left = '0';
        trail.style.right = '0';
    } else {
        trail.classList.add('rocket-trail-v');
        const tileRect = tile.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();
        trail.style.left = (tileRect.left - boardRect.left + tileRect.width / 2) + 'px';
        trail.style.top = '0';
        trail.style.bottom = '0';
    }

    board.style.position = 'relative';
    board.appendChild(trail);
    setTimeout(() => trail.remove(), 500);
}

export function spawnBombShockwave(r, c) {
    const board = document.getElementById('board');
    if (!board) return;
    const tile = getTileEl(r, c);
    if (!tile) return;
    playSound('bomb');

    const tileRect = tile.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const cx = tileRect.left - boardRect.left + tileRect.width / 2;
    const cy = tileRect.top - boardRect.top + tileRect.height / 2;

    const wave = document.createElement('div');
    wave.className = 'bomb-shockwave';
    wave.style.left = cx + 'px';
    wave.style.top = cy + 'px';
    wave.style.transform = 'translate(-50%, -50%)';
    board.style.position = 'relative';
    board.appendChild(wave);
    setTimeout(() => wave.remove(), 600);

    setTimeout(() => {
        const wave2 = document.createElement('div');
        wave2.className = 'bomb-shockwave';
        wave2.style.left = cx + 'px';
        wave2.style.top = cy + 'px';
        wave2.style.transform = 'translate(-50%, -50%)';
        wave2.style.borderColor = 'rgba(255, 200, 0, 0.7)';
        board.appendChild(wave2);
        setTimeout(() => wave2.remove(), 600);
    }, 100);

    const flash = document.createElement('div');
    flash.className = 'bomb-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 400);

    const screenX = tileRect.left + tileRect.width / 2;
    const screenY = tileRect.top + tileRect.height / 2;
    spawnLightBurst(screenX, screenY);

    if (board) {
        board.classList.remove('board-shake', 'board-shake-strong');
        void board.offsetWidth;
        board.classList.add('board-shake');
        setTimeout(() => board.classList.remove('board-shake'), 500);
    }
}

export function spawnRainbowWave(r, c) {
    const board = document.getElementById('board');
    if (!board) return;
    const tile = getTileEl(r, c);
    if (!tile) return;

    const tileRect = tile.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const cx = tileRect.left - boardRect.left + tileRect.width / 2;
    const cy = tileRect.top - boardRect.top + tileRect.height / 2;

    playSound('rainbow');
    const wave = document.createElement('div');
    wave.className = 'rainbow-wave';
    wave.style.left = cx + 'px';
    wave.style.top = cy + 'px';
    wave.style.transform = 'translate(-50%, -50%)';
    board.style.position = 'relative';
    board.appendChild(wave);
    setTimeout(() => wave.remove(), 700);

    spawnGodRays();
    showScreenTint('rainbow', 1000);
    boardCinematicZoom(800);
}

export function spawnLightningEffect(r, c, targetKeys) {
    const sourceTile = getTileEl(r, c);
    if (!sourceTile) return;
    const sourceRect = sourceTile.getBoundingClientRect();
    const sx = sourceRect.left + sourceRect.width / 2;
    const sy = sourceRect.top + sourceRect.height / 2;

    playSound('lightning');

    const boardEl = document.getElementById('board');
    if (boardEl) {
        boardEl.classList.remove('board-shake');
        void boardEl.offsetWidth;
        boardEl.classList.add('board-shake');
        setTimeout(() => boardEl.classList.remove('board-shake'), 500);
    }

    if (!document.getElementById('lightningFilterDefs')) {
        const defsEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        defsEl.id = 'lightningFilterDefs';
        defsEl.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        [3, 6].forEach(b => {
            const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
            filter.setAttribute('id', `boltBlur${b}`);
            filter.setAttribute('x', '-50%');
            filter.setAttribute('y', '-50%');
            filter.setAttribute('width', '200%');
            filter.setAttribute('height', '200%');
            const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
            blur.setAttribute('stdDeviation', b);
            filter.appendChild(blur);
            defs.appendChild(filter);
        });
        defsEl.appendChild(defs);
        document.body.appendChild(defsEl);
    }

    targetKeys.forEach((key, i) => {
        setTimeout(() => {
            const [tr, tc] = key.split(',').map(Number);
            const targetTile = getTileEl(tr, tc);
            if (!targetTile) return;
            const targetRect = targetTile.getBoundingClientRect();
            const tx = targetRect.left + targetRect.width / 2;
            const ty = targetRect.top + targetRect.height / 2;

            if (document.querySelectorAll('.lightning-flash').length < 2) {
                const flash = document.createElement('div');
                flash.className = 'lightning-flash';
                document.body.appendChild(flash);
                setTimeout(() => flash.remove(), 400);
            }

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'lightning-bolt-svg');

            const segments = 8 + Math.floor(Math.random() * 5);
            const points = [{ x: sx, y: sy }];
            const dx = tx - sx, dy = ty - sy;
            const len = Math.sqrt(dx * dx + dy * dy);
            const perpX = -dy / len, perpY = dx / len;
            for (let s = 1; s < segments; s++) {
                const t = s / segments;
                const offset = (Math.random() - 0.5) * len * 0.2;
                points.push({
                    x: sx + dx * t + perpX * offset,
                    y: sy + dy * t + perpY * offset
                });
            }
            points.push({ x: tx, y: ty });

            const layers = [
                { width: 12, color: 'rgba(142,45,226,0.4)', blur: 6 },
                { width: 6, color: 'rgba(255,204,0,0.8)', blur: 3 },
                { width: 2, color: 'rgba(255,255,255,0.95)', blur: 0 }
            ];

            layers.forEach(layer => {
                for (let p = 0; p < points.length - 1; p++) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', points[p].x);
                    line.setAttribute('y1', points[p].y);
                    line.setAttribute('x2', points[p + 1].x);
                    line.setAttribute('y2', points[p + 1].y);
                    line.setAttribute('stroke', layer.color);
                    line.setAttribute('stroke-width', layer.width);
                    if (layer.blur) line.setAttribute('filter', `url(#boltBlur${layer.blur})`);
                    svg.appendChild(line);
                }
            });

            const branchCount = 1 + Math.floor(Math.random() * 2);
            for (let b = 0; b < branchCount; b++) {
                const branchIdx = 2 + Math.floor(Math.random() * Math.max(1, points.length - 4));
                const bp = points[branchIdx];
                const bLen = 15 + Math.random() * 25;
                const bAngle = Math.random() * Math.PI * 2;
                const branch = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                branch.setAttribute('x1', bp.x);
                branch.setAttribute('y1', bp.y);
                branch.setAttribute('x2', bp.x + Math.cos(bAngle) * bLen);
                branch.setAttribute('y2', bp.y + Math.sin(bAngle) * bLen);
                branch.setAttribute('stroke', 'rgba(255,204,0,0.5)');
                branch.setAttribute('stroke-width', 3);
                svg.appendChild(branch);
            }

            document.body.appendChild(svg);
            setTimeout(() => svg.remove(), 550);

            targetTile.style.position = 'relative';
            targetTile.style.overflow = 'visible';
            const impact = document.createElement('div');
            impact.className = 'lightning-impact';
            targetTile.appendChild(impact);
            setTimeout(() => impact.remove(), 700);

            targetTile.classList.add('lightning-struck');
            setTimeout(() => targetTile.classList.remove('lightning-struck'), 500);

            spawnParticles(tx, ty, 6);
        }, i * 150);
    });
}

export function spawnGodRays() {
    const board = document.getElementById('board');
    if (!board) return;
    board.querySelectorAll('.god-rays').forEach(el => el.remove());
    board.style.position = 'relative';
    const rays = document.createElement('div');
    rays.className = 'god-rays';
    board.appendChild(rays);
    setTimeout(() => {
        rays.classList.add('fade-out');
        setTimeout(() => rays.remove(), 500);
    }, 1200);
}

export function spawnLightBurst(x, y) {
    const existing = document.querySelectorAll('.light-burst');
    if (existing.length >= 2) return;
    const burst = document.createElement('div');
    burst.className = 'light-burst';
    burst.style.left = (x - 15) + 'px';
    burst.style.top = (y - 15) + 'px';
    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 600);

    const ring = document.createElement('div');
    ring.className = 'light-burst-ring';
    ring.style.left = (x - 5) + 'px';
    ring.style.top = (y - 5) + 'px';
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 500);
}

export function showCinematicVignette(duration) {
    document.querySelectorAll('.cinematic-vignette').forEach(el => el.remove());
    const v = document.createElement('div');
    v.className = 'cinematic-vignette';
    document.body.appendChild(v);
    setTimeout(() => {
        v.classList.add('fade-out');
        setTimeout(() => v.remove(), 500);
    }, duration || 1000);
}

export function showScreenTint(color, duration) {
    document.querySelectorAll('.screen-tint').forEach(el => el.remove());
    const tint = document.createElement('div');
    tint.className = 'screen-tint ' + (color || 'golden');
    document.body.appendChild(tint);
    setTimeout(() => tint.remove(), duration || 800);
}

export function boardCinematicZoom(duration) {
    const boardEl = document.getElementById('board');
    if (!boardEl) return;
    boardEl.classList.add('board-cinematic-zoom');
    setTimeout(() => {
        boardEl.classList.remove('board-cinematic-zoom');
    }, duration || 600);
}

export function showCompliment() {
    const el = document.createElement('div');
    el.className = 'compliment';
    const compliments = ['Sweet! 🍬', 'Awesome! 🎉', 'Sugar Rush! 🍭', 'Amazing! 🌟', 'Delicious! 🍫', 'Tasty! 🧁', 'On Fire! 🔥', 'Yummy! 🍪'];
    el.textContent = compliments[Math.floor(Math.random() * compliments.length)];
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

export function spawnParticles(x, y, count) {
    const activeCount = document.querySelectorAll('.match-particle').length;
    if (activeCount >= MAX_PARTICLES) return;
    const actualCount = Math.min(count * 2, MAX_PARTICLES - activeCount);

    const emojis = ['💖', '💕', '✨', '⭐', '💗', '🌟', '💫', '🔥', '💝', '🎆'];
    const container = document.getElementById('gameArea') || document.body;

    for (let i = 0; i < actualCount; i++) {
        const p = document.createElement('div');
        p.className = 'match-particle';

        p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.fontSize = (1.2 + Math.random() * 1.2) + 'rem';

        const angle = (Math.random() * 360) * (Math.PI / 180);
        const distance = 60 + Math.random() * 120;
        p.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
        p.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
        p.style.setProperty('--rot', ((Math.random() - 0.5) * 720) + 'deg');

        container.appendChild(p);
        setTimeout(() => p.remove(), 900);
    }
}

export function showScorePopup(points, x, y) {
    const el = document.createElement('div');
    el.className = 'score-popup';

    el.textContent = '+' + points;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.transform = 'translate(-50%, -50%)';

    if (points >= 200) {
        el.style.fontSize = '2.2rem';
        el.style.textShadow = '0 2px 12px rgba(0, 0, 0, 0.4), 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 105, 180, 0.4)';
    } else if (points >= 100) {
        el.style.fontSize = '1.8rem';
        el.style.textShadow = '0 2px 10px rgba(0, 0, 0, 0.3), 0 0 25px rgba(255, 215, 0, 0.7)';
    } else {
        el.style.fontSize = '';
        el.style.textShadow = '';
    }

    const container = document.getElementById('gameArea') || document.body;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1200);
}

export function createConfetti() {
    const colors = ['#ff69b4', '#ff1493', '#ffd700', '#ff6b6b', '#4ecdc4', '#a855f7', '#00e5ff', '#ff8c00'];
    const container = document.body;
    for (let i = 0; i < 120; i++) {
        setTimeout(() => {
            const c = document.createElement('div');
            c.className = 'confetti';

            c.style.left = Math.random() * 100 + '%';
            c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            const shape = Math.random();
            if (shape > 0.6) {
                c.style.borderRadius = '50%';
            } else if (shape > 0.3) {
                c.style.borderRadius = '0';
            } else {
                c.style.borderRadius = '2px';
                c.style.width = (4 + Math.random() * 6) + 'px';
                c.style.height = (12 + Math.random() * 10) + 'px';
            }
            c.style.width = c.style.width || (7 + Math.random() * 10) + 'px';
            c.style.height = c.style.height || (7 + Math.random() * 10) + 'px';
            c.style.animationDuration = (2 + Math.random() * 2) + 's';

            container.appendChild(c);
            setTimeout(() => c.remove(), 4000);
        }, i * 20);
    }
}

let fireworksInterval = null;
let fireworksStarInterval = null;

export function startFireworks() {
    stopFireworks();
    const container = document.getElementById('congratsScreen');
    if (!container) return;

    const colors = ['#ff1493', '#ffd700', '#ff6b6b', '#4ecdc4', '#a855f7', '#00e5ff', '#ff8c00', '#ff69b4', '#7fff00', '#ff4500'];

    function launchBurst() {
        const cx = 5 + Math.random() * 90;
        const cy = 5 + Math.random() * 70;
        const burstColor = colors[Math.floor(Math.random() * colors.length)];
        const count = 15 + Math.floor(Math.random() * 8);

        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'firework-particle';
            const size = 5 + Math.random() * 5;
            p.style.width = size + 'px';
            p.style.height = size + 'px';
            p.style.backgroundColor = burstColor;
            p.style.left = cx + '%';
            p.style.top = cy + '%';
            p.style.boxShadow = `0 0 ${size + 4}px ${burstColor}, 0 0 ${size + 8}px ${burstColor}40`;
            container.appendChild(p);

            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
            const speed = 60 + Math.random() * 60;
            const dx = Math.cos(angle) * speed;
            const dy = Math.sin(angle) * speed;

            p.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${dx}px, ${dy + 40}px) scale(0.1)`, opacity: 0 }
            ], {
                duration: 900 + Math.random() * 700,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                fill: 'forwards'
            }).onfinish = () => p.remove();
        }
    }

    launchBurst();
    launchBurst();
    launchBurst();

    fireworksInterval = setInterval(launchBurst, 250);

    function spawnStar() {
        const starEmojis = ['⭐', '✨', '🌟', '💫', '💖', '🎉'];
        const s = document.createElement('div');
        s.className = 'congrats-star';
        s.textContent = starEmojis[Math.floor(Math.random() * starEmojis.length)];
        s.style.left = Math.random() * 100 + '%';
        s.style.top = '-20px';
        s.style.fontSize = (14 + Math.random() * 16) + 'px';
        s.style.animationDuration = (3 + Math.random() * 3) + 's';
        container.appendChild(s);
        setTimeout(() => s.remove(), 6000);
    }

    for (let i = 0; i < 8; i++) {
        setTimeout(spawnStar, i * 100);
    }

    fireworksStarInterval = setInterval(spawnStar, 300);
}

export function stopFireworks() {
    if (fireworksInterval) {
        clearInterval(fireworksInterval);
        fireworksInterval = null;
    }
    if (fireworksStarInterval) {
        clearInterval(fireworksStarInterval);
        fireworksStarInterval = null;
    }
    const container = document.getElementById('congratsScreen');
    if (container) {
        container.querySelectorAll('.firework-particle, .congrats-star').forEach(p => p.remove());
    }
}

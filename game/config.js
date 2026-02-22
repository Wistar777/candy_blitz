export const STAR_THRESHOLDS = [1500, 3000, 4500]; // 1★, 2★, 3★

// Candy emoji used as tile types
export const CANDY_TILES = ['🍬', '🍭', '🍫', '🍩', '🧁', '🍪'];

export const LEVELS = [
    {
        id: 'chocolate', name: 'Chocolate Factory', icon: '🍫', img: 'photos/levels/chocolate.png', types: 6, goal: 1500, time: 120,
        zone: { bg: '#5D3A1A', accent: '#8B4513', glow: 'rgba(139,69,19,0.5)' },
        theme: { bg: 'linear-gradient(135deg, #4a2c17, #7b4a2e, #a0522d)', card: 'rgba(120,70,30,0.3)', border: 'rgba(160,82,45,0.5)', accent: '#8B4513' }
    },
    {
        id: 'lollipop', name: 'Lollipop Lane', icon: '🍭', img: 'photos/levels/lollipop.png', types: 6, goal: 1500, time: 120,
        zone: { bg: '#FF69B4', accent: '#FF1493', glow: 'rgba(255,20,147,0.5)' },
        theme: { bg: 'linear-gradient(135deg, #ff69b4, #ff1493, #c71585)', card: 'rgba(255,105,180,0.3)', border: 'rgba(199,21,133,0.5)', accent: '#FF1493' }
    },
    {
        id: 'gummy', name: 'Gummy Gardens', icon: '🍬', img: 'photos/levels/gummy.png', types: 6, goal: 1500, time: 120,
        zone: { bg: '#32CD32', accent: '#228B22', glow: 'rgba(34,139,34,0.5)' },
        theme: { bg: 'linear-gradient(135deg, #32CD32, #228B22, #006400)', card: 'rgba(50,205,50,0.3)', border: 'rgba(34,139,34,0.5)', accent: '#228B22' }
    },
    {
        id: 'cupcake', name: 'Cupcake Castle', icon: '🧁', img: 'photos/levels/cupcake.png', types: 6, goal: 1500, time: 120,
        zone: { bg: '#BA55D3', accent: '#9932CC', glow: 'rgba(153,50,204,0.5)' },
        theme: { bg: 'linear-gradient(135deg, #DDA0DD, #BA55D3, #9932CC)', card: 'rgba(221,160,221,0.3)', border: 'rgba(186,85,211,0.5)', accent: '#9932CC' }
    },
    {
        id: 'cookie', name: 'Cookie Kingdom', icon: '🍪', img: 'photos/levels/cookie.png', types: 6, goal: 1500, time: 120,
        zone: { bg: '#F0B430', accent: '#D4AC0D', glow: 'rgba(212,172,13,0.5)' },
        theme: { bg: 'linear-gradient(135deg, #F5D76E, #F0B430, #D4AC0D)', card: 'rgba(255,245,200,0.3)', border: 'rgba(240,180,48,0.5)', accent: '#D4AC0D' }
    },
    {
        id: 'donut', name: 'Donut Dimension', icon: '🍩', img: 'photos/levels/donut.png', types: 6, goal: 1500, time: 120,
        zone: { bg: '#FF4500', accent: '#DC143C', glow: 'rgba(255,69,0,0.5)' },
        theme: { bg: 'linear-gradient(135deg, #FF6347, #FF4500, #DC143C)', card: 'rgba(255,99,71,0.3)', border: 'rgba(255,69,0,0.5)', accent: '#FF4500' }
    }
];

export const GRID = 8;
export const MAX_PARTICLES = 30;
export const HINT_DELAY = 7000;

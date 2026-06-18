// =====================================================
// NATIONFALL - WAR STRATEGY GAME
// =====================================================

// CANVAS SETUP
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth - 300;
canvas.height = window.innerHeight;

const TILE_SIZE = 25;
const ROWS = Math.floor(canvas.height / TILE_SIZE);
const COLS = Math.floor(canvas.width / TILE_SIZE);

// =====================================================
// GAME STATE
// =====================================================

let gameState = {
    tiles: [],
    cities: [],
    countries: [],
    armies: [],
    alliances: [],
    wars: [],
    borders: [],
    currentMode: 'map',
    currentTool: 'terrain',
    currentTerrainType: 'grass',
    brushSize: 15,
    mapMode: 'terrain',
    gameMode: 'creative',
    gameSpeed: 1,
    selectedCountry: null,
    draggingArmy: null,
    frontlines: []
};

// =====================================================
// CLASSES
// =====================================================

class Tile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.terrain = 'grass';
        this.owner = null;
        this.population = 0;
        this.gdp = 0;
        this.border = false;
    }

    getColor() {
        if (gameState.mapMode === 'political') {
            return this.owner ? this.owner.color : '#2d5016';
        } else if (gameState.mapMode === 'population') {
            const maxPop = 100000;
            const ratio = Math.min(this.population / maxPop, 1);
            return `rgb(${255 * ratio}, ${255 * (1 - ratio)}, 0)`;
        } else if (gameState.mapMode === 'gdp') {
            const maxGdp = 500000;
            const ratio = Math.min(this.gdp / maxGdp, 1);
            return `rgb(0, ${200 * ratio}, ${255 * (1 - ratio)})`;
        } else {
            // Terrain mode
            const terrainColors = {
                'grass': '#2d5016',
                'water': '#1e90ff',
                'mountain': '#696969',
                'forest': '#1b4d2e'
            };
            return terrainColors[this.terrain] || '#2d5016';
        }
    }
}

class City {
    constructor(x, y, type = 'small', country = null, population = 10000) {
        this.x = x;
        this.y = y;
        this.type = type; // 'small', 'medium', 'large', 'capital'
        this.country = country;
        this.population = population;
        this.isCapital = type === 'capital';
    }

    draw(ctx) {
        const screenX = this.x * TILE_SIZE + TILE_SIZE / 2;
        const screenY = this.y * TILE_SIZE + TILE_SIZE / 2;

        ctx.fillStyle = '#ffff00';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;

        if (this.isCapital) {
            // Draw star
            drawStar(ctx, screenX, screenY, 8);
        } else if (this.type === 'large') {
            // Large circle
            ctx.beginPath();
            ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else if (this.type === 'medium') {
            // Medium circle
            ctx.beginPath();
            ctx.arc(screenX, screenY, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else {
            // Small circle
            ctx.beginPath();
            ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }
}

function drawStar(ctx, cx, cy, size) {
    const spikes = 5;
    let rot = Math.PI / 2 * 3;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    for (let i = 0; i < spikes; i++) {
        ctx.lineTo(cx + Math.cos(rot) * size, cy + Math.sin(rot) * size);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * size * 0.5, cy + Math.sin(rot) * size * 0.5);
        rot += step;
    }
    ctx.lineTo(cx, cy - size);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

class Country {
    constructor(name, color, ideology = 'Democratic', population = 50000) {
        this.name = name;
        this.color = color;
        this.ideology = ideology;
        this.population = population;
        this.gdp = population * 10;
        this.capital = null;
        this.cities = [];
        this.territories = [];
        this.allies = [];
        this.enemies = [];
        this.puppet = [];
        this.puppetOf = null;
        this.flag = this.generateFlag();
        this.government = 'Democracy';
    }

    generateFlag() {
        const colors = [
            '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'
        ];
        return {
            colors: [colors[Math.floor(Math.random() * colors.length)],
                    colors[Math.floor(Math.random() * colors.length)]],
            pattern: 'stripe'
        };
    }

    addTerritory(tile) {
        if (!this.territories.includes(tile)) {
            this.territories.push(tile);
            tile.owner = this;
        }
    }

    addAlly(country) {
        if (!this.allies.includes(country)) {
            this.allies.push(country);
        }
    }

    addEnemy(country) {
        if (!this.enemies.includes(country)) {
            this.enemies.push(country);
        }
    }

    createRebellion() {
        const rebellionName = `${this.name} - Rebels`;
        const newCountry = new Country(
            rebellionName,
            this.getRandomColor(),
            'Rebel Movement'
        );
        newCountry.puppetOf = this;
        gameState.countries.push(newCountry);
        return newCountry;
    }

    addPuppet(country) {
        this.puppet.push(country);
        country.puppetOf = this;
    }

    releasePuppet(country) {
        const idx = this.puppet.indexOf(country);
        if (idx > -1) {
            this.puppet.splice(idx, 1);
            country.puppetOf = null;
        }
    }

    getRandomColor() {
        const hue = Math.random() * 360;
        const saturation = 70 + Math.random() * 20;
        const lightness = 40 + Math.random() * 20;
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
}

class Army {
    constructor(x, y, type, country, numbers) {
        this.x = x;
        this.y = y;
        this.type = type; // 'infantry', 'tank', 'navy', 'air'
        this.country = country;
        this.numbers = numbers; // strength/troop count
        this.maxNumbers = numbers;
        this.casualties = 0;
        this.morale = 100;
        this.position = { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
        this.targetX = this.x;
        this.targetY = this.y;
        this.engaged = false;
    }

    getColor() {
        const baseColors = {
            'red': '#ff0000',
            'blue': '#0000ff',
            'green': '#00ff00',
            'yellow': '#ffff00',
            'purple': '#ff00ff'
        };

        const countryColor = this.country.color;
        const typeOpacity = {
            'tank': 0.8,
            'infantry': 0.6,
            'navy': 0.4,
            'air': 0.2
        };

        return countryColor;
    }

    draw(ctx) {
        const color = this.getColor();
        const typeRadius = {
            'tank': 12,
            'infantry': 10,
            'navy': 8,
            'air': 6
        };

        const radius = typeRadius[this.type] || 8;

        ctx.fillStyle = color;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;

        // Draw circle for army
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw number label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.floor(this.numbers / 1000) + 'k', this.position.x, this.position.y);
    }

    moveTo(x, y) {
        this.targetX = x;
        this.targetY = y;
    }

    update() {
        // Smooth movement towards target
        const dx = this.targetX * TILE_SIZE + TILE_SIZE / 2 - this.position.x;
        const dy = this.targetY * TILE_SIZE + TILE_SIZE / 2 - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 2) {
            const speed = 2;
            this.position.x += (dx / distance) * speed;
            this.position.y += (dy / distance) * speed;
        } else {
            this.x = this.targetX;
            this.y = this.targetY;
        }

        // Update tile owner if in creative mode
        if (gameState.gameMode === 'creative') {
            const tile = gameState.tiles[this.y][this.x];
            if (tile && !tile.owner) {
                tile.owner = this.country;
            }
        }
    }

    takeDamage(damage) {
        this.casualties += damage;
        this.numbers -= damage;
        if (this.numbers < 0) this.numbers = 0;
    }
}

class Alliance {
    constructor(name, leader, members = []) {
        this.name = name;
        this.leader = leader;
        this.members = members;
        this.founded = new Date();
    }

    addMember(country) {
        if (!this.members.includes(country)) {
            this.members.push(country);
        }
    }

    removeMember(country) {
        const idx = this.members.indexOf(country);
        if (idx > -1) {
            this.members.splice(idx, 1);
        }
    }
}

class War {
    constructor(aggressor, defender, reason = 'Territorial Dispute') {
        this.aggressor = aggressor;
        this.defender = defender;
        this.reason = reason;
        this.startDate = new Date();
        this.active = true;
        this.aggressorAllies = [];
        this.defenderAllies = [];
        this.casualties = { aggressor: 0, defender: 0 };
    }

    end() {
        this.active = false;
    }
}

// =====================================================
// INITIALIZATION
// =====================================================

function initializeGame() {
    // Create tiles
    for (let y = 0; y < ROWS; y++) {
        gameState.tiles[y] = [];
        for (let x = 0; x < COLS; x++) {
            gameState.tiles[y][x] = new Tile(x, y);
        }
    }

    // Create sample countries
    const country1 = new Country('Democratic Republic', 'hsl(0, 70%, 50%)', 'Democracy');
    const country2 = new Country('Empire State', 'hsl(240, 70%, 50%)', 'Monarchy');

    gameState.countries.push(country1, country2);

    // Add sample capital cities
    addCityAtTile(10, 10, 'capital', country1, 50000);
    addCityAtTile(40, 30, 'capital', country2, 50000);

    // Add some other cities
    addCityAtTile(15, 15, 'large', country1, 30000);
    addCityAtTile(35, 20, 'medium', country2, 20000);

    gameState.selectedCountry = country1;
    updateCountryInfo();
}

function addCityAtTile(x, y, type, country, pop) {
    if (gameState.tiles[y] && gameState.tiles[y][x]) {
        const city = new City(x, y, type, country, pop);
        gameState.cities.push(city);
        gameState.tiles[y][x].population += pop;
        if (country) {
            country.cities.push(city);
            if (type === 'capital') {
                country.capital = city;
            }
        }
    }
}

// =====================================================
// EVENT LISTENERS - UI BUTTONS
// =====================================================

// Mode selector
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        gameState.currentMode = e.target.dataset.mode;

        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        if (gameState.currentMode === 'map') {
            document.getElementById('mapEditorPanel').classList.add('active');
        } else {
            document.getElementById('gameplayPanel').classList.add('active');
        }
    });
});

// Map mode selector
document.getElementById('mapMode').addEventListener('change', (e) => {
    gameState.mapMode = e.target.value;
});

// Terrain tools
document.querySelectorAll('[data-tool="terrain"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        gameState.currentTool = 'terrain';
        gameState.currentTerrainType = e.target.dataset.value;
    });
});

// City tools
document.querySelectorAll('[data-tool="city"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        gameState.currentTool = 'city';
        gameState.currentCityType = e.target.dataset.value;
    });
});

// Border tool
document.querySelector('[data-tool="border"]').addEventListener('click', () => {
    gameState.currentTool = 'border';
});

// Brush size
document.getElementById('brushSize').addEventListener('input', (e) => {
    gameState.brushSize = parseInt(e.target.value);
});

// Create country
document.getElementById('createCountryBtn').addEventListener('click', () => {
    const name = document.getElementById('countryName').value || 'New Country';
    const color = `hsl(${Math.random() * 360}, 70%, 50%)`;
    const country = new Country(name, color);
    gameState.countries.push(country);
    gameState.selectedCountry = country;
    updateCountryInfo();
    document.getElementById('countryName').value = '';
});

// Generate flag
document.getElementById('generateFlagBtn').addEventListener('click', () => {
    if (gameState.selectedCountry) {
        gameState.selectedCountry.flag = gameState.selectedCountry.generateFlag();
    }
});

// Flag upload
document.getElementById('flagUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && gameState.selectedCountry) {
        const reader = new FileReader();
        reader.onload = (event) => {
            gameState.selectedCountry.flag.custom = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Game mode
document.getElementById('gameMode').addEventListener('change', (e) => {
    gameState.gameMode = e.target.value;
});

// Game speed
document.getElementById('gameSpeed').addEventListener('change', (e) => {
    gameState.gameSpeed = parseInt(e.target.value);
});

// Country actions
document.getElementById('rebellionBtn').addEventListener('click', () => {
    if (gameState.selectedCountry) {
        const newCountry = gameState.selectedCountry.createRebellion();
        showModal('Rebellion Created', `${newCountry.name} has rebelled from ${gameState.selectedCountry.name}!`);
    }
});

document.getElementById('addPuppetBtn').addEventListener('click', () => {
    showCountrySelectionModal('Select puppet state to add', (country) => {
        if (gameState.selectedCountry) {
            gameState.selectedCountry.addPuppet(country);
            showModal('Puppet Added', `${country.name} is now a puppet of ${gameState.selectedCountry.name}`);
        }
    });
});

document.getElementById('releasePuppetBtn').addEventListener('click', () => {
    if (gameState.selectedCountry && gameState.selectedCountry.puppet.length > 0) {
        showCountrySelectionModal('Select puppet to release', (country) => {
            if (gameState.selectedCountry.puppet.includes(country)) {
                gameState.selectedCountry.releasePuppet(country);
                showModal('Puppet Released', `${country.name} is now independent`);
            }
        });
    }
});

document.getElementById('addAllyBtn').addEventListener('click', () => {
    showCountrySelectionModal('Select ally', (country) => {
        if (gameState.selectedCountry) {
            gameState.selectedCountry.addAlly(country);
            country.addAlly(gameState.selectedCountry);
            showModal('Alliance Formed', `${gameState.selectedCountry.name} and ${country.name} are now allies`);
        }
    });
});

document.getElementById('makeAllianceBtn').addEventListener('click', () => {
    if (gameState.selectedCountry) {
        showModal('Create Alliance', 'Enter alliance name:', (allianceName) => {
            const alliance = new Alliance(allianceName, gameState.selectedCountry, [gameState.selectedCountry]);
            gameState.alliances.push(alliance);
            showModal('Alliance Created', `${allianceName} has been founded`);
        }, true);
    }
});

document.getElementById('declareWarBtn').addEventListener('click', () => {
    showCountrySelectionModal('Declare war on:', (defender) => {
        if (gameState.selectedCountry) {
            const war = new War(gameState.selectedCountry, defender);
            gameState.wars.push(war);
            gameState.selectedCountry.addEnemy(defender);
            defender.addEnemy(gameState.selectedCountry);
            showModal('War Declared', `${gameState.selectedCountry.name} declared war on ${defender.name}!`);
        }
    });
});

document.getElementById('callAlliesBtn').addEventListener('click', () => {
    if (gameState.selectedCountry) {
        const allies = gameState.selectedCountry.allies;
        if (allies.length === 0) {
            showModal('No Allies', 'You have no allies to call');
        } else {
            let text = `Called to war: ${allies.map(a => a.name).join(', ')}`;
            showModal('Allies Called', text);
        }
    }
});

document.getElementById('makePeaceBtn').addEventListener('click', () => {
    const currentWars = gameState.wars.filter(w => w.active && (w.aggressor === gameState.selectedCountry || w.defender === gameState.selectedCountry));
    if (currentWars.length === 0) {
        showModal('Peace', 'No active wars');
    } else {
        currentWars.forEach(w => {
            w.end();
            const enemy = w.aggressor === gameState.selectedCountry ? w.defender : w.aggressor;
            const idx = gameState.selectedCountry.enemies.indexOf(enemy);
            if (idx > -1) gameState.selectedCountry.enemies.splice(idx, 1);
        });
        showModal('Peace Treaty', 'Wars ended');
    }
});

document.getElementById('spawnArmyBtn').addEventListener('click', () => {
    if (gameState.selectedCountry && gameState.selectedCountry.capital) {
        const type = document.getElementById('armyType').value;
        const numbers = parseInt(document.getElementById('armyNumbers').value);
        const army = new Army(
            gameState.selectedCountry.capital.x,
            gameState.selectedCountry.capital.y,
            type,
            gameState.selectedCountry,
            numbers
        );
        gameState.armies.push(army);
        showModal('Army Spawned', `${numbers.toLocaleString()} troops deployed`);
    }
});

// Save/Load
document.getElementById('saveMapBtn').addEventListener('click', () => {
    const data = JSON.stringify({
        tiles: gameState.tiles,
        countries: gameState.countries,
        cities: gameState.cities
    });
    localStorage.setItem('nationfallMap', data);
    showModal('Saved', 'Map saved to browser');
});

document.getElementById('loadMapBtn').addEventListener('click', () => {
    const data = localStorage.getItem('nationfallMap');
    if (data) {
        showModal('Loaded', 'Map loaded from browser');
    } else {
        showModal('No Save', 'No map found');
    }
});

document.getElementById('clearMapBtn').addEventListener('click', () => {
    if (confirm('Clear entire map?')) {
        gameState.tiles = [];
        gameState.cities = [];
        gameState.countries = [];
        gameState.armies = [];
        initializeGame();
    }
});

// =====================================================
// MODAL FUNCTIONS
// =====================================================

function showModal(title, content, callback = null, isInput = false) {
    const overlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = title;

    if (isInput) {
        document.getElementById('modalContent').innerHTML = `
            <input type="text" id="modalInput" placeholder="${content}">
            <button id="modalConfirm">Confirm</button>
            <button id="modalCancel">Cancel</button>
        `;
        document.getElementById('modalConfirm').addEventListener('click', () => {
            const value = document.getElementById('modalInput').value;
            if (callback) callback(value);
            closeModal();
        });
    } else {
        document.getElementById('modalContent').innerHTML = `<p>${content}</p>`;
    }

    overlay.classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

function showCountrySelectionModal(title, callback) {
    const countries = gameState.countries.filter(c => c !== gameState.selectedCountry);
    if (countries.length === 0) {
        showModal('No Countries', 'No other countries available');
        return;
    }

    let html = '<div style="max-height: 300px; overflow-y: auto;">';
    countries.forEach(c => {
        html += `<button class="action-btn" style="margin: 5px 0;">${c.name}</button>`;
    });
    html += '</div>';

    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalOverlay').classList.add('active');

    const buttons = document.querySelectorAll('.action-btn');
    buttons.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            callback(countries[idx]);
            closeModal();
        });
    });
}

document.querySelector('.modal-close').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) {
        closeModal();
    }
});

// =====================================================
// CANVAS EVENTS
// =====================================================

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    document.getElementById('mouseInfo').textContent = `Coordinates: ${x}, ${y}`;

    if (gameState.tiles[y] && gameState.tiles[y][x]) {
        const tile = gameState.tiles[y][x];
        const owner = tile.owner ? tile.owner.name : 'Unclaimed';
        document.getElementById('tileInfo').textContent = `Tile: ${tile.terrain} | Owner: ${owner} | Pop: ${tile.population}`;
    }
});

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    if (!gameState.tiles[y] || !gameState.tiles[y][x]) return;

    if (gameState.currentMode === 'map') {
        if (gameState.currentTool === 'terrain') {
            paintTerrain(x, y, gameState.brushSize);
        } else if (gameState.currentTool === 'city') {
            addCityAtTile(x, y, gameState.currentCityType, gameState.selectedCountry, parseInt(document.getElementById('populationInput').value));
        } else if (gameState.currentTool === 'border') {
            if (gameState.selectedCountry) {
                gameState.tiles[y][x].owner = gameState.selectedCountry;
                gameState.selectedCountry.addTerritory(gameState.tiles[y][x]);
            }
        }
    } else {
        // Gameplay mode - click country to select
        if (gameState.tiles[y][x].owner) {
            gameState.selectedCountry = gameState.tiles[y][x].owner;
            updateCountryInfo();
        }

        // Check if clicking on army to drag it
        for (let army of gameState.armies) {
            const dx = army.position.x - (e.clientX - rect.left);
            const dy = army.position.y - (e.clientY - rect.top);
            if (Math.sqrt(dx * dx + dy * dy) < 15) {
                gameState.draggingArmy = army;
                break;
            }
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (gameState.draggingArmy) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
        const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);
        if (gameState.tiles[y] && gameState.tiles[y][x]) {
            gameState.draggingArmy.moveTo(x, y);
        }
    }
});

canvas.addEventListener('mouseup', () => {
    gameState.draggingArmy = null;
});

// =====================================================
// DRAWING & UPDATES
// =====================================================

function paintTerrain(x, y, size) {
    for (let dy = -size; dy <= size; dy++) {
        for (let dx = -size; dx <= size; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (gameState.tiles[ny] && gameState.tiles[ny][nx]) {
                gameState.tiles[ny][nx].terrain = gameState.currentTerrainType;
            }
        }
    }
}

function updateCountryInfo() {
    const info = document.getElementById('selectedCountryInfo');
    if (gameState.selectedCountry) {
        info.innerHTML = `
            <h4 style="color: ${gameState.selectedCountry.color};">${gameState.selectedCountry.name}</h4>
            <p>Ideology: ${gameState.selectedCountry.ideology}</p>
            <p>Population: ${gameState.selectedCountry.population.toLocaleString()}</p>
            <p>GDP: $${gameState.selectedCountry.gdp.toLocaleString()}</p>
            <p>Cities: ${gameState.selectedCountry.cities.length}</p>
            <p>Allies: ${gameState.selectedCountry.allies.length}</p>
            <p>Enemies: ${gameState.selectedCountry.enemies.length}</p>
        `;
        document.getElementById('countryActionsSection').style.display = 'block';
    }
}

function drawFrontlines() {
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);

    for (let army1 of gameState.armies) {
        for (let army2 of gameState.armies) {
            if (army1.country !== army2.country && gameState.wars.some(w => 
                (w.aggressor === army1.country && w.defender === army2.country) ||
                (w.aggressor === army2.country && w.defender === army1.country)
            )) {
                ctx.beginPath();
                ctx.moveTo(army1.position.x, army1.position.y);
                ctx.lineTo(army2.position.x, army2.position.y);
                ctx.stroke();
            }
        }
    }
    ctx.setLineDash([]);
}

function draw() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw tiles
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const tile = gameState.tiles[y][x];
            ctx.fillStyle = tile.getColor();
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            // Border lines
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    // Draw cities
    for (let city of gameState.cities) {
        city.draw(ctx);
    }

    // Draw armies
    for (let army of gameState.armies) {
        army.update();
        army.draw(ctx);
    }

    // Draw frontlines
    drawFrontlines();

    requestAnimationFrame(draw);
}

// =====================================================
// GAME LOOP
// =====================================================

let gameLoopCounter = 0;

function gameLoop() {
    gameLoopCounter++;

    // Simulation mode - armies engage
    if (gameState.gameMode === 'simulation' && gameLoopCounter % (10 / gameState.gameSpeed) === 0) {
        for (let army1 of gameState.armies) {
            for (let army2 of gameState.armies) {
                if (army1.country !== army2.country) {
                    const dx = army1.position.x - army2.position.x;
                    const dy = army1.position.y - army2.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 50) {
                        // Armies engage
                        const damage1 = Math.random() * 100;
                        const damage2 = Math.random() * 100;
                        army1.takeDamage(damage1);
                        army2.takeDamage(damage2);
                    }
                }
            }
        }
    }

    // Remove destroyed armies
    gameState.armies = gameState.armies.filter(a => a.numbers > 0);

    setTimeout(gameLoop, 1000 / (60 * gameState.gameSpeed));
}

// =====================================================
// START GAME
// =====================================================

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth - 300;
    canvas.height = window.innerHeight;
});

initializeGame();
draw();
gameLoop();

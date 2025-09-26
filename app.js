// Variable para guardar todos los conceptos cargados del JSON
let allConcepts = [];
// Variable para la ronda actual
let currentRound = {};
// Variables de estado del juego
let score = 0;
let timerId = null;
let timeLeft = 0; // En segundos
let gameMode = 'normal'; // Modo por defecto
let gameActive = false;
let roundStartTime = null;

// Variables del sistema multijugador
let gameType = 'singleplayer'; // 'singleplayer' o 'online'
let totalRounds = 3; // 3 o 5 rondas para online
let currentRoundNumber = 1;
let playerScore = 0;
let rivalScore = 0;
let roomCode = '';
let isRoomHost = false;
let playerFinished = false;
let rivalFinished = false;
let playerGaveUp = false;
let rivalGaveUp = false;
let bothPlayersReady = false;
let waitingForPlayer = false;
let sharedConcepts = null; // Conceptos compartidos entre jugadores
let useFirebase = false; // Se establece en true si Firebase está disponible
let playerReadyForNextRound = false; // Para sistema de confirmación
let rivalReadyForNextRound = false;
let localStorageCheckInterval = null; // Para verificar cambios en localStorage

// Callbacks para Firebase - se ejecutan cuando hay cambios en tiempo real
function onPlayerJoined(roomData) {
    console.log('Callback: Jugador se unió a la sala', roomData);
    if (isRoomHost && roomData.players === 2) {
        // Actualizar interfaz del host cuando el guest se une
        playerCountEl.textContent = 'Jugadores: 2/2';
        document.getElementById('waiting-title').textContent = '¡Jugador 2 conectado!';
        document.getElementById('player2').innerHTML = '<div class="player-avatar connected"></div><span>Jugador 2</span>';
        
        // Mostrar botón para iniciar partida
        setTimeout(() => {
            countdownEl.classList.remove('hidden');
            startCountdown();
        }, 1000);
    }
}

function onRoomSettingsUpdated(roomData) {
    console.log('Callback: Configuración de sala actualizada', roomData);
    if (!isRoomHost && roomData.hostSettings) {
        // El guest recibe la configuración del host
        gameMode = roomData.hostSettings.gameMode;
        totalRounds = roomData.hostSettings.totalRounds;
        console.log('Configuración recibida del host:', { gameMode, totalRounds });
    }
}

function onSharedConceptsUpdated(roomData) {
    console.log('Callback: Conceptos compartidos actualizados', roomData.sharedConcepts?.slice(0, 3) || 'No disponibles');
    if (roomData.sharedConcepts) {
        sharedConcepts = roomData.sharedConcepts;
        console.log('Conceptos sincronizados para esta partida');
    }
}

function onGameStarted(roomData) {
    console.log('Callback: Juego iniciado por host', roomData);
    if (!isRoomHost && roomData.gameStarted) {
        // El guest inicia su juego cuando el host lo hace
        startMultiplayerGame();
    }
}

// Callbacks para Firebase - se ejecutan cuando hay cambios en tiempo real
window.onRoomRoundChanged = function(newRoundNumber) {
    console.log('🔄 Ronda global cambió a:', newRoundNumber);
    
    if (newRoundNumber && newRoundNumber !== currentRoundNumber) {
        console.log(`📊 Sincronizando con ronda global: ${currentRoundNumber} → ${newRoundNumber}`);
        currentRoundNumber = newRoundNumber;
        
        // Actualizar mi ronda personal en Firebase
        if (useFirebase && firebaseMultiplayer) {
            firebaseMultiplayer.updatePlayerCurrentRound(currentRoundNumber);
        }
        
        // Resetear estados para la nueva ronda
        playerFinished = false;
        rivalFinished = false;
        playerGaveUp = false;
        rivalGaveUp = false;
        playerReadyForNextRound = false;
        rivalReadyForNextRound = false;
        
        // Configurar nueva ronda
        updateMultiplayerDisplay();
        setupMultiplayerRound();
        showScreen(gameContainerEl);
        
        setTimeout(() => {
            startGameRound();
        }, 1000);
    }
};

window.onRoomPlayersChanged = function(players, playerCount) {
    console.log('Cambio en jugadores:', players, playerCount);
    
    if (playerCount === 2 && waitingForPlayer) {
        waitingForPlayer = false;
        playerCountEl.textContent = 'Jugadores: 2/2';
        document.getElementById('waiting-title').textContent = '¡Ambos jugadores conectados!';
        document.getElementById('player2').innerHTML = '<div class="player-avatar connected"></div><span>Jugador 2</span>';
        
        // Si somos el host, generar conceptos compartidos
        if (isRoomHost) {
            generateSharedConcepts();
            window.firebaseMultiplayer.setSharedConcepts(sharedConcepts);
        }
        
        // Mostrar countdown
        countdownEl.classList.remove('hidden');
        startCountdown();
    }
};

window.onGameStateChanged = function(gameState) {
    console.log('Estado del juego cambió:', gameState);
    
    if (gameState.sharedConcepts && !sharedConcepts) {
        sharedConcepts = gameState.sharedConcepts;
        console.log('Conceptos compartidos recibidos:', sharedConcepts);
    }
};

// Nuevo callback específico para cambios en readyForNext
window.onReadyStatusChanged = function(myReady, rivalReady) {
    console.log('[Callback] Estados readyForNext actualizados:', {
        yo: myReady,
        rival: rivalReady,
        localPlayer: playerReadyForNextRound,
        localRival: rivalReadyForNextRound,
        timestamp: new Date().toISOString()
    });
    
    // Sincronizar mi estado local con Firebase si hay discrepancia
    if (playerReadyForNextRound !== myReady) {
        console.log(`🔄 Sincronizando mi estado local: ${playerReadyForNextRound} → ${myReady}`);
        playerReadyForNextRound = myReady;
        
        // Si se resetea a false, también resetear el flag de procesamiento
        if (!myReady) {
            isProcessingContinueClick = false;
        }
    }
    
    // Solo actualizar si hay un cambio real en el rival
    if (rivalReadyForNextRound !== rivalReady) {
        const previousRivalReady = rivalReadyForNextRound;
        rivalReadyForNextRound = rivalReady;
        
        console.log(`🔄 Rival ready cambió de ${previousRivalReady} a ${rivalReady}`);
        
        // Actualizar UI inmediatamente
        updateContinueButtonStatus();
        
        // Si ahora ambos están listos, ejecutar transición
        if (playerReadyForNextRound && rivalReadyForNextRound) {
            console.log('🚀 AMBOS JUGADORES LISTOS - la transición se manejará en updateContinueButtonStatus()');
        }
    } else {
        // Aunque no haya cambio en rival, verificar si necesitamos actualizar UI
        // (en caso de cambios en mi propio estado)
        if (playerReadyForNextRound !== myReady) {
            updateContinueButtonStatus();
        }
    }
};

// Nuevo callback para cambios en el estado de los jugadores
window.onPlayersStateChanged = function(players) {
    console.log('Estado de jugadores cambió:', players);
    
    // Obtener datos de ambos jugadores
    const playersArray = Object.values(players);
    if (playersArray.length === 2) {
        const myPlayerId = useFirebase ? window.firebaseMultiplayer.playerId : (isRoomHost ? 'host' : 'guest');
        const otherPlayer = playersArray.find(p => p.id !== myPlayerId);
        
        if (otherPlayer) {
            console.log('Datos del rival:', otherPlayer);
            
            // SINCRONIZACIÓN DE RONDA - Verificar si el rival está en una ronda diferente
            if (otherPlayer.currentRound && otherPlayer.currentRound !== currentRoundNumber) {
                console.log(`🔄 SINCRONIZANDO RONDA: Mi ronda ${currentRoundNumber} → Ronda del rival ${otherPlayer.currentRound}`);
                
                if (otherPlayer.currentRound > currentRoundNumber) {
                    // El rival avanzó, sincronizar mi ronda
                    currentRoundNumber = otherPlayer.currentRound;
                    console.log(`📈 Avanzando a ronda ${currentRoundNumber} para sincronizar con rival`);
                    
                    // Actualizar mi ronda en Firebase
                    if (useFirebase && firebaseMultiplayer) {
                        firebaseMultiplayer.updatePlayerCurrentRound(currentRoundNumber);
                    }
                    
                    // Resetear estados para la nueva ronda
                    playerFinished = false;
                    rivalFinished = false;
                    playerGaveUp = false;
                    rivalGaveUp = false;
                    playerReadyForNextRound = false;
                    rivalReadyForNextRound = false;
                    isProcessingContinueClick = false; // Resetear flag también
                    
                    // Configurar nueva ronda
                    updateMultiplayerDisplay();
                    setupMultiplayerRound();
                    showScreen(gameContainerEl);
                    
                    setTimeout(() => {
                        startGameRound();
                    }, 1000);
                    
                    return; // Salir temprano para evitar procesar datos obsoletos
                }
            }
            
            // Actualizar estado del rival basado en datos reales
            const previousRivalScore = rivalScore;
            rivalScore = otherPlayer.score || 0;
            
            // Verificar estado de la ronda actual - CORREGIR ÍNDICE
            if (otherPlayer.roundStatus) {
                let rivalRoundStatus = null;
                
                // Intentar como array (índice basado en 0)
                if (Array.isArray(otherPlayer.roundStatus) && otherPlayer.roundStatus[currentRoundNumber - 1]) {
                    rivalRoundStatus = otherPlayer.roundStatus[currentRoundNumber - 1];
                    console.log(`Rival ronda ${currentRoundNumber} (array índice ${currentRoundNumber - 1}):`, rivalRoundStatus);
                } 
                // Intentar como objeto con clave numérica
                else if (otherPlayer.roundStatus[currentRoundNumber]) {
                    rivalRoundStatus = otherPlayer.roundStatus[currentRoundNumber];
                    console.log(`Rival ronda ${currentRoundNumber} (objeto clave ${currentRoundNumber}):`, rivalRoundStatus);
                }
                
                if (rivalRoundStatus) {
                    rivalFinished = rivalRoundStatus.status === 'completed' || rivalRoundStatus.status === 'gaveUp' || rivalRoundStatus.status === 'timeUp';
                    rivalGaveUp = rivalRoundStatus.status === 'gaveUp' || rivalRoundStatus.gaveUp === true;
                    console.log('Estados del rival actualizados:', {
                        finished: rivalFinished,
                        gaveUp: rivalGaveUp,
                        status: rivalRoundStatus.status
                    });
                }
            }
            
            // MEJORADA: Verificar estado de listo para continuar
            const newRivalReadyState = Boolean(otherPlayer.readyForNext);
            console.log('Verificando estado rival readyForNext:', {
                raw: otherPlayer.readyForNext,
                converted: newRivalReadyState,
                current: rivalReadyForNextRound
            });
            
            if (rivalReadyForNextRound !== newRivalReadyState) {
                rivalReadyForNextRound = newRivalReadyState;
                console.log('🔄 Rival ready state cambió a:', rivalReadyForNextRound);
                
                // Actualizar UI inmediatamente
                updateContinueButtonStatus();
            }
            
            // Actualizar display y verificar si la ronda terminó
            updateMultiplayerDisplay();
            checkRoundEnd();
        }
    }
};

// Sistema de multiplayer híbrido (Firebase + localStorage fallback)
async function initializeMultiplayer() {
    // Esperar un momento para asegurar que Firebase esté completamente cargado
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (typeof window.firebaseMultiplayer !== 'undefined' && typeof window.firebaseDb !== 'undefined') {
        const initialized = window.firebaseMultiplayer.init();
        if (initialized) {
            useFirebase = true;
            console.log('🔥 Sistema multiplayer: Firebase Online');
            return;
        }
    }
    
    useFirebase = false;
    console.log('📱 Sistema multiplayer: Local (localStorage) - Firebase no disponible');
}

// Funciones de manejo de estado híbridas
async function createMultiplayerRoom(gameMode, totalRounds) {
    console.log('🏠 Creando sala multijugador...', { useFirebase, gameMode, totalRounds });
    
    if (useFirebase) {
        console.log('🔥 Usando Firebase para crear sala...');
        const code = await window.firebaseMultiplayer.createRoom(gameMode, totalRounds);
        if (code) {
            roomCode = code;
            isRoomHost = true;
            waitingForPlayer = true;
            console.log('✅ Sala Firebase creada:', code);
            return true;
        }
        console.log('❌ Error creando sala Firebase');
        return false;
    } else {
        // Fallback a localStorage
        console.log('📱 Usando localStorage como respaldo...');
        roomCode = generateRoomCode();
        isRoomHost = true;
        waitingForPlayer = true;
        updateGlobalRoomState(roomCode, {
            players: 1,
            hostSettings: { gameMode, totalRounds },
            sharedConcepts: null
        });
        return true;
    }
}

async function joinMultiplayerRoom(code) {
    if (useFirebase) {
        const success = await window.firebaseMultiplayer.joinRoom(code);
        if (success) {
            roomCode = code;
            isRoomHost = false;
            waitingForPlayer = false;
            
            // Obtener configuración del host
            const roomData = await window.firebaseMultiplayer.getRoomData();
            if (roomData) {
                gameMode = roomData.gameMode;
                totalRounds = roomData.totalRounds;
            }
        }
        return success;
    } else {
        // Fallback a localStorage
        const globalRoomState = getGlobalRoomState();
        if (!globalRoomState[code]) {
            return false;
        }
        
        const roomState = globalRoomState[code];
        if (roomState.players >= 2) {
            return false;
        }
        
        roomCode = code;
        isRoomHost = false;
        waitingForPlayer = false;
        gameMode = roomState.hostSettings.gameMode;
        totalRounds = roomState.hostSettings.totalRounds;
        
        updateGlobalRoomState(code, { players: 2 });
        return true;
    }
}

function leaveMultiplayerRoom() {
    if (useFirebase && window.firebaseMultiplayer) {
        window.firebaseMultiplayer.leaveRoom();
    } else {
        // Limpiar localStorage
        if (roomCode) {
            const globalRoomState = getGlobalRoomState();
            delete globalRoomState[roomCode];
            setGlobalRoomState(globalRoomState);
        }
    }
}

// Referencias a elementos HTML
const startNameEl = document.getElementById('start-name');
const startImgEl = document.getElementById('start-img');
const startPlaceholderEl = document.getElementById('start-placeholder');
const endNameEl = document.getElementById('end-name');
const endImgEl = document.getElementById('end-img');
const endPlaceholderEl = document.getElementById('end-placeholder');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const summarySectionEl = document.getElementById('summary-section');
const finalScoreEl = document.getElementById('final-score');
const finalMessageEl = document.getElementById('final-message');
const gameContainerEl = document.getElementById('game-container');
const startWikiBtn = document.getElementById('start-wiki');
const endWikiBtn = document.getElementById('end-wiki');
const wikipediaIframe = document.getElementById('wikipedia-iframe');
const statusMessageEl = document.getElementById('status-message');

// Referencias a elementos de selección de tipo de juego
const gameTypeSelectionEl = document.getElementById('game-type-selection');
const singleplayerModeSelectionEl = document.getElementById('singleplayer-mode-selection');
const onlineModeSelectionEl = document.getElementById('online-mode-selection');
const onlineRoundsSelectionEl = document.getElementById('online-rounds-selection');
const roomSelectionEl = document.getElementById('room-selection');
const joinRoomScreenEl = document.getElementById('join-room-screen');
const multiplayerWaitingEl = document.getElementById('multiplayer-waiting');

// Referencias a pantalla de resultados de ronda
const roundResultsScreenEl = document.getElementById('round-results-screen');
const resultsRoundNumberEl = document.getElementById('results-round-number');
const playerResultStatusEl = document.getElementById('player-result-status');
const playerResultTimeEl = document.getElementById('player-result-time');
const playerResultScoreEl = document.getElementById('player-result-score');
const rivalResultStatusEl = document.getElementById('rival-result-status');
const rivalResultTimeEl = document.getElementById('rival-result-time');
const rivalResultScoreEl = document.getElementById('rival-result-score');
const currentPlayerScoreEl = document.getElementById('current-player-score');
const currentRivalScoreEl = document.getElementById('current-rival-score');
const remainingCountEl = document.getElementById('remaining-count');
const continueNextRoundBtn = document.getElementById('continue-next-round-btn');
const continueBtnTextEl = document.getElementById('continue-btn-text');
const continueConfirmationStatusEl = document.getElementById('continue-confirmation-status');

// Referencias a elementos multijugador
const multiplayerInfoEl = document.getElementById('multiplayer-info');
const currentRoundEl = document.getElementById('current-round');
const totalRoundsEl = document.getElementById('total-rounds');
const rivalScoreEl = document.getElementById('rival-score');
const roomCodeDisplayEl = document.getElementById('room-code-display');
const playerCountEl = document.getElementById('player-count');
const countdownEl = document.getElementById('countdown');
const countdownTimerEl = document.getElementById('countdown-timer');
const roomCodeInputEl = document.getElementById('room-code-input');
const copyRoomCodeBtn = document.getElementById('copy-room-code');

// Referencias a resumen multijugador
const singleplayerSummaryEl = document.getElementById('singleplayer-summary');
const multiplayerSummaryEl = document.getElementById('multiplayer-summary');
const multiplayerResultEl = document.getElementById('multiplayer-result');
const playerFinalScoreEl = document.getElementById('player-final-score');
const rivalFinalScoreEl = document.getElementById('rival-final-score');
const multiplayerFinalMessageEl = document.getElementById('multiplayer-final-message');

// Referencias a los botones
const startGameBtn = document.getElementById('start-game-btn');
const checkTargetBtn = document.getElementById('check-target-btn');
const nextButton = document.getElementById('next-button');
const anotherButton = document.getElementById('another-button');
const giveUpButton = document.getElementById('give-up-button');
const playAgainButton = document.getElementById('play-again-button');
const continueMultiplayerBtn = document.getElementById('continue-multiplayer-btn');
const waitingRivalBtn = document.getElementById('waiting-rival-btn');

// Botones de selección de tipo de juego
const singleplayerBtn = document.getElementById('singleplayer-btn');
const onlineBtn = document.getElementById('online-btn');

// Botones de modos singleplayer
const singleEasyButton = document.getElementById('single-easy');
const singleNormalButton = document.getElementById('single-normal');
const singleHardButton = document.getElementById('single-hard');
const singleEndlessButton = document.getElementById('single-endless');

// Botones de modos online
const onlineEasyButton = document.getElementById('online-easy');
const onlineNormalButton = document.getElementById('online-normal');
const onlineHardButton = document.getElementById('online-hard');
const onlineEndlessButton = document.getElementById('online-endless');

// Botones de rondas
const rounds3Button = document.getElementById('rounds-3');
const rounds5Button = document.getElementById('rounds-5');

// Botones de salas
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const joinRoomConfirmBtn = document.getElementById('join-room-confirm');

// Botones de navegación (volver)
const backFromSingleBtn = document.getElementById('back-from-single');
const backFromOnlineBtn = document.getElementById('back-from-online');
const backFromRoundsBtn = document.getElementById('back-from-rounds');
const backFromRoomBtn = document.getElementById('back-from-room');
const backFromJoinBtn = document.getElementById('back-from-join');

// Tiempos para cada modo de juego en segundos
const gameTimes = {
    'easy': 6 * 60,
    'normal': 4 * 60,
    'hard': 2 * 60,
    'endless': -1 // -1 para modo sin tiempo
};

// Funciones de localStorage como fallback
function getGlobalRoomState() {
    try {
        const stored = localStorage.getItem('wikigame_rooms');
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.warn('Error cargando estado de salas:', e);
        return {};
    }
}

function setGlobalRoomState(state) {
    try {
        localStorage.setItem('wikigame_rooms', JSON.stringify(state));
    } catch (e) {
        console.warn('Error guardando estado de salas:', e);
    }
}

function updateGlobalRoomState(roomCode, updates) {
    const globalRoomState = getGlobalRoomState();
    
    if (!globalRoomState[roomCode]) {
        globalRoomState[roomCode] = {
            players: 1,
            hostSettings: null,
            sharedConcepts: null,
            created: Date.now()
        };
    }
    Object.assign(globalRoomState[roomCode], updates);
    
    // Limpiar salas antiguas (más de 1 hora)
    const oneHour = 60 * 60 * 1000;
    const now = Date.now();
    Object.keys(globalRoomState).forEach(code => {
        if (now - globalRoomState[code].created > oneHour) {
            delete globalRoomState[code];
        }
    });
    
    setGlobalRoomState(globalRoomState);
    console.log('Estado actualizado (localStorage):', globalRoomState);
    
    // Notificar cambios solo si no estamos usando Firebase
    if (!useFirebase) {
        checkRoomStateChanges(roomCode);
    }
}

function checkRoomStateChanges(code) {
    if (roomCode === code && !useFirebase) {
        const globalRoomState = getGlobalRoomState();
        const state = globalRoomState[code];
        
        if (!state) return;
        
        // Si somos el host y hay 2 jugadores, actualizar la UI
        if (isRoomHost && state.players === 2 && waitingForPlayer) {
            waitingForPlayer = false;
            playerCountEl.textContent = 'Jugadores: 2/2';
            document.getElementById('waiting-title').textContent = '¡Ambos jugadores conectados!';
            document.getElementById('player2').innerHTML = '<div class="player-avatar connected"></div><span>Jugador 2</span>';
            
            // Mostrar countdown
            countdownEl.classList.remove('hidden');
            startCountdown();
        }
    }
}

// --- Funciones del Sistema de Navegación ---

function showScreen(screenElement) {
    // Ocultar todas las pantallas de selección
    gameTypeSelectionEl.classList.add('hidden');
    singleplayerModeSelectionEl.classList.add('hidden');
    onlineModeSelectionEl.classList.add('hidden');
    onlineRoundsSelectionEl.classList.add('hidden');
    roomSelectionEl.classList.add('hidden');
    joinRoomScreenEl.classList.add('hidden');
    multiplayerWaitingEl.classList.add('hidden');
    gameContainerEl.classList.add('hidden');
    summarySectionEl.classList.add('hidden');
    roundResultsScreenEl.classList.add('hidden');
    
    // Mostrar la pantalla solicitada
    screenElement.classList.remove('hidden');
}

async function selectGameType(type) {
    gameType = type;
    if (type === 'singleplayer') {
        showScreen(singleplayerModeSelectionEl);
    } else {
        // Para online, inicializar Firebase y después elegir crear/unirse
        await initializeMultiplayer();
        showScreen(roomSelectionEl);
    }
}

function selectSingleplayerMode(mode) {
    gameMode = mode;
    gameType = 'singleplayer';
    showScreen(gameContainerEl);
    setupNewRound();
}

function selectOnlineMode(mode) {
    gameMode = mode;
    gameType = 'online';
    showScreen(onlineRoundsSelectionEl);
}

function selectRounds(rounds) {
    totalRounds = rounds;
    // Después de seleccionar rondas, crear la sala directamente
    createRoomWithSettings();
}

async function createRoomWithSettings() {
    console.log('Creando sala con configuración:', { gameMode, totalRounds });
    
    const success = await createMultiplayerRoom(gameMode, totalRounds);
    if (!success) {
        alert('Error creando la sala. Inténtalo de nuevo.');
        return;
    }
    
    roomCodeDisplayEl.textContent = roomCode;
    playerCountEl.textContent = 'Jugadores: 1/2';
    document.getElementById('waiting-title').textContent = 'Esperando jugadores...';
    document.getElementById('player2').innerHTML = '<div class="player-avatar waiting"></div><span>Esperando...</span>';
    
    showScreen(multiplayerWaitingEl);
    
    console.log(`Sala creada con código: ${roomCode}. Sistema: ${useFirebase ? 'Firebase' : 'localStorage'}`);
}

function createRoom() {
    // Ahora "Crear Sala" lleva a configurar modo y rondas
    showScreen(onlineModeSelectionEl);
}

function joinRoom() {
    showScreen(joinRoomScreenEl);
}

async function confirmJoinRoom() {
    const code = roomCodeInputEl.value.trim().toUpperCase();
    if (code.length !== 6) {
        alert('Por favor, introduce un código válido de 6 caracteres');
        return;
    }
    
    const result = await joinMultiplayerRoom(code);
    if (!result) {
        alert('Sala no encontrada. Verifica el código.');
        return;
    }
    
    // Configurar interfaz tras unirse exitosamente
    roomCode = code;
    isRoomHost = false;
    waitingForPlayer = false;
    
    // Configurar UI del guest
    roomCodeDisplayEl.textContent = roomCode;
    playerCountEl.textContent = 'Jugadores: 2/2';
    document.getElementById('waiting-title').textContent = '¡Te has unido a la sala!';
    document.getElementById('player1').innerHTML = '<div class="player-avatar connected"></div><span>Host</span>';
    document.getElementById('player2').innerHTML = '<div class="player-avatar connected"></div><span>Tú</span>';
    showScreen(multiplayerWaitingEl);
    
    // El guest también debe iniciar el countdown después de unirse
    setTimeout(() => {
        countdownEl.classList.remove('hidden');
        startCountdown();
    }, 1500);
    
    console.log(`Te uniste exitosamente a la sala: ${roomCode}. Sistema: ${useFirebase ? 'Firebase' : 'localStorage'}`);
}

function generateSharedConcepts() {
    // Esta función genera los conceptos que serán compartidos entre ambos jugadores
    sharedConcepts = [];
    
    for (let i = 0; i < totalRounds; i++) {
        const start = allConcepts[Math.floor(Math.random() * allConcepts.length)];
        const filteredConcepts = allConcepts.filter(c => 
            c.category !== start.category && 
            c.name !== start.name
        );
        
        const end = filteredConcepts.length > 0 
            ? filteredConcepts[Math.floor(Math.random() * filteredConcepts.length)]
            : allConcepts.filter(c => c.name !== start.name)[Math.floor(Math.random() * (allConcepts.length - 1))];
        
        sharedConcepts.push({ start, end });
    }
    
    console.log('Conceptos compartidos generados:', sharedConcepts);
}

// Función auxiliar para simular cuando alguien se une a nuestra sala (para testing)
function simulatePlayerJoining() {
    if (!waitingForPlayer || !isRoomHost) return;
    
    // Simular que alguien se unió actualizando el estado global
    updateGlobalRoomState(roomCode, {
        players: 2
    });
    
    // Como somos el host, generamos los conceptos compartidos
    generateSharedConcepts();
    updateGlobalRoomState(roomCode, {
        sharedConcepts: sharedConcepts
    });
    
    console.log('Jugador 2 simulado conectado a la sala');
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function simulatePlayerJoining() {
    playerCountEl.textContent = 'Jugadores: 2/2';
    document.getElementById('waiting-title').textContent = '¡Ambos jugadores conectados!';
    document.getElementById('player2').innerHTML = '<div class="player-avatar connected"></div><span>Jugador 2</span>';
    
    // Mostrar countdown
    countdownEl.classList.remove('hidden');
    startCountdown();
}

function simulateGameStart() {
    document.getElementById('player1').innerHTML = '<div class="player-avatar connected"></div><span>Tú</span>';
    document.getElementById('player2').innerHTML = '<div class="player-avatar connected"></div><span>Rival</span>';
    countdownEl.classList.remove('hidden');
    startCountdown();
}

function startCountdown() {
    let countdownTime = 5;
    countdownTimerEl.textContent = countdownTime;
    
    const countdownInterval = setInterval(() => {
        countdownTime--;
        countdownTimerEl.textContent = countdownTime;
        
        if (countdownTime <= 0) {
            clearInterval(countdownInterval);
            // Ocultar countdown y iniciar automáticamente
            countdownEl.classList.add('hidden');
            startMultiplayerGame();
        }
    }, 1000);
}

async function startMultiplayerGame() {
    // Inicializar variables del multijugador
    currentRoundNumber = 1;
    playerScore = 0;
    rivalScore = 0;
    
    // Usar el sistema híbrido para obtener los conceptos compartidos
    if (useFirebase && firebaseMultiplayer) {
        // Con Firebase, los conceptos ya están sincronizados mediante los listeners
        console.log('Usando conceptos de Firebase:', sharedConcepts?.slice(0, 3) || 'No disponibles');
    } else {
        // Con localStorage, obtener del estado global
        const globalRoomState = getGlobalRoomState();
        const roomState = globalRoomState[roomCode];
        if (roomState && roomState.sharedConcepts) {
            sharedConcepts = roomState.sharedConcepts;
        }
    }
    
    // Si somos el host y no se han generado los conceptos, generarlos ahora
    if (isRoomHost && !sharedConcepts) {
        generateSharedConcepts();
        
        // Sincronizar usando el sistema híbrido
        if (useFirebase && firebaseMultiplayer) {
            await firebaseMultiplayer.updateRoomData(roomCode, { sharedConcepts });
        } else {
            updateGlobalRoomState(roomCode, { sharedConcepts });
        }
    }
    
    // Mostrar interfaz de juego
    showScreen(gameContainerEl);
    multiplayerInfoEl.classList.remove('hidden');
    
    // Actualizar display multijugador
    updateMultiplayerDisplay();
    
    // Configurar primera ronda con conceptos compartidos
    setupMultiplayerRound();
    
    // Iniciar automáticamente la primera ronda después de un breve delay
    setTimeout(() => {
        startGameRound();
    }, 1500);
}

function updateMultiplayerDisplay() {
    currentRoundEl.textContent = currentRoundNumber;
    totalRoundsEl.textContent = totalRounds;
    scoreEl.textContent = playerScore;
    rivalScoreEl.textContent = rivalScore;
}

// --- Funciones del Juego ---

async function loadConcepts() {
    try {
        const response = await fetch('concepts.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        allConcepts = await response.json();
        console.log(`Cargados ${allConcepts.length} conceptos.`);
    } catch (error) {
        console.error("Error al cargar los conceptos:", error);
    }
}

function selectGameMode(mode) {
    gameMode = mode;
    showScreen(gameContainerEl);
    setupNewRound();
}

function selectNewConcepts() {
    const start = allConcepts[Math.floor(Math.random() * allConcepts.length)];
    // Filtramos para que el concepto final NO sea de la misma categoría que el inicio
    const filteredConcepts = allConcepts.filter(c => 
        c.category !== start.category && 
        c.name !== start.name
    );
    
    if (filteredConcepts.length === 0) {
        console.warn("No se encontraron conceptos de una categoría diferente. Seleccionando de la misma categoría.");
        const filteredByName = allConcepts.filter(c => c.name !== start.name);
        const end = filteredByName[Math.floor(Math.random() * filteredByName.length)];
        currentRound = { start, end };
    } else {
        const end = filteredConcepts[Math.floor(Math.random() * filteredConcepts.length)];
        currentRound = { start, end };
    }
    
    currentRound.startForNextRound = currentRound.end;
}

function setupNewRound() {
    if (gameType === 'online') {
        setupMultiplayerRound();
        return;
    }
    
    // Lógica original para singleplayer
    // Si no hay un concepto de inicio previo, seleccionamos par nuevo
    if (!currentRound.startForNextRound) {
        selectNewConcepts();
    } else {
        // Caso 'Siguiente': el concepto final anterior se convierte en el inicial
        currentRound.start = currentRound.startForNextRound;
        
        // Seleccionar nuevo concepto final que NO sea de la misma categoría
        const filteredConcepts = allConcepts.filter(c => 
            c.category !== currentRound.start.category && 
            c.name !== currentRound.start.name
        );
        
        if (filteredConcepts.length === 0) {
            console.warn("No se encontraron conceptos de una categoría diferente.");
            const filteredByName = allConcepts.filter(c => c.name !== currentRound.start.name);
            currentRound.end = filteredByName[Math.floor(Math.random() * filteredByName.length)];
        } else {
            currentRound.end = filteredConcepts[Math.floor(Math.random() * filteredConcepts.length)];
        }
        
        currentRound.startForNextRound = currentRound.end;
    }

    console.log(`Nueva ronda: ${currentRound.start.name} (${currentRound.start.category}) → ${currentRound.end.name} (${currentRound.end.category})`);

    // Actualizar el display
    updateConceptDisplay(currentRound.start, startNameEl, startImgEl, startPlaceholderEl, startWikiBtn);
    updateConceptDisplay(currentRound.end, endNameEl, endImgEl, endPlaceholderEl, endWikiBtn);

    // Resetear estado del juego
    gameActive = false;
    wikipediaIframe.src = 'about:blank';
    
    // Mostrar/ocultar botones
    startGameBtn.classList.remove('hidden');
    checkTargetBtn.classList.add('hidden');
    nextButton.classList.add('hidden');
    anotherButton.classList.add('hidden');
    giveUpButton.classList.add('hidden');
    continueMultiplayerBtn.classList.add('hidden');
    waitingRivalBtn.classList.add('hidden');
    
    statusMessageEl.textContent = 'Haz clic en "Comenzar" para iniciar el juego';
    
    // Parar timer si está corriendo
    clearInterval(timerId);
    updateTimerDisplay();
}

function setupMultiplayerRound() {
    console.log('setupMultiplayerRound - Estado:', {
        sharedConcepts: sharedConcepts,
        currentRoundNumber: currentRoundNumber,
        conceptsLength: sharedConcepts ? sharedConcepts.length : 'no concepts'
    });
    
    if (!sharedConcepts || currentRoundNumber > sharedConcepts.length) {
        console.error('No hay conceptos compartidos disponibles para esta ronda');
        
        // Si no hay conceptos, generar nuevos (temporal)
        if (isRoomHost) {
            console.log('Host generando conceptos de emergencia...');
            generateSharedConcepts();
            return;
        } else {
            console.error('No soy host, esperando conceptos...');
            // Intentar cargar conceptos desde Firebase
            if (useFirebase && firebaseMultiplayer) {
                firebaseMultiplayer.loadSharedConcepts()
                    .then(concepts => {
                        if (concepts) {
                            sharedConcepts = concepts;
                            console.log('Conceptos cargados desde Firebase:', concepts);
                            setupMultiplayerRound(); // Reintentar
                        }
                    })
                    .catch(err => console.error('Error cargando conceptos:', err));
            }
            return;
        }
    }
    
    // Usar los conceptos predefinidos para esta ronda
    const roundConcepts = sharedConcepts[currentRoundNumber - 1];
    currentRound.start = roundConcepts.start;
    currentRound.end = roundConcepts.end;
    
    console.log(`Ronda multijugador ${currentRoundNumber}: ${currentRound.start.name} → ${currentRound.end.name}`);
    
    // Actualizar el display
    updateConceptDisplay(currentRound.start, startNameEl, startImgEl, startPlaceholderEl, startWikiBtn);
    updateConceptDisplay(currentRound.end, endNameEl, endImgEl, endPlaceholderEl, endWikiBtn);

    // Resetear TODOS los estados del juego para la nueva ronda
    gameActive = false;
    playerFinished = false;
    rivalFinished = false;
    playerGaveUp = false;
    rivalGaveUp = false;
    playerReadyForNextRound = false;
    rivalReadyForNextRound = false;
    isProcessingContinueClick = false; // Resetear flag de procesamiento
    wikipediaIframe.src = 'about:blank';
    
    // Resetear estilos del botón de espera
    if (waitingRivalBtn) {
        waitingRivalBtn.textContent = 'Esperando rival...';
        waitingRivalBtn.style.background = '';
    }
    
    // Mostrar/ocultar botones (modo multijugador)
    startGameBtn.classList.remove('hidden');
    checkTargetBtn.classList.add('hidden');
    nextButton.classList.add('hidden');
    anotherButton.classList.add('hidden'); // No disponible en multijugador
    giveUpButton.classList.add('hidden');
    continueMultiplayerBtn.classList.add('hidden');
    waitingRivalBtn.classList.add('hidden');
    
    statusMessageEl.textContent = 'Haz clic en "Comenzar" para iniciar la ronda';
    
    // Parar timer si está corriendo
    clearInterval(timerId);
    updateTimerDisplay();
}

function startGameRound() {
    if (!currentRound.start || !currentRound.end) {
        console.error('No hay conceptos definidos para la ronda');
        return;
    }

    gameActive = true;
    roundStartTime = Date.now();
    
    // Cargar Wikipedia del concepto inicial
    wikipediaIframe.src = currentRound.start.wiki_link;
    
    // Iniciar cronómetro
    if (gameMode !== 'endless') {
        timeLeft = gameTimes[gameMode];
        startTimer();
    } else {
        timeLeft = 0;
        startEndlessTimer();
    }
    
    // Actualizar botones
    startGameBtn.classList.add('hidden');
    checkTargetBtn.classList.remove('hidden');
    anotherButton.classList.remove('hidden');
    giveUpButton.classList.remove('hidden');
    
    statusMessageEl.textContent = `Navega desde "${currentRound.start.name}" hasta "${currentRound.end.name}"`;
    
    // Iniciar monitoreo del iframe con un pequeño delay
    setTimeout(() => {
        startIframeMonitoring();
    }, 2000);
    
    // Agregar también un listener para cambios de URL en el iframe
    addIframeLoadListener();
}

function addIframeLoadListener() {
    wikipediaIframe.addEventListener('load', () => {
        if (!gameActive) return;
        
        setTimeout(() => {
            try {
                const currentUrl = wikipediaIframe.contentWindow.location.href;
                console.log('Iframe cargado:', currentUrl);
                checkTargetReached(currentUrl);
            } catch (e) {
                console.log('CORS: No se puede acceder a la URL del iframe');
                // Fallback: intentar detectar por otros métodos
                tryAlternativeDetection();
            }
        }, 1000);
    });
}

function tryAlternativeDetection() {
    if (!gameActive) return;
    
    // Método alternativo: verificar si el src del iframe cambió
    const currentSrc = wikipediaIframe.src;
    if (currentSrc && currentSrc !== 'about:blank') {
        checkTargetReached(currentSrc);
    }
}

function startTimer() {
    clearInterval(timerId);
    
    timerId = setInterval(() => {
        if (timeLeft <= 0) {
            onTimeUp();
            return;
        }
        
        timeLeft--;
        updateTimerDisplay();
    }, 1000);
}

function startEndlessTimer() {
    clearInterval(timerId);
    timeLeft = 0;
    
    timerId = setInterval(() => {
        timeLeft++;
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    if (gameMode === 'endless') {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    } else {
        if (timeLeft <= 0) {
            timerEl.textContent = '0:00';
        } else {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }
    }
}

function startIframeMonitoring() {
    console.log('Iniciando monitoreo del iframe...');
    
    // Solución 1: Monitoreo con postMessage (más confiable)
    setupPostMessageListener();
    
    // Solución 2: Monitoreo de título de página
    startTitleMonitoring();
    
    // Solución 3: Monitoreo de cambios en el iframe
    startNavigationMonitoring();
    
    // Solución 4: Monitoreo agresivo por URL del src
    startSrcMonitoring();
}

function startSrcMonitoring() {
    const checkSrc = () => {
        if (!gameActive) return;
        
        try {
            const currentSrc = wikipediaIframe.src;
            console.log('Verificando src del iframe:', currentSrc);
            
            if (currentSrc && currentSrc !== 'about:blank') {
                checkTargetReached(currentSrc);
            }
        } catch (e) {
            console.log('Error verificando src:', e);
        }
        
        if (gameActive) {
            setTimeout(checkSrc, 1500); // Verificar cada 1.5 segundos
        }
    };
    
    setTimeout(checkSrc, 2000);
}

function setupPostMessageListener() {
    // Escuchar mensajes del iframe (si la página los envía)
    window.addEventListener('message', (event) => {
        if (event.origin !== 'https://es.wikipedia.org') return;
        
        if (event.data.type === 'urlChange') {
            checkTargetReached(event.data.url);
        }
    });
}

function startTitleMonitoring() {
    // Monitorear cambios en el título de la página del iframe
    const checkTitle = () => {
        if (!gameActive) return;
        
        try {
            const iframeDoc = wikipediaIframe.contentDocument || wikipediaIframe.contentWindow.document;
            const title = iframeDoc.title;
            
            if (title) {
                // Extraer el nombre del artículo del título
                const articleName = extractArticleNameFromTitle(title);
                const targetName = currentRound.end.name.toLowerCase().trim();
                
                if (articleName && articleName.includes(targetName) || targetName.includes(articleName)) {
                    console.log(`Título detectado: ${title}, Objetivo: ${currentRound.end.name}`);
                    onTargetReached();
                    return;
                }
            }
        } catch (e) {
            // CORS error - título no accesible
        }
        
        if (gameActive) {
            setTimeout(checkTitle, 2000);
        }
    };
    
    setTimeout(checkTitle, 3000); // Dar tiempo para la carga inicial
}

function extractArticleNameFromTitle(title) {
    // Los títulos de Wikipedia suelen ser "Nombre del artículo - Wikipedia"
    const cleaned = title.replace(' - Wikipedia', '').toLowerCase().trim();
    return cleaned;
}

function startNavigationMonitoring() {
    // Monitorear navegación mediante eventos del iframe
    let lastSrc = wikipediaIframe.src;
    
    const checkNavigation = () => {
        if (!gameActive) return;
        
        try {
            const currentSrc = wikipediaIframe.src;
            if (currentSrc !== lastSrc) {
                lastSrc = currentSrc;
                console.log('Navegación detectada:', currentSrc);
                
                // Verificar si la nueva URL coincide con el objetivo
                setTimeout(() => checkTargetReached(currentSrc), 1000);
            }
        } catch (e) {
            console.log('Error monitoreando navegación:', e);
        }
        
        if (gameActive) {
            setTimeout(checkNavigation, 1000);
        }
    };
    
    setTimeout(checkNavigation, 2000);
}

function checkTargetReached(currentUrl) {
    if (!gameActive || !currentUrl) return;
    
    // Normalizar URLs para comparación
    const targetUrl = currentRound.end.wiki_link;
    const normalizedCurrent = normalizeWikipediaUrl(currentUrl);
    const normalizedTarget = normalizeWikipediaUrl(targetUrl);
    
    console.log('Comparando URLs:', {
        current: normalizedCurrent,
        target: normalizedTarget,
        currentFull: currentUrl,
        targetFull: targetUrl
    });
    
    if (normalizedCurrent === normalizedTarget) {
        console.log('¡Objetivo alcanzado automáticamente!');
        onTargetReached();
    }
}

function normalizeWikipediaUrl(url) {
    if (!url) return '';
    
    try {
        // Extraer solo el nombre del artículo de la URL
        const match = url.match(/\/wiki\/([^#?]+)/);
        if (match) {
            // Decodificar URL y normalizar
            const articleName = decodeURIComponent(match[1])
                .toLowerCase()
                .replace(/_/g, ' ')
                .trim();
            return articleName;
        }
        return '';
    } catch (e) {
        console.error('Error normalizando URL:', e);
        return '';
    }
}

function checkTargetReached(currentUrl) {
    if (!gameActive || !currentUrl) return;
    
    // Normalizar URLs para comparación
    const targetUrl = currentRound.end.wiki_link;
    const normalizedCurrent = normalizeWikipediaUrl(currentUrl);
    const normalizedTarget = normalizeWikipediaUrl(targetUrl);
    
    console.log('Comparando URLs:', {
        current: normalizedCurrent,
        target: normalizedTarget,
        currentFull: currentUrl,
        targetFull: targetUrl
    });
    
    // Comparación exacta
    if (normalizedCurrent === normalizedTarget) {
        console.log('¡Objetivo alcanzado automáticamente!');
        onTargetReached();
        return;
    }
    
    // Comparación por nombre del concepto (fallback)
    const targetName = currentRound.end.name.toLowerCase().trim();
    if (normalizedCurrent.includes(targetName) || targetName.includes(normalizedCurrent)) {
        console.log('¡Objetivo alcanzado por nombre!');
        onTargetReached();
    }
}

function normalizeWikipediaUrl(url) {
    if (!url) return '';
    
    try {
        // Extraer solo el nombre del artículo de la URL
        const match = url.match(/\/wiki\/([^#?]+)/);
        if (match) {
            // Decodificar URL y normalizar
            const articleName = decodeURIComponent(match[1])
                .toLowerCase()
                .replace(/_/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return articleName;
        }
        return '';
    } catch (e) {
        console.error('Error normalizando URL:', e);
        return '';
    }
}

function onTargetReached() {
    if (!gameActive) return;
    
    gameActive = false;
    clearInterval(timerId);
    
    const roundTime = Math.floor((Date.now() - roundStartTime) / 1000);
    
    if (gameType === 'singleplayer') {
        score += 1;
        scoreEl.textContent = score;
        
        // Mostrar botón siguiente
        checkTargetBtn.classList.add('hidden');
        nextButton.classList.remove('hidden');
        anotherButton.classList.add('hidden');
        giveUpButton.classList.add('hidden');
        
        statusMessageEl.textContent = `¡Objetivo alcanzado en ${roundTime} segundos! Haz clic en "Siguiente" para continuar.`;
    } else {
        // Modo multijugador - actualizar estado en Firebase
        playerFinished = true;
        playerScore += 1;
        
        // Sincronizar con Firebase
        if (useFirebase && firebaseMultiplayer) {
            firebaseMultiplayer.updatePlayerScore(playerScore);
            firebaseMultiplayer.updatePlayerRoundStatus(currentRoundNumber, 'completed', roundTime, false);
        } else {
            // Fallback localStorage
            updateGlobalRoomState(roomCode, {
                [`player${isRoomHost ? 1 : 2}Score`]: playerScore,
                [`player${isRoomHost ? 1 : 2}RoundStatus`]: {
                    [currentRoundNumber]: {
                        status: 'completed',
                        completionTime: roundTime,
                        gaveUp: false
                    }
                }
            });
        }
        
        updateMultiplayerDisplay();
        
        // Ocultar botones de juego y mostrar espera
        checkTargetBtn.classList.add('hidden');
        giveUpButton.classList.add('hidden');
        waitingRivalBtn.classList.remove('hidden');
        
        statusMessageEl.textContent = `¡Objetivo alcanzado en ${roundTime} segundos! Esperando a tu rival...`;
        
        checkRoundEnd();
    }
    
    // Mostrar notificación visual
    showSuccessNotification();
}

// Función eliminada - ya no simulamos rival, usamos Firebase para jugadores reales

function checkRoundEnd() {
    if (playerFinished && rivalFinished) {
        // Ambos jugadores terminaron
        waitingRivalBtn.classList.add('hidden');
        
        if (currentRoundNumber < totalRounds) {
            // Mostrar pantalla de resultados antes de la siguiente ronda
            showRoundResults();
        } else {
            // Juego terminado
            endMultiplayerGame();
        }
    }
}

function showRoundResults() {
    // Configurar pantalla de resultados
    resultsRoundNumberEl.textContent = currentRoundNumber;
    
    // Resultado del jugador - verificar si ganó puntos en esta ronda
    const playerWonThisRound = !playerGaveUp && playerFinished;
    
    if (playerGaveUp) {
        // Se rindió
        playerResultStatusEl.textContent = '⚐ Se rindió';
        playerResultStatusEl.className = 'status-text timeout';
        playerResultTimeEl.textContent = 'abandonó la ronda';
        playerResultScoreEl.textContent = '+0 puntos';
        playerResultScoreEl.className = 'score-increment neutral';
    } else if (playerWonThisRound) {
        // Completó el objetivo
        playerResultStatusEl.textContent = '✓ Completado';
        playerResultStatusEl.className = 'status-text success';
        const completionTime = Math.floor((Date.now() - roundStartTime) / 1000);
        const minutes = Math.floor(completionTime / 60);
        const seconds = completionTime % 60;
        playerResultTimeEl.textContent = `en ${minutes}:${seconds.toString().padStart(2, '0')}`;
        playerResultScoreEl.textContent = '+1 punto';
        playerResultScoreEl.className = 'score-increment positive';
    } else {
        // No terminó (tiempo agotado)
        playerResultStatusEl.textContent = '⏰ Tiempo agotado';
        playerResultStatusEl.className = 'status-text failed';
        playerResultTimeEl.textContent = 'se agotó el tiempo';
        playerResultScoreEl.textContent = '+0 puntos';
        playerResultScoreEl.className = 'score-increment neutral';
    }
    
    // Resultado del rival - USAR DATOS REALES
    if (rivalGaveUp) {
        // Rival se rindió
        rivalResultStatusEl.textContent = '⚐ Se rindió';
        rivalResultStatusEl.className = 'status-text timeout';
        rivalResultTimeEl.textContent = 'abandonó la ronda';
        rivalResultScoreEl.textContent = '+0 puntos';
        rivalResultScoreEl.className = 'score-increment neutral';
    } else if (rivalFinished && (rivalScore >= playerScore || rivalScore > (currentRoundNumber - 1))) {
        // Rival completó (verificar si su puntuación aumentó)
        rivalResultStatusEl.textContent = '✓ Completado';
        rivalResultStatusEl.className = 'status-text success';
        // En una implementación real, el tiempo vendría de Firebase
        rivalResultTimeEl.textContent = 'completó el objetivo';
        rivalResultScoreEl.textContent = '+1 punto';
        rivalResultScoreEl.className = 'score-increment positive';
    } else {
        // Rival no completó
        rivalResultStatusEl.textContent = '⏰ No completó';
        rivalResultStatusEl.className = 'status-text failed';
        rivalResultTimeEl.textContent = 'se agotó el tiempo';
        rivalResultScoreEl.textContent = '+0 puntos';
        rivalResultScoreEl.className = 'score-increment neutral';
    }
    
    // Puntuaciones actuales (datos reales de Firebase)
    currentPlayerScoreEl.textContent = playerScore;
    currentRivalScoreEl.textContent = rivalScore;
    
    // Rondas restantes
    const remaining = totalRounds - currentRoundNumber;
    remainingCountEl.textContent = remaining;
    
    // RESETEAR completamente los estados de confirmación para la nueva ronda
    playerReadyForNextRound = false;
    rivalReadyForNextRound = false;
    isProcessingContinueClick = false; // Resetear flag
    
    // Resetear botón a estado inicial
    if (continueNextRoundBtn) {
        continueNextRoundBtn.disabled = false;
        continueNextRoundBtn.style.opacity = '1';
        continueNextRoundBtn.style.pointerEvents = 'auto';
        continueNextRoundBtn.style.cursor = 'pointer';
        continueBtnTextEl.textContent = 'Continuar a la Siguiente Ronda';
        continueConfirmationStatusEl.textContent = '0/2';
        continueNextRoundBtn.dataset.countdownActive = 'false';
    }
    
    console.log('🎭 Pantalla de resultados configurada:', {
        ronda: currentRoundNumber,
        playerReady: playerReadyForNextRound,
        rivalReady: rivalReadyForNextRound,
        processing: isProcessingContinueClick
    });
    
    // Actualizar el estado del botón después de resetear
    updateContinueButtonStatus();
    
    // Mostrar pantalla
    showScreen(roundResultsScreenEl);
    
    // Iniciar monitoreo para sistema de fallback
    startLocalStorageMonitoring();
    
    // NO auto-continuar - ahora requiere confirmación de ambos jugadores
}

function updateContinueButtonStatus() {
    const readyCount = (playerReadyForNextRound ? 1 : 0) + (rivalReadyForNextRound ? 1 : 0);
    console.log('Actualizando botón continuar:', { 
        playerReadyForNextRound, 
        rivalReadyForNextRound, 
        readyCount 
    });
    
    // Actualizar contador visual SIEMPRE
    continueConfirmationStatusEl.textContent = `${readyCount}/2`;
    
    if (!playerReadyForNextRound) {
        // CASO 1: El jugador aún no ha confirmado
        continueBtnTextEl.textContent = 'Continuar a la Siguiente Ronda';
        continueNextRoundBtn.disabled = false;
        continueNextRoundBtn.style.opacity = '1';
        continueNextRoundBtn.style.cursor = 'pointer';
        continueNextRoundBtn.style.pointerEvents = 'auto';
        
    } else if (playerReadyForNextRound && !rivalReadyForNextRound) {
        // CASO 2: Jugador listo, esperando rival
        continueBtnTextEl.textContent = 'Esperando al rival...';
        continueNextRoundBtn.disabled = true;
        continueNextRoundBtn.style.opacity = '0.6';
        continueNextRoundBtn.style.cursor = 'not-allowed';
        continueNextRoundBtn.style.pointerEvents = 'none';
        
    } else if (playerReadyForNextRound && rivalReadyForNextRound) {
        // CASO 3: Ambos listos - INICIAR COUNTDOWN
        console.log('🎯 AMBOS JUGADORES CONFIRMARON - Iniciando countdown de 3 segundos');
        
        // Prevenir múltiples ejecuciones del countdown
        if (continueNextRoundBtn.dataset.countdownActive === 'true') {
            console.log('⚠️ Countdown ya está activo, ignorando');
            return;
        }
        
        // Marcar que el countdown está activo
        continueNextRoundBtn.dataset.countdownActive = 'true';
        continueNextRoundBtn.disabled = true;
        continueNextRoundBtn.style.opacity = '0.8';
        continueNextRoundBtn.style.pointerEvents = 'none';
        
        // Cuenta regresiva de 3 segundos
        let countdown = 3;
        continueBtnTextEl.textContent = `¡Ambos listos! Continuando en ${countdown}...`;
        
        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                continueBtnTextEl.textContent = `¡Ambos listos! Continuando en ${countdown}...`;
            } else {
                clearInterval(countdownInterval);
                continueBtnTextEl.textContent = '¡Iniciando siguiente ronda!';
                
                // Ejecutar transición después de un breve delay
                setTimeout(() => {
                    actuallyStartNextRound();
                }, 500);
            }
        }, 1000);
    }
}

// Variable para prevenir clicks múltiples
let isProcessingContinueClick = false;

function onContinueButtonPressed() {
    console.log('=== BOTÓN CONTINUAR PRESIONADO ===');
    console.log('Estado actual:', { 
        playerReadyForNextRound, 
        rivalReadyForNextRound,
        isProcessingContinueClick,
        timestamp: Date.now()
    });
    
    // Prevenir doble click o si ya está listo
    if (isProcessingContinueClick || playerReadyForNextRound) {
        console.log('🚫 Click ignorado - ya procesando o ya listo');
        return;
    }
    
    // Marcar como procesando para prevenir clicks múltiples
    isProcessingContinueClick = true;
    
    // ACTUALIZACIÓN INMEDIATA - marcar listo y actualizar UI
    playerReadyForNextRound = true;
    console.log('✅ Marcando jugador como listo para continuar');
    
    // Deshabilitar botón INMEDIATAMENTE para prevenir más clicks
    continueNextRoundBtn.disabled = true;
    continueNextRoundBtn.style.opacity = '0.7';
    continueNextRoundBtn.style.pointerEvents = 'none';
    
    // Actualizar UI inmediatamente
    updateContinueButtonStatus();
    
    // Sincronizar con backend (Firebase o localStorage)
    if (useFirebase && firebaseMultiplayer) {
        console.log('🔄 Sincronizando ready state con Firebase...');
        firebaseMultiplayer.updatePlayerReadyStatus(true)
            .then(() => {
                console.log('✅ Estado sincronizado exitosamente con Firebase');
            })
            .catch(error => {
                console.error('❌ Error sincronizando con Firebase:', error);
                // En caso de error, revertir el estado local
                playerReadyForNextRound = false;
                updateContinueButtonStatus();
                resetContinueButton();
            })
            .finally(() => {
                isProcessingContinueClick = false;
            });
    } else {
        // Fallback con localStorage
        console.log('📁 Usando fallback de localStorage');
        const playerKey = isRoomHost ? 'player1Ready' : 'player2Ready';
        const updateData = {};
        updateData[playerKey] = true;
        updateGlobalRoomState(roomCode, updateData);
        
        // Para localStorage, simular que el otro jugador ve el cambio
        setTimeout(() => {
            checkLocalStorageForUpdates();
            isProcessingContinueClick = false;
        }, 100);
    }
}

// Función auxiliar para resetear el botón cuando hay errores
function resetContinueButton() {
    if (continueNextRoundBtn && !playerReadyForNextRound) {
        continueNextRoundBtn.disabled = false;
        continueNextRoundBtn.style.opacity = '1';
        continueNextRoundBtn.style.pointerEvents = 'auto';
        continueBtnTextEl.textContent = 'Continuar a la Siguiente Ronda';
        console.log('🔓 Botón de continuar resetado');
    }
}

function checkLocalStorageForUpdates() {
    if (!useFirebase) {
        const globalRoomState = getGlobalRoomState();
        const roomState = globalRoomState[roomCode];
        if (roomState) {
            const otherPlayerKey = isRoomHost ? 'player2Ready' : 'player1Ready';
            const otherPlayerReady = roomState[otherPlayerKey] === true;
            
            if (rivalReadyForNextRound !== otherPlayerReady) {
                rivalReadyForNextRound = otherPlayerReady;
                console.log('LocalStorage: Rival ready state cambió a:', rivalReadyForNextRound);
                updateContinueButtonStatus();
            }
        }
    }
}

function startLocalStorageMonitoring() {
    if (!useFirebase && !localStorageCheckInterval) {
        console.log('Iniciando monitoreo de localStorage...');
        localStorageCheckInterval = setInterval(checkLocalStorageForUpdates, 500);
    }
}

function stopLocalStorageMonitoring() {
    if (localStorageCheckInterval) {
        console.log('Deteniendo monitoreo de localStorage...');
        clearInterval(localStorageCheckInterval);
        localStorageCheckInterval = null;
    }
}

// Variable para prevenir múltiples ejecuciones
let isStartingNextRound = false;

function actuallyStartNextRound() {
    // Prevenir ejecución múltiple
    if (isStartingNextRound) {
        console.log('Ya se está iniciando la siguiente ronda, ignorando...');
        return;
    }
    
    isStartingNextRound = true;
    console.log('🚀 Iniciando siguiente ronda...');
    
    // Limpiar flag de countdown activo
    continueNextRoundBtn.dataset.countdownActive = 'false';
    
    // Detener monitoreo de localStorage
    stopLocalStorageMonitoring();
    
    // Solo el HOST coordina el avance de ronda
    if (isRoomHost) {
        console.log('🏠 SOY HOST: Coordinando avance de ronda para todos');
        
        // Incrementar ronda y sincronizar con Firebase
        currentRoundNumber++;
        
        if (useFirebase && firebaseMultiplayer) {
            // Actualizar número de ronda global en Firebase
            const roomRef = window.firebaseRef(firebaseMultiplayer.db, `rooms/${roomCode}/currentRound`);
            window.firebaseSet(roomRef, currentRoundNumber).then(() => {
                console.log('📡 Ronda global actualizada a:', currentRoundNumber);
            });
            
            // Actualizar mi ronda personal
            firebaseMultiplayer.updatePlayerCurrentRound(currentRoundNumber);
        }
    } else {
        console.log('👥 NO SOY HOST: Esperando coordinación del host');
        // Los no-host esperan que se sincronice la ronda desde Firebase
        // Esto se manejará en onPlayersStateChanged cuando detecte el cambio de ronda
    }
    
    // Restablecer TODOS los estados locales para la nueva ronda
    playerFinished = false;
    rivalFinished = false;
    playerGaveUp = false;
    rivalGaveUp = false;
    playerReadyForNextRound = false;
    rivalReadyForNextRound = false;
    isProcessingContinueClick = false; // Importante para permitir nuevo clicks
    
    // Restablecer botón de continuar por completo
    if (continueNextRoundBtn) {
        continueNextRoundBtn.disabled = false;
        continueNextRoundBtn.style.opacity = '1';
        continueNextRoundBtn.style.pointerEvents = 'auto';
        continueNextRoundBtn.style.cursor = 'pointer';
        continueBtnTextEl.textContent = 'Continuar a la Siguiente Ronda';
        continueConfirmationStatusEl.textContent = '0/2';
        continueNextRoundBtn.dataset.countdownActive = 'false';
    }
    
    // Resetear estado en Firebase (pero NO el número de ronda)
    if (useFirebase && firebaseMultiplayer) {
        console.log('🔄 Reseteando estado readyForNext en Firebase...');
        firebaseMultiplayer.updatePlayerReadyStatus(false);
    } else {
        // Resetear en localStorage
        const resetData = {};
        resetData[isRoomHost ? 'player1Ready' : 'player2Ready'] = false;
        resetData[isRoomHost ? 'player2Ready' : 'player1Ready'] = false; // Resetear ambos
        updateGlobalRoomState(roomCode, resetData);
    }
    
    // Actualizar displays antes de configurar nueva ronda
    updateMultiplayerDisplay();
    setupMultiplayerRound();
    
    // Cambiar a la pantalla de juego ANTES de iniciar
    console.log('📺 Cambiando a pantalla de juego...');
    showScreen(gameContainerEl);
    
    // Iniciar automáticamente la nueva ronda después de un pequeño delay
    setTimeout(() => {
        console.log('🎮 Iniciando ronda de juego...');
        startGameRound();
        
        // Resetear flag después de un delay para evitar problemas
        setTimeout(() => {
            isStartingNextRound = false;
            console.log('✅ Flag isStartingNextRound reseteado');
        }, 3000);
    }, 1000);
}

function continueToNextRound() {
    if (gameType === 'online') {
        // En modo multijugador, usar el nuevo sistema de confirmación
        onContinueButtonPressed();
    } else {
        // En singleplayer, mantener comportamiento original
        setupNewRound();
    }
}

function endMultiplayerGame() {
    // Mostrar resumen final multijugador
    showScreen(summarySectionEl);
    singleplayerSummaryEl.classList.add('hidden');
    multiplayerSummaryEl.classList.remove('hidden');
    
    playerFinalScoreEl.textContent = playerScore;
    rivalFinalScoreEl.textContent = rivalScore;
    
    // Determinar resultado y mostrar mensaje detallado
    if (playerScore > rivalScore) {
        multiplayerResultEl.textContent = '🎉 ¡Victoria!';
        multiplayerResultEl.style.color = '#28a745';
        multiplayerResultEl.style.fontSize = '2rem';
        
        const difference = playerScore - rivalScore;
        if (difference === totalRounds) {
            multiplayerFinalMessageEl.textContent = `¡Dominaste completamente! Ganaste todas las ${totalRounds} rondas.`;
        } else if (difference >= totalRounds / 2) {
            multiplayerFinalMessageEl.textContent = `¡Excelente desempeño! Ganaste ${playerScore} de ${totalRounds} rondas, superando a tu rival por ${difference} punto${difference > 1 ? 's' : ''}.`;
        } else {
            multiplayerFinalMessageEl.textContent = `¡Victoria por poco! Ganaste ${playerScore} rondas contra ${rivalScore} de tu rival. ¡Fue una partida muy reñida!`;
        }
    } else if (playerScore < rivalScore) {
        multiplayerResultEl.textContent = '😔 Derrota';
        multiplayerResultEl.style.color = '#dc3545';
        multiplayerResultEl.style.fontSize = '2rem';
        
        const difference = rivalScore - playerScore;
        if (difference === totalRounds) {
            multiplayerFinalMessageEl.textContent = `Tu rival fue imparable. Ganó todas las ${totalRounds} rondas. ¡La próxima vez será tu turno!`;
        } else if (difference >= totalRounds / 2) {
            multiplayerFinalMessageEl.textContent = `Tu rival te superó claramente con ${rivalScore} rondas ganadas contra tus ${playerScore}. ¡Sigue practicando!`;
        } else {
            multiplayerFinalMessageEl.textContent = `¡Estuvo muy cerca! Tu rival ganó por solo ${difference} punto${difference > 1 ? 's' : ''}. La próxima partida puede ser tuya.`;
        }
    } else {
        multiplayerResultEl.textContent = '🤝 ¡Empate!';
        multiplayerResultEl.style.color = '#fd7e14';
        multiplayerResultEl.style.fontSize = '2rem';
        
        if (playerScore === 0) {
            multiplayerFinalMessageEl.textContent = `Ninguno de los dos logró completar una ronda. ¡Ambos necesitan más práctica!`;
        } else if (playerScore === totalRounds) {
            multiplayerFinalMessageEl.textContent = `¡Increíble! Ambos completaron todas las ${totalRounds} rondas. Están perfectamente equilibrados.`;
        } else {
            multiplayerFinalMessageEl.textContent = `Ambos ganaron ${playerScore} ronda${playerScore > 1 ? 's' : ''} de ${totalRounds}. ¡Qué partida tan equilibrada!`;
        }
    }
}

function showSuccessNotification() {
    // Crear notificación temporal
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1000;
        font-weight: 600;
    `;
    notification.textContent = '¡Objetivo alcanzado!';
    
    document.body.appendChild(notification);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function onTimeUp() {
    if (!gameActive) return;
    
    gameActive = false;
    clearInterval(timerId);
    
    if (gameType === 'singleplayer') {
        showScreen(summarySectionEl);
        singleplayerSummaryEl.classList.remove('hidden');
        multiplayerSummaryEl.classList.add('hidden');
        finalScoreEl.textContent = score;
        finalMessageEl.textContent = "¡Se acabó el tiempo!";
    } else {
        // En modo multijugador, si se acaba el tiempo, sincronizar estado
        playerFinished = true;
        
        // Sincronizar con Firebase
        if (useFirebase && firebaseMultiplayer) {
            firebaseMultiplayer.updatePlayerRoundStatus(currentRoundNumber, 'timeUp', null, false);
        } else {
            // Fallback localStorage
            updateGlobalRoomState(roomCode, {
                [`player${isRoomHost ? 1 : 2}RoundStatus`]: {
                    [currentRoundNumber]: {
                        status: 'timeUp',
                        completionTime: null,
                        gaveUp: false
                    }
                }
            });
        }
        
        checkTargetBtn.classList.add('hidden');
        giveUpButton.classList.add('hidden');
        waitingRivalBtn.classList.remove('hidden');
        
        statusMessageEl.textContent = "¡Se acabó el tiempo! Esperando a tu rival...";
        checkRoundEnd();
    }
}

function onNext() {
    if (gameType === 'online') {
        continueToNextRound();
    } else {
        setupNewRound();
    }
}

function onAnother() {
    if (gameType === 'singleplayer') {
        score -= 1;
        if (score < 0) score = 0;
        scoreEl.textContent = score;
        
        // Resetear para nueva selección
        currentRound.startForNextRound = null;
        setupNewRound();
    }
    // En modo multijugador no hay opción "Otro"
}

function onGiveUp() {
    gameActive = false;
    clearInterval(timerId);
    
    if (gameType === 'singleplayer') {
        showScreen(summarySectionEl);
        singleplayerSummaryEl.classList.remove('hidden');
        multiplayerSummaryEl.classList.add('hidden');
        finalScoreEl.textContent = score;
        finalMessageEl.textContent = "¡Has decidido rendirte!";
    } else {
        // En modo multijugador, marcar que se rindió y sincronizar
        playerFinished = true;
        playerGaveUp = true;
        
        // Sincronizar con Firebase
        if (useFirebase && firebaseMultiplayer) {
            firebaseMultiplayer.updatePlayerRoundStatus(currentRoundNumber, 'gaveUp', null, true);
        } else {
            // Fallback localStorage
            updateGlobalRoomState(roomCode, {
                [`player${isRoomHost ? 1 : 2}RoundStatus`]: {
                    [currentRoundNumber]: {
                        status: 'gaveUp',
                        completionTime: null,
                        gaveUp: true
                    }
                }
            });
        }
        
        // Mostrar feedback de rendirse
        checkTargetBtn.classList.add('hidden');
        giveUpButton.classList.add('hidden');
        waitingRivalBtn.classList.remove('hidden');
        waitingRivalBtn.textContent = 'Te has rendido, esperando rival...';
        waitingRivalBtn.style.background = '#ffc107';
        
        statusMessageEl.textContent = "Te has rendido en esta ronda. Esperando a tu rival...";
        
        checkRoundEnd();
    }
}

function onPlayAgain() {
    // Detener monitoreo de localStorage
    stopLocalStorageMonitoring();
    
    // Reset variables generales
    score = 0;
    gameActive = false;
    currentRound = {};
    playerGaveUp = false;
    clearInterval(timerId);
    
    // Limpiar estado global de la sala anterior
    if (roomCode) {
        const globalRoomState = getGlobalRoomState();
        delete globalRoomState[roomCode];
        setGlobalRoomState(globalRoomState);
    }
    
    // Reset variables multijugador
    gameType = 'singleplayer';
    totalRounds = 3;
    currentRoundNumber = 1;
    playerScore = 0;
    rivalScore = 0;
    roomCode = '';
    isRoomHost = false;
    playerFinished = false;
    rivalFinished = false;
    rivalGaveUp = false;
    bothPlayersReady = false;
    waitingForPlayer = false;
    sharedConcepts = null;
    playerReadyForNextRound = false;
    rivalReadyForNextRound = false;
    
    // Reset display
    scoreEl.textContent = 0;
    multiplayerInfoEl.classList.add('hidden');
    
    // Mostrar pantalla inicial
    showScreen(gameTypeSelectionEl);
}

// Función auxiliar para actualizar el display de un concepto
function updateConceptDisplay(concept, nameEl, imgEl, placeholderEl, wikiBtn) {
    nameEl.textContent = concept.name;
    if (concept.image_url && concept.image_url !== "URL_DE_IMAGEN_POR_DEFECTO.jpg") {
        imgEl.src = concept.image_url;
        imgEl.classList.remove('hidden');
        placeholderEl.classList.add('hidden');
    } else {
        imgEl.classList.add('hidden');
        placeholderEl.classList.remove('hidden');
    }
    
    // Configurar el botón de Wikipedia
    if (wikiBtn) {
        wikiBtn.href = concept.wiki_link || '#';
        wikiBtn.style.display = 'inline-flex';
    }
}

// --- Event Listeners ---

// Botones de selección de tipo de juego
singleplayerBtn.addEventListener('click', () => selectGameType('singleplayer'));
onlineBtn.addEventListener('click', async () => await selectGameType('online'));

// Botones de modo singleplayer
singleEasyButton.addEventListener('click', () => selectSingleplayerMode('easy'));
singleNormalButton.addEventListener('click', () => selectSingleplayerMode('normal'));
singleHardButton.addEventListener('click', () => selectSingleplayerMode('hard'));
singleEndlessButton.addEventListener('click', () => selectSingleplayerMode('endless'));

// Botones de modo online
onlineEasyButton.addEventListener('click', () => selectOnlineMode('easy'));
onlineNormalButton.addEventListener('click', () => selectOnlineMode('normal'));
onlineHardButton.addEventListener('click', () => selectOnlineMode('hard'));
onlineEndlessButton.addEventListener('click', () => selectOnlineMode('endless'));

// Botones de rondas
rounds3Button.addEventListener('click', () => selectRounds(3));
rounds5Button.addEventListener('click', () => selectRounds(5));

// Botones de sala
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);
joinRoomConfirmBtn.addEventListener('click', confirmJoinRoom);

// Botones de navegación (volver)
backFromSingleBtn.addEventListener('click', () => showScreen(gameTypeSelectionEl));
backFromOnlineBtn.addEventListener('click', () => showScreen(roomSelectionEl)); // Volver a crear/unirse
backFromRoundsBtn.addEventListener('click', () => showScreen(onlineModeSelectionEl));
backFromRoomBtn.addEventListener('click', () => showScreen(gameTypeSelectionEl)); // Volver a single/online
backFromJoinBtn.addEventListener('click', () => showScreen(roomSelectionEl));

// Botones del juego
startGameBtn.addEventListener('click', startGameRound);
checkTargetBtn.addEventListener('click', () => {
    console.log('Botón manual presionado - verificando objetivo...');
    onTargetReached();
});
nextButton.addEventListener('click', onNext);
anotherButton.addEventListener('click', onAnother);
giveUpButton.addEventListener('click', onGiveUp);
playAgainButton.addEventListener('click', onPlayAgain);
continueMultiplayerBtn.addEventListener('click', continueToNextRound);
continueNextRoundBtn.addEventListener('click', continueToNextRound);

// Evento para el input de código de sala
roomCodeInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        confirmJoinRoom();
    }
});

// Convertir input a mayúsculas automáticamente
roomCodeInputEl.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
});

// Botón para copiar código de sala
copyRoomCodeBtn.addEventListener('click', () => {
    const code = roomCodeDisplayEl.textContent;
    navigator.clipboard.writeText(code).then(() => {
        copyRoomCodeBtn.textContent = '✓';
        setTimeout(() => {
            copyRoomCodeBtn.textContent = '📋';
        }, 2000);
    }).catch(() => {
        // Fallback para navegadores sin soporte de clipboard
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        copyRoomCodeBtn.textContent = '✓';
        setTimeout(() => {
            copyRoomCodeBtn.textContent = '📋';
        }, 2000);
    });
});

// --- Inicio del Juego ---
window.onload = loadConcepts;
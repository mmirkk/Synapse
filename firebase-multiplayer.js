// Firebase Realtime Multiplayer System for WikiGame V2

class FirebaseMultiplayer {
    constructor() {
        this.db = null;
        this.currentRoomRef = null;
        this.roomCode = '';
        this.playerId = this.generatePlayerId();
        this.isHost = false;
        this.listeners = [];
    }

    // Inicializar Firebase cuando esté disponible
    init() {
        if (typeof window.firebaseDb === 'undefined') {
            console.log('Firebase no disponible, usando sistema local');
            return false;
        }
        this.db = window.firebaseDb;
        console.log('Firebase inicializado correctamente');
        return true;
    }

    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Crear una nueva sala
    async createRoom(gameMode, totalRounds) {
        if (!this.db) return null;

        this.roomCode = this.generateRoomCode();
        this.isHost = true;

        const roomData = {
            hostId: this.playerId,
            gameMode: gameMode,
            totalRounds: totalRounds,
            players: {
                [this.playerId]: {
                    id: this.playerId,
                    isHost: true,
                    joinedAt: window.firebaseServerTimestamp(),
                    status: 'waiting'
                }
            },
            gameState: {
                status: 'waiting', // waiting, playing, finished
                currentRound: 1,
                sharedConcepts: null
            },
            createdAt: window.firebaseServerTimestamp()
        };

        try {
            const roomRef = window.firebaseRef(this.db, `rooms/${this.roomCode}`);
            await window.firebaseSet(roomRef, roomData);
            
            this.currentRoomRef = roomRef;
            this.setupRoomListeners();
            
            console.log(`Sala Firebase creada: ${this.roomCode}`);
            return this.roomCode;
        } catch (error) {
            console.error('Error creando sala:', error);
            return null;
        }
    }

    // Unirse a una sala existente
    async joinRoom(roomCode) {
        if (!this.db) return false;

        try {
            const roomRef = window.firebaseRef(this.db, `rooms/${roomCode}`);
            const snapshot = await window.firebaseGet(roomRef);

            if (!snapshot.exists()) {
                console.log('Sala no encontrada');
                return false;
            }

            const roomData = snapshot.val();
            const playerCount = Object.keys(roomData.players || {}).length;

            if (playerCount >= 2) {
                console.log('Sala llena');
                return false;
            }

            // Unirse a la sala
            this.roomCode = roomCode;
            this.isHost = false;
            this.currentRoomRef = roomRef;

            const playerRef = window.firebaseRef(this.db, `rooms/${roomCode}/players/${this.playerId}`);
            await window.firebaseSet(playerRef, {
                id: this.playerId,
                isHost: false,
                joinedAt: window.firebaseServerTimestamp(),
                status: 'ready'
            });

            this.setupRoomListeners();
            
            console.log(`Unido a sala Firebase: ${roomCode}`);
            return true;
        } catch (error) {
            console.error('Error uniéndose a sala:', error);
            return false;
        }
    }

    // Configurar listeners para cambios en tiempo real
    setupRoomListeners() {
        if (!this.currentRoomRef) return;

        // Listener para cambios en jugadores
        const playersRef = window.firebaseRef(this.db, `rooms/${this.roomCode}/players`);
        const playersListener = window.firebaseOnValue(playersRef, (snapshot) => {
            if (snapshot.exists()) {
                const players = snapshot.val();
                const playerCount = Object.keys(players).length;
                
                console.log(`Jugadores en sala: ${playerCount}/2`);
                
                if (typeof window.onRoomPlayersChanged === 'function') {
                    window.onRoomPlayersChanged(players, playerCount);
                }

                // Notificar cambios en el estado de los jugadores
                if (typeof window.onPlayersStateChanged === 'function') {
                    window.onPlayersStateChanged(players);
                }
            }
        });

        // Listener ESPECÍFICO para estado readyForNext - NUEVO
        const readyStatusRef = window.firebaseRef(this.db, `rooms/${this.roomCode}/players`);
        const readyListener = window.firebaseOnValue(readyStatusRef, (snapshot) => {
            if (snapshot.exists()) {
                const players = snapshot.val();
                const playersArray = Object.values(players);
                
                // Buscar el estado de readyForNext de ambos jugadores
                let myReady = false;
                let rivalReady = false;
                
                playersArray.forEach(player => {
                    if (player.id === this.playerId) {
                        myReady = Boolean(player.readyForNext);
                    } else {
                        rivalReady = Boolean(player.readyForNext);
                    }
                });
                
                console.log('[Firebase] Estados readyForNext:', {
                    yo: myReady,
                    rival: rivalReady,
                    timestamp: new Date().toISOString()
                });
                
                // Notificar cambio específico de readyForNext si hay cambios
                if (typeof window.onReadyStatusChanged === 'function') {
                    window.onReadyStatusChanged(myReady, rivalReady);
                }
            }
        });

        // Listener para ronda global
        const currentRoundRef = window.firebaseRef(this.db, `rooms/${this.roomCode}/currentRound`);
        const roundListener = window.firebaseOnValue(currentRoundRef, (snapshot) => {
            if (snapshot.exists()) {
                const roundNumber = snapshot.val();
                console.log('[Firebase] Ronda global cambió a:', roundNumber);
                
                if (typeof window.onRoomRoundChanged === 'function') {
                    window.onRoomRoundChanged(roundNumber);
                }
            }
        });

        // Listener para estado del juego
        const gameStateRef = window.firebaseRef(this.db, `rooms/${this.roomCode}/gameState`);
        const gameStateListener = window.firebaseOnValue(gameStateRef, (snapshot) => {
            if (snapshot.exists()) {
                const gameState = snapshot.val();
                
                if (typeof window.onGameStateChanged === 'function') {
                    window.onGameStateChanged(gameState);
                }
            }
        });

        this.listeners.push(playersListener, readyListener, roundListener, gameStateListener);
    }

    // Actualizar estado del juego
    async updateGameState(updates) {
        if (!this.currentRoomRef) return;

        try {
            const gameStateRef = window.firebaseRef(this.db, `rooms/${this.roomCode}/gameState`);
            const snapshot = await window.firebaseGet(gameStateRef);
            const currentState = snapshot.val() || {};
            
            const newState = { ...currentState, ...updates };
            await window.firebaseSet(gameStateRef, newState);
        } catch (error) {
            console.error('Error actualizando estado del juego:', error);
        }
    }

    // Obtener datos de la sala
    async getRoomData() {
        if (!this.currentRoomRef) return null;

        try {
            const snapshot = await window.firebaseGet(this.currentRoomRef);
            return snapshot.exists() ? snapshot.val() : null;
        } catch (error) {
            console.error('Error obteniendo datos de sala:', error);
            return null;
        }
    }

    // Limpiar listeners y salir de la sala
    leaveRoom() {
        // Limpiar listeners
        this.listeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.listeners = [];

        // Remover jugador de la sala
        if (this.currentRoomRef && this.playerId) {
            const playerRef = window.firebaseRef(this.db, `rooms/${this.roomCode}/players/${this.playerId}`);
            window.firebaseRemove(playerRef);
        }

        // Si somos el host, eliminar toda la sala
        if (this.isHost && this.currentRoomRef) {
            window.firebaseRemove(this.currentRoomRef);
        }

        // Reset
        this.currentRoomRef = null;
        this.roomCode = '';
        this.isHost = false;
    }

    // Establecer conceptos compartidos (solo el host)
    async setSharedConcepts(concepts) {
        if (!this.isHost || !this.currentRoomRef) return;

        try {
            const conceptsRef = window.firebaseRef(this.db, `rooms/${this.roomCode}/gameState/sharedConcepts`);
            await window.firebaseSet(conceptsRef, concepts);
        } catch (error) {
            console.error('Error estableciendo conceptos compartidos:', error);
        }
    }

    // Actualizar puntuación del jugador
    async updatePlayerScore(score) {
        if (!this.currentRoomRef) return;

        try {
            const scoreRef = window.firebaseRef(this.db, `rooms/${this.roomCode}/players/${this.playerId}/score`);
            await window.firebaseSet(scoreRef, score);
        } catch (error) {
            console.error('Error actualizando puntuación:', error);
        }
    }

    // Actualizar estado del jugador para la ronda actual
    async updatePlayerRoundStatus(roundNumber, status, completionTime = null, gaveUp = false) {
        if (!this.currentRoomRef) return;

        try {
            const statusRef = window.firebaseRef(this.db, `rooms/${this.roomCode}/players/${this.playerId}/roundStatus/${roundNumber}`);
            await window.firebaseSet(statusRef, {
                status: status, // 'playing', 'completed', 'gaveUp', 'timeUp'
                completionTime: completionTime,
                gaveUp: gaveUp,
                timestamp: window.firebaseServerTimestamp()
            });
        } catch (error) {
            console.error('Error actualizando estado de ronda:', error);
        }
    }

    // Actualizar estado de listo para continuar
    async updatePlayerReadyStatus(ready) {
        if (!this.currentRoomRef) return;

        try {
            console.log(`[Firebase] Actualizando readyForNext del jugador ${this.playerId} a:`, ready);
            const readyRef = window.firebaseRef(this.db, `rooms/${this.roomCode}/players/${this.playerId}/readyForNext`);
            await window.firebaseSet(readyRef, ready);
            console.log(`[Firebase] Estado readyForNext actualizado exitosamente a:`, ready);
        } catch (error) {
            console.error('Error actualizando estado de listo:', error);
        }
    }

    // Actualizar número de ronda actual del jugador
    async updatePlayerCurrentRound(roundNumber) {
        if (!this.currentRoomRef) return;

        try {
            console.log(`[Firebase] Actualizando ronda actual del jugador ${this.playerId} a:`, roundNumber);
            const roundRef = window.firebaseRef(this.db, `rooms/${this.roomCode}/players/${this.playerId}/currentRound`);
            await window.firebaseSet(roundRef, roundNumber);
            console.log(`[Firebase] Ronda actual actualizada exitosamente a:`, roundNumber);
        } catch (error) {
            console.error('Error actualizando ronda actual:', error);
        }
    }

    // Cargar conceptos compartidos de la sala
    async loadSharedConcepts() {
        if (!this.currentRoomRef) return null;

        try {
            console.log('[Firebase] Cargando conceptos compartidos...');
            const conceptsRef = window.firebaseRef(this.db, `rooms/${this.roomCode}/sharedConcepts`);
            const snapshot = await window.firebaseGet(conceptsRef);
            const concepts = snapshot.val();
            console.log('[Firebase] Conceptos cargados:', concepts);
            return concepts;
        } catch (error) {
            console.error('Error cargando conceptos compartidos:', error);
            return null;
        }
    }
}

// Instancia global
window.firebaseMultiplayer = new FirebaseMultiplayer();
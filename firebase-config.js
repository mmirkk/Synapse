// Configuración de Firebase para Synapse WikiGame
// INSTRUCCIONES DE CONFIGURACIÓN:

// 1. Ve a https://console.firebase.google.com
// 2. Crea un nuevo proyecto
// 3. Habilita Realtime Database
// 4. En Configuración del proyecto > General, encuentra la configuración web
// 5. Reemplaza la configuración de ejemplo a continuación con tu configuración real
// 6. Descomenta las líneas de configuración

/*
// Configuración de Firebase - REEMPLAZA CON TU CONFIGURACIÓN
const firebaseConfig = {
    apiKey: "tu-api-key",
    authDomain: "tu-proyecto.firebaseapp.com",
    databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com/",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456"
};

// Inicializar Firebase
try {
    // Verificar si Firebase está disponible
    if (typeof firebase !== 'undefined') {
        // Inicializar Firebase
        firebase.initializeApp(firebaseConfig);
        
        // Obtener referencia a la base de datos
        window.firebaseDb = firebase.database();
        
        // Funciones de Firebase para usar en el juego
        window.firebaseRef = firebase.database.ref;
        window.firebaseSet = firebase.database.ServerValue.TIMESTAMP;
        window.firebaseGet = (ref) => ref.once('value');
        window.firebaseOnValue = (ref, callback) => ref.on('value', callback);
        window.firebaseRemove = (ref) => ref.remove();
        window.firebaseServerTimestamp = firebase.database.ServerValue.TIMESTAMP;
        
        console.log('🔥 Firebase inicializado correctamente');
    } else {
        console.log('⚠️ Firebase no disponible, usando sistema local');
    }
} catch (error) {
    console.error('❌ Error inicializando Firebase:', error);
    console.log('📱 Continuando con sistema local');
}
*/

// PARA DESARROLLO LOCAL SIN FIREBASE:
// El juego funciona sin Firebase usando localStorage como respaldo
console.log('📱 Modo desarrollo: usando sistema local sin Firebase');
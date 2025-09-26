# Synapse - WikiGame Multijugador

Un juego interactivo donde los jugadores navegan de un concepto a otro a través de Wikipedia, poniendo a prueba su conocimiento y habilidades de navegación web.

## 🎮 Características

### Modos de Juego

- **Singleplayer**: Juega solo con diferentes niveles de dificultad
- **Online Multijugador**: Compite contra otro jugador en tiempo real

### Niveles de Dificultad

- **Fácil**: 6 minutos por partida
- **Normal**: 4 minutos por partida
- **Difícil**: 2 minutos por partida
- **Endless**: Sin límite de tiempo

### Características Multijugador

- **Salas privadas**: Crea o únete a salas con códigos de 6 caracteres
- **Partidas de 3 o 5 rondas**: Elige la duración de tu partida
- **Sistema de confirmación**: Ambos jugadores deben confirmar para avanzar rondas
- **Cambio de conceptos**: Opción "OTRO" para cambiar conceptos por consenso
- **Sincronización en tiempo real**: Powered by Firebase Realtime Database

## 🚀 Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Firebase Realtime Database
- **Deployment**: Vercel
- **Wikipedia API**: Para cargar contenido dinámico

## 🎯 Cómo Jugar

### Singleplayer

1. Selecciona un modo de dificultad
2. Haz clic en "Comenzar"
3. Navega desde el concepto inicial hasta el objetivo usando solo los enlaces de Wikipedia
4. ¡Completa tantos objetivos como puedas antes de que se acabe el tiempo!

### Multijugador Online

1. Selecciona "Online" y elige dificultad y número de rondas
2. Crea una sala (recibirás un código) o únete con un código existente
3. Espera a que se conecte el segundo jugador
4. ¡Compite para ver quién completa más rondas!

### Controles

- **"¡Llegué al Objetivo!"**: Confirma manualmente que alcanzaste el objetivo
- **"Otro"**: (Solo online) Solicita cambiar los conceptos de la ronda actual
- **"Me Rindo"**: Termina la ronda actual
- **"Siguiente"**: Continúa a la siguiente ronda (singleplayer)

## 🛠️ Desarrollo Local

### Prerrequisitos

- Node.js 14 o superior
- Navegador web moderno

### Instalación

```bash
# Clona el repositorio
git clone https://github.com/tu-usuario/synapse-wikigame.git

# Navega al directorio
cd synapse-wikigame

# Instala dependencias
npm install

# Inicia servidor de desarrollo
npm run dev
```

El juego estará disponible en `http://localhost:3000`

### Configuración de Firebase (Opcional)

Para usar las características multijugador:

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilita Realtime Database
3. Configura las reglas de seguridad
4. Agrega tu configuración de Firebase al proyecto

## 📁 Estructura del Proyecto

```
synapse-wikigame/
├── index.html              # Página principal
├── styles.css              # Estilos globales
├── app.js                  # Lógica principal del juego
├── firebase-multiplayer.js # Sistema multijugador
├── concepts.json           # Base de datos de conceptos
├── package.json            # Dependencias y scripts
├── vercel.json             # Configuración de deployment
└── README.md               # Documentación
```

## 🎨 Características Técnicas

### Sistema de Detección

- **Detección automática**: El juego detecta automáticamente cuando llegas al objetivo
- **Confirmación manual**: Botón de respaldo para casos donde la detección automática falla
- **Múltiples métodos**: URL monitoring, title checking, iframe navigation tracking

### Sincronización Multijugador

- **Firebase Realtime Database**: Sincronización en tiempo real entre jugadores
- **LocalStorage Fallback**: Sistema de respaldo cuando Firebase no está disponible
- **Estados persistentes**: Los juegos se mantienen activos entre recargas de página

### Optimizaciones

- **Lazy loading**: Los conceptos se cargan bajo demanda
- **Responsive design**: Funciona en dispositivos móviles y desktop
- **Error handling**: Manejo robusto de errores de red y Firebase

## 🚀 Deploy en Vercel

### Opción 1: Deploy Automático

1. Haz fork de este repositorio
2. Conecta tu cuenta de GitHub con Vercel
3. Importa el proyecto en Vercel
4. ¡Deploy automático!

### Opción 2: Vercel CLI

```bash
# Instala Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## 🤝 Contribuir

Las contribuciones son bienvenidas. Para cambios importantes:

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 🎯 Roadmap

### Próximas Características

- [ ] Modo torneos
- [ ] Estadísticas de jugador
- [ ] Ranking global
- [ ] Más idiomas de Wikipedia
- [ ] Modo cooperativo
- [ ] Temas específicos

### Mejoras Técnicas

- [ ] PWA (Progressive Web App)
- [ ] Offline mode
- [ ] Optimización de rendimiento
- [ ] Tests unitarios

## 📞 Soporte

Si encuentras algún bug o tienes sugerencias, por favor:

- Abre un issue en GitHub
- Describe el problema detalladamente
- Incluye pasos para reproducir el error

---

¡Disfruta jugando Synapse WikiGame! 🧠✨

# 🚀 Guía de Deploy para GitHub y Vercel

## 📋 Preparación del Repositorio GitHub

### 1. Inicializar Git

```bash
cd synapse-wikigame
git init
git add .
git commit -m "Initial commit: Synapse WikiGame with multiplayer support"
```

### 2. Crear Repositorio en GitHub

1. Ve a https://github.com/new
2. Nombra el repositorio: `synapse-wikigame`
3. Hazlo público
4. NO inicialices con README (ya tienes uno)
5. Haz clic en "Create repository"

### 3. Conectar y Subir

```bash
git branch -M main
git remote add origin https://github.com/TU-USUARIO/synapse-wikigame.git
git push -u origin main
```

## 🌐 Deploy en Vercel

### Opción 1: Deploy Automático (Recomendado)

1. **Ir a Vercel**

   - Ve a https://vercel.com
   - Crea cuenta o inicia sesión
   - Conecta con tu cuenta de GitHub

2. **Importar Proyecto**

   - Haz clic en "New Project"
   - Selecciona tu repositorio `synapse-wikigame`
   - Haz clic en "Import"

3. **Configuración**

   - Framework Preset: Selecciona "Other"
   - Root Directory: Deja por defecto (/)
   - Build Command: Deja vacío
   - Output Directory: Deja vacío
   - Install Command: `npm install` (opcional)

4. **Deploy**
   - Haz clic en "Deploy"
   - ¡Espera 1-2 minutos!
   - Tu juego estará disponible en: `https://synapse-wikigame.vercel.app`

### Opción 2: Vercel CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Login a Vercel
vercel login

# Deploy
vercel

# Para production deploy
vercel --prod
```

## 🔥 Configuración Firebase (Opcional)

### Para habilitar multijugador online:

1. **Crear Proyecto Firebase**

   - Ve a https://console.firebase.google.com
   - Crea nuevo proyecto: "synapse-wikigame"
   - Habilita Google Analytics (opcional)

2. **Configurar Realtime Database**

   - Ve a "Realtime Database"
   - Haz clic en "Crear base de datos"
   - Selecciona ubicación (us-central1 recomendado)
   - Inicia en modo de prueba

3. **Configurar Reglas de Seguridad**

   ```json
   {
     "rules": {
       "rooms": {
         "$roomId": {
           ".read": true,
           ".write": true,
           ".indexOn": ["createdAt"]
         }
       }
     }
   }
   ```

4. **Obtener Configuración Web**

   - Ve a Configuración del proyecto (⚙️)
   - Scroll a "Tus apps"
   - Haz clic en "Web" (</>)
   - Registra app: "synapse-wikigame-web"
   - Copia la configuración

5. **Agregar Firebase al Proyecto**
   - Edita `firebase-config.js`
   - Descomenta y reemplaza la configuración
   - Commit y push los cambios
   - Vercel redesplegará automáticamente

## 📝 URLs Importantes

- **GitHub Repo**: `https://github.com/TU-USUARIO/synapse-wikigame`
- **Vercel Dashboard**: `https://vercel.com/dashboard`
- **Firebase Console**: `https://console.firebase.google.com`
- **Tu App Live**: `https://synapse-wikigame.vercel.app`

## 🔧 Comandos Útiles

```bash
# Ver status del repositorio
git status

# Agregar cambios
git add .
git commit -m "Descripción del cambio"
git push

# Ver logs de Vercel
vercel logs

# Ver dominios de Vercel
vercel domains

# Ver información del proyecto
vercel inspect
```

## 🐛 Solución de Problemas

### Si el juego no carga:

1. Verifica la consola del navegador (F12)
2. Revisa los logs en Vercel Dashboard
3. Asegúrate de que todos los archivos estén committeados

### Si multijugador no funciona:

1. Verifica que Firebase esté configurado correctamente
2. Revisa las reglas de Firebase Database
3. El juego funcionará en modo local (localStorage) como fallback

### Si hay errores de CORS:

- Los archivos están configurados para funcionar desde cualquier dominio
- Vercel maneja CORS automáticamente

## ✅ Checklist Pre-Deploy

- [ ] Todos los archivos están committeados
- [ ] README.md está completo
- [ ] package.json tiene información correcta
- [ ] vercel.json está configurado
- [ ] .gitignore excluye archivos innecesarios
- [ ] Firebase config está preparado (opcional)
- [ ] El juego funciona localmente

¡Tu juego estará listo para el mundo! 🌍🎮

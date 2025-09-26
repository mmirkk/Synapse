# Desarrollo Local

## Instalación rápida

```bash
npm install -g serve
serve -s . -p 3000
```

## Con Firebase (opcional)

1. Edita `firebase-config.js`
2. Descomenta y configura con tus credenciales
3. Incluye el script en `index.html`:

```html
<script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js"></script>
<script src="firebase-config.js"></script>
```

## Testing

- Abre dos ventanas/pestañas para probar multijugador local
- Usa DevTools -> Application -> Local Storage para ver datos guardados
- Usa DevTools -> Console para ver logs detallados del juego

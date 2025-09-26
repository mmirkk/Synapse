#!/bin/bash
# Script de deploy rápido para Synapse WikiGame

echo "🚀 Preparando deploy de Synapse WikiGame..."

# Verificar que estamos en el directorio correcto
if [ ! -f "index.html" ]; then
    echo "❌ Error: No se encontró index.html. Asegúrate de estar en el directorio del proyecto."
    exit 1
fi

# Verificar git
if [ ! -d ".git" ]; then
    echo "📝 Inicializando repositorio Git..."
    git init
fi

# Agregar todos los archivos
echo "📁 Agregando archivos al repositorio..."
git add .

# Commit
echo "💾 Creando commit..."
read -p "Mensaje de commit (presiona Enter para usar mensaje por defecto): " commit_msg
if [ -z "$commit_msg" ]; then
    commit_msg="Update: Synapse WikiGame improvements"
fi
git commit -m "$commit_msg"

# Verificar si ya hay remote origin
if ! git remote get-url origin &>/dev/null; then
    echo "🔗 Necesitas configurar el remote origin."
    echo "Crea un repositorio en GitHub y luego ejecuta:"
    echo "git remote add origin https://github.com/TU-USUARIO/synapse-wikigame.git"
    echo "git branch -M main"
    echo "git push -u origin main"
else
    echo "📤 Subiendo cambios a GitHub..."
    git push
fi

echo "✅ ¡Listo! Tu código está en GitHub."
echo "🌐 Para deploy en Vercel:"
echo "   1. Ve a https://vercel.com"
echo "   2. Import project desde tu GitHub"
echo "   3. ¡Deploy automático!"

echo ""
echo "📋 URLs importantes:"
echo "   - GitHub: Revisa tu repositorio"
echo "   - Vercel: https://vercel.com/dashboard"
echo "   - Juego local: http://localhost:3000 (con 'serve -s .')"
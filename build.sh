#!/usr/bin/env bash
# =============================================================================
# build.sh — Render Build Script لـ "مدارس ومعاهد نمبر ون"
# =============================================================================
# يُشغَّل هذا الملف مرة واحدة في كل نشر (deploy) قبل بدء الخادم.
# في Render: ضع هذا المسار كـ Build Command:  ./build.sh
# =============================================================================

set -o errexit   # أوقف عند أي خطأ
set -o nounset   # أوقف عند استخدام متغير غير معرّف
set -o pipefail  # أوقف عند فشل أي أمر في pipeline

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🐍 Step 1: Installing Python dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pip install --upgrade pip
pip install -r requirements.txt

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📦 Checking Node.js / npm availability"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
node --version
npm --version

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ⚛️  Step 2: Building React frontend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd frontend
npm ci                # install exact versions from package-lock.json
npm run build         # outputs to frontend/dist/
cd ..

echo "  ✅ React build complete. Contents of frontend/dist/:"
ls -la frontend/dist/

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📦 Step 3: Collecting Django static files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
python manage.py collectstatic --noinput

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🗄️  Step 4: Running database migrations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
python manage.py migrate --noinput

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Build complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

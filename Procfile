# Procfile — تعريف عملية الإنتاج
# يُستخدم إذا لم تُستخدم render.yaml (أو Heroku)
# في Render: يمكن نسخ هذا الأمر مباشرةً في حقل "Start Command"
web: gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 6 --timeout 120 --log-level info

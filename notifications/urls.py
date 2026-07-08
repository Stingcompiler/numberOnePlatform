from django.urls import path
from . import views

app_name = 'notifications'

urlpatterns = [
    path('', views.NotificationListView.as_view(), name='notification-list'),
    path('register-token/', views.register_push_token, name='register-token'),
    path('count/', views.unread_count, name='unread-count'),
    path('read-all/', views.mark_all_as_read, name='mark-all-read'),
    path('<int:pk>/read/', views.mark_as_read, name='mark-read'),
]

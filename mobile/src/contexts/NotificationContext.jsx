import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import notificationService from '../services/notificationService';
import { useAuth } from './AuthContext';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    if (isAuthenticated) {
      // 1. Setup push token
      setupPushNotifications();
      // 2. Load notifications
      loadNotifications();
      // 3. Load unread count
      loadUnreadCount();
      
      // 4. Set up incoming notification listeners
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        // Notification received while app is open
        console.log('Received notification in foreground:', notification);
        loadNotifications();
        loadUnreadCount();
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        // User tapped notification
        const data = response.notification.request.content.data;
        handleNotificationTap(data);
      });

    } else {
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      if (notificationListener.current) Notifications.removeNotificationSubscription(notificationListener.current);
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [isAuthenticated]);

  const setupPushNotifications = async () => {
    try {
      const token = await notificationService.registerForPushNotificationsAsync();
      if (token) {
        await notificationService.syncPushToken(token);
      }
    } catch (e) {
      console.warn('Push notification setup failed:', e);
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications(1);
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);
      setNotifications(list);
    } catch (e) {
      console.warn('Failed to load notifications', e);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const data = await notificationService.getUnreadCount();
      if (data && typeof data.count === 'number') {
        setUnreadCount(data.count);
      }
    } catch (e) {
      console.warn('Failed to load unread count', e);
    }
  };

  const markAsRead = async (id) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    try {
      await notificationService.markAsRead(id);
    } catch (e) {
      console.warn('Failed to mark notification as read', e);
      // Revert optimistic update
      loadNotifications();
      loadUnreadCount();
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    
    try {
      await notificationService.markAllAsRead();
    } catch (e) {
      console.warn('Failed to mark all as read', e);
      loadNotifications();
      loadUnreadCount();
    }
  };

  const handleNotificationTap = (data) => {
    if (!data) return;
    
    // Example Deep Linking Logic based on your models
    if (data.type === 'lecture') {
      router.push(`/courses/lesson/${data.related_object_id}`);
    } else if (data.type === 'exam') {
      router.push(`/exams/${data.related_object_id}`);
    } else if (data.type === 'live_podcast') {
      router.push(`/courses/${data.related_object_id}`);
    }
    // Add more types as needed
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        loading,
        markAsRead,
        markAllAsRead,
        loadNotifications,
        unreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
export default NotificationContext;

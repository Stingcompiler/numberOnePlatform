import React, { createContext, useContext, useState, useEffect } from 'react';
import notificationService from '../services/notificationService';
import { useAuth } from './AuthContext';
import * as SecureStore from 'expo-secure-store';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState([]);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
      loadReadState();
    } else {
      setNotifications([]);
    }
  }, [isAuthenticated]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications();
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);
      setNotifications(list);
    } catch (e) {
      console.warn('Failed to load notifications', e);
    } finally {
      setLoading(false);
    }
  };

  const loadReadState = async () => {
    try {
      const saved = await SecureStore.getItemAsync('read_notification_ids');
      if (saved) {
        setReadIds(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load notification read state', e);
    }
  };

  const markAsRead = async (id) => {
    if (readIds.includes(id)) return;
    const newRead = [...readIds, id];
    setReadIds(newRead);
    try {
      await SecureStore.setItemAsync('read_notification_ids', JSON.stringify(newRead));
    } catch (e) {
      console.warn('Failed to save notification read state', e);
    }
  };

  const getUnreadCount = () => {
    return notifications.filter(n => !readIds.includes(n.id)).length;
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        loading,
        readIds,
        markAsRead,
        loadNotifications,
        unreadCount: getUnreadCount(),
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
export default NotificationContext;

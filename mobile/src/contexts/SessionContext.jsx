import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDeviceIdentifier, getDeviceMetadata } from '../utils/deviceInfo';

const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
  const [deviceId, setDeviceId] = useState(null);
  const [deviceMeta, setDeviceMeta] = useState(null);

  useEffect(() => {
    async function initSession() {
      const id = await getDeviceIdentifier();
      setDeviceId(id);
      setDeviceMeta(getDeviceMetadata());
    }
    initSession();
  }, []);

  return (
    <SessionContext.Provider value={{ deviceId, deviceMeta }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
export default SessionContext;

import React, { useEffect } from 'react';

interface AuthListenerProps {
  children: React.ReactNode;
}

/**
 * Component that listens for authentication events from the main process
 * and triggers reauthentication when needed
 */
const AuthListener: React.FC<AuthListenerProps> = ({ children }) => {
  useEffect(() => {
    // Set up listeners for authentication events
    const setupAuthListeners = () => {
      // Listen for Spotify authentication events
      window.electron.receive('spotify-not-authorized', async () => {
        console.log('Spotify not authorized, triggering authentication');
        try {
          await window.electron.invoke('authorize-service', 'spotify');
        } catch (error) {
          console.error('Failed to authenticate with Spotify:', error);
        }
      });

      // Listen for Google authentication events
      window.electron.receive('google-not-authorized', async () => {
        console.log('Google not authorized, triggering authentication');
        try {
          await window.electron.invoke('authorize-service', 'google');
        } catch (error) {
          console.error('Failed to authenticate with Google:', error);
        }
      });
    };

    setupAuthListeners();

    // Clean up listeners when component unmounts
    return () => {
      window.electron.removeListener('spotify-not-authorized');
      window.electron.removeListener('google-not-authorized');
    };
  }, []);

  return <>{children}</>;
};

export default AuthListener; 
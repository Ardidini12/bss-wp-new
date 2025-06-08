import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import QRCode from 'qrcode';

const WhatsAppConnect = () => {
  const { currentUser } = useAuth();
  const { colors } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('checking');
  const [qrCode, setQrCode] = useState(null);
  const [whatsAppInfo, setWhatsAppInfo] = useState(null);
  const [error, setError] = useState(null);
  
  // Ref to track status check interval
  const statusCheckIntervalRef = useRef(null);
  
  // Check WhatsApp connection status
  const checkStatus = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      console.log('Settings page: Checking WhatsApp status...');
      const response = await window.electronAPI.getWhatsAppStatus(currentUser.id);
      
      if (response.success) {
        if (response.connected) {
          setStatus('connected');
          // If we're connected but don't have info, try to trigger a ready event
          if (!whatsAppInfo) {
            console.log('Settings page: Connected but no WhatsApp info');
            await window.electronAPI.initWhatsApp(currentUser.id);
          }
        } else if (response.hasSession) {
          setStatus('session-exists');
          // Try to initialize WhatsApp with existing session
          await window.electronAPI.initWhatsApp(currentUser.id);
        } else {
          setStatus('disconnected');
          // Initialize new session
          await window.electronAPI.initWhatsApp(currentUser.id);
        }
      } else {
        setError(response.error || 'Failed to get WhatsApp status');
        setStatus('error');
      }
    } catch (err) {
      console.error('Error checking WhatsApp status:', err);
      setError(err.message || 'An error occurred');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };
  
  // Initialize WhatsApp connection
  const initWhatsApp = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setStatus('connecting');
      
      const response = await window.electronAPI.initWhatsApp(currentUser.id);
      
      if (!response.success) {
        setError(response.error || 'Failed to initialize WhatsApp');
        setStatus('error');
      }
    } catch (err) {
      console.error('Error initializing WhatsApp:', err);
      setError(err.message || 'An error occurred');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };
  
  // Logout from WhatsApp
  const logoutWhatsApp = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const response = await window.electronAPI.logoutWhatsApp(currentUser.id);
      
      if (response.success) {
        setStatus('disconnected');
        setWhatsAppInfo(null);
        // Reinitialize to show QR code
        await initWhatsApp();
      } else {
        setError(response.error || 'Failed to logout from WhatsApp');
      }
    } catch (err) {
      console.error('Error logging out from WhatsApp:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  // Set up event listeners
  useEffect(() => {
    if (!currentUser) return;
    
    // QR code listener
    const handleQrCode = (data) => {
      if (data.userId === currentUser.id) {
        console.log('Settings page: QR code received');
        setStatus('qr-ready');
        setQrCode(data.qr);
        
        // Generate QR code in the canvas
        setTimeout(() => {
          const qrCanvas = document.getElementById('whatsapp-qr-canvas');
          if (qrCanvas) {
            QRCode.toCanvas(qrCanvas, data.qr, {
              width: 256,
              margin: 1,
              color: {
                dark: colors.primary,
                light: '#ffffff'
              }
            }, (error) => {
              if (error) console.error('Error generating QR code:', error);
            });
          }
        }, 100);
      }
    };
    
    // WhatsApp ready listener
    const handleReady = (data) => {
      if (data.userId === currentUser.id) {
        console.log('Settings page: WhatsApp ready event received:', data);
        setStatus('connected');
        setWhatsAppInfo(data.info);
        setQrCode(null);
      }
    };
    
    // Authentication listeners
    const handleAuthenticated = (data) => {
      if (data.userId === currentUser.id) {
        console.log('Settings page: WhatsApp authenticated event received');
        setStatus('authenticated');
      }
    };
    
    const handleAuthFailure = (data) => {
      if (data.userId === currentUser.id) {
        console.log('Settings page: WhatsApp auth failure event received');
        setStatus('auth-failed');
        setError(data.message || 'Authentication failed');
        // Retry connection
        initWhatsApp();
      }
    };
    
    const handleDisconnected = (data) => {
      if (data.userId === currentUser.id) {
        console.log('Settings page: WhatsApp disconnected event received');
        setStatus('disconnected');
        setWhatsAppInfo(null);
      }
    };
    
    // Register event listeners
    window.whatsappEvents.onQrCode(handleQrCode);
    window.whatsappEvents.onReady(handleReady);
    window.whatsappEvents.onAuthenticated(handleAuthenticated);
    window.whatsappEvents.onAuthFailure(handleAuthFailure);
    window.whatsappEvents.onDisconnected(handleDisconnected);
    
    // Initial status check
    checkStatus();
    
    // Set up periodic status check every 8 seconds 
    // Different from WhatsAppContact's 5 seconds to avoid simultaneous requests
    statusCheckIntervalRef.current = setInterval(checkStatus, 8000);
    
    // Clean up event listeners and interval
    return () => {
      window.whatsappEvents.removeListeners();
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
    };
  }, [currentUser, colors.primary]);
  
  // Effect to update UI when whatsAppInfo changes
  useEffect(() => {
    if (whatsAppInfo) {
      setStatus('connected');
    }
  }, [whatsAppInfo]);
  
  // Render loading state
  if (loading && status === 'checking') {
    return (
      <div className="whatsapp-connect-container">
        <div className="text-center my-4">
          <div className="spinner-border" role="status" style={{ color: colors.primary }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Checking WhatsApp connection...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="whatsapp-connect-container">
      <div className="card" style={{ borderColor: colors.primary }}>
        <div className="card-header d-flex justify-content-between align-items-center" style={{ backgroundColor: colors.primary, color: colors.textOnPrimary }}>
          <h4 className="mb-0">WhatsApp Connection</h4>
          {status === 'connected' && (
            <button 
              className="btn btn-sm btn-light" 
              onClick={logoutWhatsApp}
            >
              Logout
            </button>
          )}
        </div>
        
        <div className="card-body">
          {/* Connection status */}
          <div className="connection-status mb-3">
            <h5>Status: <span className={`status-badge status-${status}`}>{status}</span></h5>
            {error && <div className="alert alert-danger mt-2">{error}</div>}
          </div>
          
          {/* QR Code */}
          {(status === 'qr-ready' || status === 'connecting') && (
            <div className="qr-container text-center my-3">
              <p>Scan this QR code with your WhatsApp to connect</p>
              <canvas id="whatsapp-qr-canvas" className="qr-canvas"></canvas>
              <button 
                className="btn btn-sm mt-3"
                onClick={initWhatsApp}
                style={{ backgroundColor: colors.secondary, color: colors.textOnSecondary }}
              >
                Refresh QR Code
              </button>
            </div>
          )}
          
          {/* Connected Info */}
          {status === 'connected' && whatsAppInfo && (
            <div className="connected-info">
              <div className="user-card d-flex align-items-center p-3 border rounded">
                {whatsAppInfo.profilePic ? (
                  <img 
                    src={whatsAppInfo.profilePic} 
                    alt="WhatsApp Profile" 
                    className="wa-profile-pic me-3"
                    style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div 
                    className="wa-profile-placeholder me-3"
                    style={{ 
                      backgroundColor: colors.primary,
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '24px'
                    }}
                  >
                    <span>{whatsAppInfo.name ? whatsAppInfo.name[0] : '?'}</span>
                  </div>
                )}
                
                <div className="user-info">
                  <h5 className="mb-1">{whatsAppInfo.name}</h5>
                  <p className="mb-0 text-muted">+{whatsAppInfo.number}</p>
                </div>
              </div>
              
              <div className="mt-3">
                <p className="text-success">
                  <i className="bi bi-check-circle-fill me-2"></i>
                  WhatsApp is connected and ready to use
                </p>
              </div>
            </div>
          )}
          
          {/* Disconnected State */}
          {(status === 'disconnected' || status === 'error') && !qrCode && (
            <div className="text-center my-3">
              <p>WhatsApp is not connected</p>
              <button 
                className="btn mt-2"
                onClick={initWhatsApp}
                style={{ backgroundColor: colors.secondary, color: colors.textOnSecondary }}
              >
                Connect WhatsApp
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConnect; 
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { useNavigate } from 'react-router-dom';

const WhatsAppContact = () => {
  const { currentUser } = useAuth();
  const { colors } = useTheme();
  const navigate = useNavigate();
  
  const [whatsAppInfo, setWhatsAppInfo] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 10, y: 10 });
  
  // Ref to track if we've called initialize already
  const hasInitialized = useRef(false);
  // Ref to store the status check interval ID
  const statusCheckIntervalRef = useRef(null);
  // Ref to track the previous connection state to avoid duplicate logs
  const prevConnectedState = useRef(null);
  // Ref to track if we've received WhatsApp info
  const hasReceivedInfo = useRef(false);
  // Store the last event timestamp to debounce events
  const lastEventTime = useRef(0);
  
  const contactRef = useRef(null);
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPos: { x: 0, y: 0 }
  });
  
  useEffect(() => {
    if (!currentUser) return;
    
    // Check WhatsApp status
    const checkWhatsAppStatus = async () => {
      try {
        // Avoid excessive logging - only log if it's the first check
        if (prevConnectedState.current === null) {
          console.log('Initial WhatsApp status check...');
        }
        
        const response = await window.electronAPI.getWhatsAppStatus(currentUser.id);
        
        if (response.success) {
          // Only update and log if state has changed
          if (response.connected !== connected) {
            console.log(`WhatsApp connection state changed: ${connected ? 'connected' : 'disconnected'} -> ${response.connected ? 'connected' : 'disconnected'}`);
            setConnected(response.connected);
            prevConnectedState.current = response.connected;
          }
          
          // If connected but don't have user info yet, get it (only if we haven't initialized yet)
          if (response.connected && !whatsAppInfo && !hasReceivedInfo.current) {
            console.log('Connected but no WhatsApp info, initializing...');
            if (!hasInitialized.current) {
              hasInitialized.current = true;
              window.electronAPI.initWhatsApp(currentUser.id);
            }
          }
          
          // If not connected but has session, initialize (only once)
          if (!response.connected && response.hasSession && !hasInitialized.current) {
            console.log('Has session but not connected, initializing...');
            hasInitialized.current = true;
            window.electronAPI.initWhatsApp(currentUser.id);
          }
        }
      } catch (err) {
        console.error('Error checking WhatsApp status:', err);
      } finally {
        setLoading(false);
      }
    };
    
    // Debounce event handling to prevent excessive processing
    const debounceEvent = (callback, data, minInterval = 1000) => {
      const now = Date.now();
      if (now - lastEventTime.current > minInterval) {
        lastEventTime.current = now;
        callback(data);
      }
    };
    
    // Listen for WhatsApp ready event
    const handleReady = (data) => {
      if (data.userId === currentUser.id) {
        // Avoid duplicate ready events (debounce)
        debounceEvent((eventData) => {
          console.log('WhatsApp ready event received');
          setWhatsAppInfo(eventData.info);
          setConnected(true);
          setLoading(false);
          hasReceivedInfo.current = true; // Mark that we've received info
          prevConnectedState.current = true;
        }, data);
      }
    };
    
    // Listen for disconnected event
    const handleDisconnected = (data) => {
      if (data.userId === currentUser.id) {
        console.log('WhatsApp disconnected event received');
        setWhatsAppInfo(null);
        setConnected(false);
        hasInitialized.current = false;
        hasReceivedInfo.current = false;
        prevConnectedState.current = false;
      }
    };
    
    // Register event listeners
    window.whatsappEvents.onReady(handleReady);
    window.whatsappEvents.onDisconnected(handleDisconnected);
    window.whatsappEvents.onAuthenticated((data) => {
      if (data.userId === currentUser.id) {
        console.log('WhatsApp authenticated event received');
      }
    });
    
    // Initial status check
    checkWhatsAppStatus();
    
    // Set up periodic status check every 5 seconds
    statusCheckIntervalRef.current = setInterval(checkWhatsAppStatus, 5000);
    
    // Clean up
    return () => {
      window.whatsappEvents.removeListeners();
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
    };
  }, [currentUser, connected, whatsAppInfo]);
  
  // Update hasReceivedInfo ref when whatsAppInfo changes
  useEffect(() => {
    if (whatsAppInfo) {
      hasReceivedInfo.current = true;
    }
  }, [whatsAppInfo]);
  
  // Function to set component to the bottom left corner of the window
  const resetPosition = () => {
    if (!contactRef.current) return;
    
    // Get window dimensions
    const windowHeight = window.innerHeight;
    const contactRect = contactRef.current.getBoundingClientRect();
    
    // Position at the bottom left
    setPosition({ 
      x: 10,
      y: windowHeight - contactRect.height - 20
    });
  };
  
  // Handle mouse down event to start dragging
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only handle left mouse button
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling up
    
    // Record starting position
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...position }
    };
    
    // Add mouse move and mouse up event listeners to document
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Add grabbing cursor
    setIsDragging(true);
  };
  
  // Handle mouse move event during dragging
  const handleMouseMove = (e) => {
    if (!dragRef.current.isDragging) return;
    
    // Get window dimensions
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const contactRect = contactRef.current.getBoundingClientRect();
    
    // Calculate new position
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;
    
    const newX = Math.max(0, Math.min(
      dragRef.current.startPos.x + deltaX,
      windowWidth - contactRect.width
    ));
    
    const newY = Math.max(0, Math.min(
      dragRef.current.startPos.y + deltaY,
      windowHeight - contactRect.height
    ));
    
    // Update position
    setPosition({ x: newX, y: newY });
  };
  
  // Handle mouse up event to stop dragging
  const handleMouseUp = (e) => {
    const wasJustDragging = dragRef.current.isDragging;
    const moved = Math.abs(e.clientX - dragRef.current.startX) > 5 || 
                  Math.abs(e.clientY - dragRef.current.startY) > 5;
    
    // Reset dragging state
    dragRef.current.isDragging = false;
    setIsDragging(false);
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // If it was a click (not a drag), navigate to settings
    if (wasJustDragging && !moved) {
      navigate('/dashboard');
      setActiveView('settings');
    }
  };
  
  // Pass the active view state to the parent component
  const setActiveView = (view) => {
    const dashboardStateEvent = new CustomEvent('dashboard-set-active-view', { 
      detail: { view } 
    });
    window.dispatchEvent(dashboardStateEvent);
  };
  
  // Initialize position when component mounts
  useEffect(() => {
    // Set initial position with slight delay to ensure everything is rendered
    const positionTimer = setTimeout(() => {
      resetPosition();
    }, 500);
    
    // Re-adjust position when window is resized
    const handleResize = () => {
      resetPosition();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(positionTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Apply draggable style
  const contactStyle = {
    position: 'fixed', // Use fixed positioning to make it draggable anywhere on the page
    left: `${position.x}px`,
    top: `${position.y}px`,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: 9999, // Very high z-index to make sure it's on top
    transition: isDragging ? 'none' : 'all 0.3s ease',
    borderRadius: '10px',
    backgroundColor: connected ? 'rgba(37, 211, 102, 0.2)' : 'rgba(255, 255, 255, 0.1)',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
    border: `1px solid ${connected ? 'rgba(37, 211, 102, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
    padding: '10px',
    maxWidth: '200px',
    touchAction: 'none', // Prevents default touch actions like scrolling
    userSelect: 'none', // Prevents text selection
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none'
  };
  
  // Show loading state
  if (loading) {
    return (
      <div 
        ref={contactRef}
        className="whatsapp-contact-container" 
        style={contactStyle}
        onMouseDown={handleMouseDown}
      >
        <div className="text-center p-2">
          <div className="spinner-border spinner-border-sm" role="status" style={{ color: colors.primary }}>
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }
  
  // Show contact info
  return (
    <div 
      ref={contactRef}
      className="whatsapp-contact-container" 
      style={contactStyle}
      onMouseDown={handleMouseDown}
      title="Click to open WhatsApp settings, click and hold to drag"
    >
      <div className="d-flex align-items-center">
        {connected && whatsAppInfo?.profilePic ? (
          <img 
            src={whatsAppInfo.profilePic} 
            alt="WhatsApp Profile" 
            className="wa-sidebar-pic me-2"
            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          />
        ) : (
          <div 
            className={`wa-sidebar-placeholder me-2 ${connected ? 'connected' : 'disconnected'}`}
            style={{ 
              backgroundColor: connected ? 'var(--whatsapp-green)' : 'rgba(200, 200, 200, 0.5)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <i className="bi bi-whatsapp" style={{ fontSize: '20px' }}></i>
          </div>
        )}
        
        <div className="wa-sidebar-info">
          {connected && whatsAppInfo ? (
            <>
              <div className="wa-sidebar-name">{whatsAppInfo.name}</div>
              <div className="wa-sidebar-number">+{whatsAppInfo.number}</div>
              <div className="wa-sidebar-status">
                <span className="status-dot connected"></span>
                <small>Connected</small>
              </div>
            </>
          ) : (
            <>
              <div className="wa-sidebar-name">WhatsApp</div>
              <div className="wa-sidebar-status">
                <span className="status-dot disconnected"></span>
                <small>{connected ? 'Connecting...' : 'Disconnected'}</small>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppContact; 
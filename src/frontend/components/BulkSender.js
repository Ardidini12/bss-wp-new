import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const BulkSender = () => {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const [activeView, setActiveView] = useState('settings'); // settings, contacts, templates, scheduled, statistics
  
  // Settings panel state
  const [senderSettings, setSenderSettings] = useState({
    startHour: '09:00',
    endHour: '17:00',
    interval: 60,
    enabled: false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [allowedTimeDisplay, setAllowedTimeDisplay] = useState('');
  
  // Contacts panel state
  const [contacts, setContacts] = useState([]);
  const [contactSources, setContactSources] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectedSourcesAll, setSelectedSourcesAll] = useState({});
  const [contactsPagination, setContactsPagination] = useState({ page: 1, limit: 100, total: 0, totalPages: 1 });
  const [contactsSearch, setContactsSearch] = useState('');
  const [contactsLoading, setContactsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState({});
  const [sourcesPagination, setSourcesPagination] = useState({});
  
  // Templates panel state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  
  // Scheduled messages panel state
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [selectedScheduledMessages, setSelectedScheduledMessages] = useState([]);
  const [scheduledMessagesPagination, setScheduledMessagesPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [scheduledMessagesStatus, setScheduledMessagesStatus] = useState('ALL');
  const [scheduledMessagesLoading, setScheduledMessagesLoading] = useState(false);
  const [bulkSendLoading, setBulkSendLoading] = useState(false);
  const [deleteMessagesLoading, setDeleteMessagesLoading] = useState(false);
  
  // Statistics panel state
  const [messageStats, setMessageStats] = useState(null);
  const [statsDateRange, setStatsDateRange] = useState('day');
  const [statsCustomRange, setStatsCustomRange] = useState({ 
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [statsLoading, setStatsLoading] = useState(false);
  
  // Common state
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Refs for intervals
  const messageStatusCheckInterval = useRef(null);
  
  // Calculate and display allowed time based on settings
  useEffect(() => {
    if (senderSettings) {
      try {
        const [startHour, startMinute] = senderSettings.startHour.split(':').map(Number);
        const [endHour, endMinute] = senderSettings.endHour.split(':').map(Number);
        
        // Calculate total minutes
        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;
        let minutesDifference = endTotalMinutes - startTotalMinutes;
        
        if (minutesDifference <= 0) {
          // Handle case where end time is next day
          minutesDifference += 24 * 60;
        }
        
        // Calculate hours and minutes
        const hours = Math.floor(minutesDifference / 60);
        const minutes = minutesDifference % 60;
        
        // Calculate max messages
        const maxMessages = Math.floor(minutesDifference / (senderSettings.interval / 60));
        
        // Format the display string
        let timeDisplay = '';
        if (hours > 0) {
          timeDisplay += `${hours} hour${hours !== 1 ? 's' : ''}`;
        }
        if (minutes > 0) {
          if (timeDisplay) timeDisplay += ' ';
          timeDisplay += `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }
        
        setAllowedTimeDisplay(`${timeDisplay} (approximately ${maxMessages} messages per day)`);
      } catch (err) {
        console.error('Error calculating allowed time:', err);
        setAllowedTimeDisplay('Error calculating allowed time');
      }
    }
  }, [senderSettings]);
  
  // Function to send browser notifications
  const sendNotification = useCallback((title, message) => {
    try {
      // Check if notifications are supported and permission is granted
      if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
        return;
      }
      
      if (Notification.permission === "granted") {
        new Notification(title, { body: message });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            new Notification(title, { body: message });
          }
        });
      }
    } catch (err) {
      console.error('Error sending notification:', err);
    }
  }, []);
  
  // Periodically check for message status updates
  useEffect(() => {
    if (!currentUser) return;
    
    // Clear any existing interval
    if (messageStatusCheckInterval.current) {
      clearInterval(messageStatusCheckInterval.current);
    }
    
    // Map to track last seen status for each message
    const messageStatusMap = new Map();
    
    // Initialize with current message statuses
    scheduledMessages.forEach(message => {
      messageStatusMap.set(message.id, message.status);
    });
    
    // Set up interval to check for status changes
    messageStatusCheckInterval.current = setInterval(async () => {
      try {
        // Get latest scheduled messages
        const response = await window.electronAPI.getScheduledMessages(
          currentUser.id,
          scheduledMessagesPagination.page,
          scheduledMessagesPagination.limit,
          scheduledMessagesStatus
        );
        
        if (response.success) {
          // Update messages
          setScheduledMessages(response.messages);
          
          // Check for status changes and send notifications
          response.messages.forEach(message => {
            const previousStatus = messageStatusMap.get(message.id);
            if (previousStatus && previousStatus !== message.status) {
              // Status has changed
              const recipient = message.contact_name 
                ? `${message.contact_name} ${message.contact_surname || ''}`
                : message.contact_phone;
              
              let statusText = '';
              switch (message.status) {
                case 'SENT':
                  statusText = 'sent to';
                  break;
                case 'DELIVERED':
                  statusText = 'delivered to';
                  break;
                case 'READ':
                  statusText = 'read by';
                  break;
                case 'FAILED':
                  statusText = 'failed to send to';
                  break;
                default:
                  statusText = `${message.status.toLowerCase()} for`;
              }
              
              sendNotification(
                `Message ${statusText}`,
                `Message was ${statusText} ${recipient}`
              );
            }
            
            // Update status in map
            messageStatusMap.set(message.id, message.status);
          });
        }
      } catch (err) {
        console.error('Error checking message statuses:', err);
      }
    }, 10000); // Check every 10 seconds
    
    // Clean up interval on unmount
    return () => {
      if (messageStatusCheckInterval.current) {
        clearInterval(messageStatusCheckInterval.current);
      }
    };
  }, [currentUser, scheduledMessagesPagination, scheduledMessagesStatus, scheduledMessages, sendNotification]);
  
  // Load sender settings
  const loadSenderSettings = useCallback(async () => {
    if (!currentUser) return;
    
    setSettingsLoading(true);
    try {
      const response = await window.electronAPI.getSenderSettings(currentUser.id);
      
      if (response.success) {
        setSenderSettings(response.settings);
      } else {
        setError(response.error || 'Failed to load sender settings');
      }
    } catch (err) {
      setError('Error loading sender settings: ' + err.message);
    } finally {
      setSettingsLoading(false);
    }
  }, [currentUser]);
  
  // Load contacts
  const loadContacts = useCallback(async () => {
    if (!currentUser) return;
    
    setContactsLoading(true);
    try {
      const response = await window.electronAPI.getContacts(
        contactsPagination.page,
        contactsPagination.limit,
        contactsSearch
      );
      
      if (response.success) {
        setContacts(response.contacts);
        setContactsPagination(response.pagination);
        
        // Set contact sources for grouping
        if (response.sources) {
          setContactSources(response.sources);
          
          // Initialize selectedSourcesAll state
          const initialSelectedSourcesAll = {};
          response.sources.forEach(source => {
            initialSelectedSourcesAll[source] = false;
          });
          setSelectedSourcesAll(initialSelectedSourcesAll);
        }
      } else {
        setError(response.error || 'Failed to load contacts');
      }
    } catch (err) {
      setError('Error loading contacts: ' + err.message);
    } finally {
      setContactsLoading(false);
    }
  }, [currentUser, contactsPagination.page, contactsPagination.limit, contactsSearch]);
  
  // Load templates
  const loadTemplates = useCallback(async () => {
    if (!currentUser) return;
    
    setTemplatesLoading(true);
    try {
      const response = await window.electronAPI.getTemplates(1, 100, '');
      
      if (response.success) {
        setTemplates(response.templates);
      } else {
        setError(response.error || 'Failed to load templates');
      }
    } catch (err) {
      setError('Error loading templates: ' + err.message);
    } finally {
      setTemplatesLoading(false);
    }
  }, [currentUser]);
  
  // Load scheduled messages
  const loadScheduledMessages = useCallback(async () => {
    if (!currentUser) return;
    
    setScheduledMessagesLoading(true);
    try {
      const response = await window.electronAPI.getScheduledMessages(
        currentUser.id,
        scheduledMessagesPagination.page,
        scheduledMessagesPagination.limit,
        scheduledMessagesStatus
      );
      
      if (response.success) {
        setScheduledMessages(response.messages);
        setScheduledMessagesPagination(response.pagination);
      } else {
        setError(response.error || 'Failed to load scheduled messages');
      }
    } catch (err) {
      setError('Error loading scheduled messages: ' + err.message);
    } finally {
      setScheduledMessagesLoading(false);
    }
  }, [currentUser, scheduledMessagesPagination.page, scheduledMessagesPagination.limit, scheduledMessagesStatus]);
  
  // Load initial data
  useEffect(() => {
    loadSenderSettings();
    loadContacts();
    loadTemplates();
    loadScheduledMessages();
    
    // Request notification permission
    if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, [loadSenderSettings, loadContacts, loadTemplates, loadScheduledMessages]);
  
  // Handle settings changes
  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSenderSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Save sender settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    
    if (!currentUser) return;
    
    setSettingsLoading(true);
    try {
      const response = await window.electronAPI.updateSenderSettings(currentUser.id, senderSettings);
      
      if (response.success) {
        setSuccessMessage('Settings saved successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(response.error || 'Failed to save settings');
      }
    } catch (err) {
      setError('Error saving settings: ' + err.message);
    } finally {
      setSettingsLoading(false);
    }
  };
  
  // Handle individual contact selection
  const toggleContactSelection = (contactId) => {
    setSelectedContacts(prev => {
      if (prev.includes(contactId)) {
        return prev.filter(id => id !== contactId);
      } else {
        return [...prev, contactId];
      }
    });
  };
  
  // Handle selecting all contacts from a specific source
  const toggleSelectAllBySource = async (source) => {
    // Check if all contacts from this source are already selected
    const isCurrentlySelected = selectedSourcesAll[source] || false;
    
    if (isCurrentlySelected) {
      // Get all contact IDs from this source and remove them
      try {
        const response = await window.electronAPI.getAllContactIds(source);
        if (response.success) {
          const contactIdsFromSource = response.contactIds;
          setSelectedContacts(prev => prev.filter(id => !contactIdsFromSource.includes(id)));
          setSelectedSourcesAll(prev => ({ ...prev, [source]: false }));
        }
      } catch (err) {
        setError('Error deselecting contacts: ' + err.message);
      }
    } else {
      // Add all contacts from this source
      try {
        const response = await window.electronAPI.getAllContactIds(source);
        if (response.success) {
          const contactIdsFromSource = response.contactIds;
          
          setSelectedContacts(prev => {
            const newSelected = [...prev];
            contactIdsFromSource.forEach(id => {
              if (!newSelected.includes(id)) {
                newSelected.push(id);
              }
            });
            return newSelected;
          });
          
          setSelectedSourcesAll(prev => ({ ...prev, [source]: true }));
        }
      } catch (err) {
        setError('Error selecting contacts: ' + err.message);
      }
    }
  };
  
  // Toggle expanded state for a source
  const toggleSourceExpanded = (source) => {
    setExpandedSources(prev => {
      const newState = { ...prev };
      newState[source] = !prev[source];
      return newState;
    });
    
    // Initialize pagination for this source if not already done
    if (!sourcesPagination[source]) {
      setSourcesPagination(prev => ({
        ...prev,
        [source]: { page: 1, limit: 10, total: 0, totalPages: 1 }
      }));
    }
    
    // Load contacts for this source if expanded
    if (!expandedSources[source]) {
      loadContactsBySource(source);
    }
  };
  
  // Load contacts for a specific source
  const loadContactsBySource = async (source) => {
    if (!currentUser) return;
    
    setContactsLoading(true);
    try {
      const pagination = sourcesPagination[source] || { page: 1, limit: 10 };
      const response = await window.electronAPI.getContacts(
        pagination.page,
        pagination.limit,
        contactsSearch,
        source
      );
      
      if (response.success) {
        // Update contacts for this source only
        setContacts(prev => {
          const otherSourceContacts = prev.filter(c => c.source !== source);
          return [...otherSourceContacts, ...response.contacts];
        });
        
        // Update pagination for this source
        setSourcesPagination(prev => ({
          ...prev,
          [source]: response.pagination
        }));
      } else {
        setError(response.error || 'Failed to load contacts');
      }
    } catch (err) {
      setError('Error loading contacts: ' + err.message);
    } finally {
      setContactsLoading(false);
    }
  };
  
  // Handle contact page change for a specific source
  const handleSourcePageChange = (source, newPage) => {
    setSourcesPagination(prev => ({
      ...prev,
      [source]: { ...prev[source], page: newPage }
    }));
    
    // Reload contacts for this source
    loadContactsBySource(source);
  };
  
  // Handle contact search
  const handleContactSearchChange = (e) => {
    setContactsSearch(e.target.value);
  };
  
  // Handle contact search submit
  const handleContactSearchSubmit = (e) => {
    e.preventDefault();
    setContactsPagination(prev => ({ ...prev, page: 1 }));
    loadContacts();
  };
  
  // Handle template selection
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
  };
  
  // Handle scheduled messages status filter change
  const handleStatusFilterChange = (e) => {
    setScheduledMessagesStatus(e.target.value);
    setScheduledMessagesPagination(prev => ({ ...prev, page: 1 }));
  };
  
  // Handle scheduled messages page change
  const handleScheduledMessagesPageChange = (newPage) => {
    setScheduledMessagesPagination(prev => ({ ...prev, page: newPage }));
  };
  
  // Schedule bulk messages
  const handleBulkSend = async () => {
    if (!currentUser) return;
    
    // Validate that contacts and template are selected
    if (selectedContacts.length === 0) {
      setError('Please select at least one contact');
      return;
    }
    
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }
    
    setBulkSendLoading(true);
    try {
      const response = await window.electronAPI.scheduleMessages(
        currentUser.id,
        selectedContacts,
        selectedTemplate.id,
        null // Use current time
      );
      
      if (response.success) {
        setSuccessMessage(`Successfully scheduled ${response.count} messages`);
        setTimeout(() => setSuccessMessage(''), 3000);
        
        // Send notification
        sendNotification(
          'Messages Scheduled',
          `Successfully scheduled ${response.count} messages`
        );
        
        // Reset selections
        setSelectedContacts([]);
        setSelectedTemplate(null);
        
        // Reset "select all" for each source
        const resetSelectedSourcesAll = {};
        contactSources.forEach(source => {
          resetSelectedSourcesAll[source] = false;
        });
        setSelectedSourcesAll(resetSelectedSourcesAll);
        
        // Refresh scheduled messages
        loadScheduledMessages();
        
        // Switch to scheduled messages view
        setActiveView('scheduled');
      } else {
        setError(response.error || 'Failed to schedule messages');
      }
    } catch (err) {
      setError('Error scheduling messages: ' + err.message);
    } finally {
      setBulkSendLoading(false);
    }
  };
  
  // Cancel scheduled message
  const handleCancelMessage = async (messageId) => {
    if (!currentUser) return;
    
    try {
      const response = await window.electronAPI.cancelScheduledMessage(messageId);
      
      if (response.success) {
        setSuccessMessage('Message canceled successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        
        // Send notification
        sendNotification(
          'Message Canceled',
          'The message was canceled successfully'
        );
        
        // Refresh scheduled messages
        loadScheduledMessages();
      } else {
        setError(response.error || 'Failed to cancel message');
      }
    } catch (err) {
      setError('Error canceling message: ' + err.message);
    }
  };
  
  // Get status badge color
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-secondary';
      case 'SENDING':
        return 'bg-info';
      case 'SENT':
        return 'bg-primary';
      case 'DELIVERED':
        return 'bg-success';
      case 'READ':
        return 'bg-success';
      case 'FAILED':
        return 'bg-danger';
      case 'CANCELED':
        return 'bg-warning';
      default:
        return 'bg-secondary';
    }
  };
  
  // Handle selecting a scheduled message
  const toggleScheduledMessageSelection = (messageId) => {
    setSelectedScheduledMessages(prev => {
      if (prev.includes(messageId)) {
        return prev.filter(id => id !== messageId);
      } else {
        return [...prev, messageId];
      }
    });
  };
  
  // Handle selecting all scheduled messages (across all pages)
  const toggleSelectAllScheduledMessages = async () => {
    if (selectedScheduledMessages.length > 0) {
      // If some are selected, deselect all
      setSelectedScheduledMessages([]);
    } else {
      // Select all messages across all pages
      try {
        const response = await window.electronAPI.getAllScheduledMessageIds(
          currentUser.id,
          scheduledMessagesStatus
        );
        
        if (response.success) {
          setSelectedScheduledMessages(response.messageIds);
          setSuccessMessage(`Selected all ${response.messageIds.length} messages`);
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setError(response.error || 'Failed to get all messages');
        }
      } catch (error) {
        setError('Error selecting all messages: ' + error.message);
      }
    }
  };
  
  // Delete selected scheduled messages
  const handleDeleteSelectedMessages = async () => {
    if (selectedScheduledMessages.length === 0) {
      setError('No messages selected for deletion');
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete ${selectedScheduledMessages.length} message(s)?`)) {
      return;
    }
    
    setDeleteMessagesLoading(true);
    try {
      const response = await window.electronAPI.deleteScheduledMessages(selectedScheduledMessages);
      
      if (response.success) {
        setSuccessMessage(`Successfully deleted ${response.deletedCount} message(s)`);
        setTimeout(() => setSuccessMessage(''), 3000);
        
        // Send notification
        sendNotification(
          'Messages Deleted',
          `Successfully deleted ${response.deletedCount} message(s)`
        );
        
        // Reset selection
        setSelectedScheduledMessages([]);
        
        // Refresh scheduled messages
        loadScheduledMessages();
      } else {
        setError(response.error || 'Failed to delete messages');
      }
    } catch (err) {
      setError('Error deleting messages: ' + err.message);
    } finally {
      setDeleteMessagesLoading(false);
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };
  
  // Load message statistics
  const loadMessageStats = useCallback(async () => {
    if (!currentUser) return;
    
    setStatsLoading(true);
    try {
      let startDate, endDate;
      
      switch (statsDateRange) {
        case 'day':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setHours(23, 59, 59, 999);
          break;
          
        case 'week':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of week (Sunday)
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // End of week (Saturday)
          endDate.setHours(23, 59, 59, 999);
          break;
          
        case 'month':
          startDate = new Date();
          startDate.setDate(1); // First day of month
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 1, 0); // Last day of month
          endDate.setHours(23, 59, 59, 999);
          break;
          
        case 'year':
          startDate = new Date();
          startDate.setMonth(0, 1); // January 1st
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setMonth(11, 31); // December 31st
          endDate.setHours(23, 59, 59, 999);
          break;
          
        case 'custom':
          startDate = new Date(`${statsCustomRange.startDate}T00:00:00`);
          endDate = new Date(`${statsCustomRange.endDate}T23:59:59`);
          break;
          
        default:
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setHours(23, 59, 59, 999);
      }
      
      const response = await window.electronAPI.getMessageStatistics(
        currentUser.id,
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      if (response.success) {
        setMessageStats(response);
      } else {
        setError(response.error || 'Failed to load message statistics');
      }
    } catch (err) {
      setError('Error loading message statistics: ' + err.message);
    } finally {
      setStatsLoading(false);
    }
  }, [currentUser, statsDateRange, statsCustomRange]);
  
  // Update statistics when date range changes
  useEffect(() => {
    loadMessageStats();
  }, [loadMessageStats]);
  

  
  // Render the settings panel
  const renderSettingsPanel = () => {
    return (
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Sender Settings</h5>
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="alert alert-success" role="alert">
              {successMessage}
            </div>
          )}
          
          <form onSubmit={handleSaveSettings}>
            <div className="form-check form-switch mb-3">
              <input
                className="form-check-input"
                type="checkbox"
                id="enabled"
                name="enabled"
                checked={senderSettings.enabled}
                onChange={handleSettingsChange}
              />
              <label className="form-check-label" htmlFor="enabled">
                Enable message scheduler
              </label>
            </div>
            
            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="startHour" className="form-label">Working Hours Start</label>
                <input
                  type="time"
                  className="form-control"
                  id="startHour"
                  name="startHour"
                  value={senderSettings.startHour}
                  onChange={handleSettingsChange}
                  required
                />
                <small className="text-muted">Messages will only be sent after this time</small>
              </div>
              
              <div className="col-md-6">
                <label htmlFor="endHour" className="form-label">Working Hours End</label>
                <input
                  type="time"
                  className="form-control"
                  id="endHour"
                  name="endHour"
                  value={senderSettings.endHour}
                  onChange={handleSettingsChange}
                  required
                />
                <small className="text-muted">Messages will stop sending after this time</small>
              </div>
            </div>
            
            <div className="mb-3">
              <label htmlFor="interval" className="form-label">Interval Between Messages (seconds)</label>
              <input
                type="number"
                className="form-control"
                id="interval"
                name="interval"
                value={senderSettings.interval}
                onChange={handleSettingsChange}
                min="5"
                required
              />
              <small className="text-muted">Minimum time between messages (recommended: at least 10 seconds)</small>
            </div>
            
            {allowedTimeDisplay && (
              <div className="alert alert-info mb-3">
                <strong>Allowed Sending Time:</strong> {allowedTimeDisplay}
              </div>
            )}
            
            <div className="d-flex justify-content-end">
              <button 
                type="submit"
                className="btn btn-primary"
                disabled={settingsLoading}
              >
                {settingsLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };
  
  // Render the contacts panel
  const renderContactsPanel = () => {
    return (
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Select Contacts</h5>
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          <div className="mb-3">
            <form onSubmit={handleContactSearchSubmit} className="d-flex">
              <input
                type="text"
                className="form-control me-2"
                placeholder="Search contacts..."
                value={contactsSearch}
                onChange={handleContactSearchChange}
              />
              <button 
                type="submit"
                className="btn btn-primary"
                disabled={contactsLoading}
              >
                {contactsLoading ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  'Search'
                )}
              </button>
            </form>
          </div>
          
          <div className="mb-3">
            <p className="mb-1">
              <strong>Selected Contacts:</strong> {selectedContacts.length}
            </p>
          </div>
          
          {contactsLoading && !expandedSources ? (
            <div className="text-center py-4">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : contactSources.length === 0 ? (
            <div className="alert alert-info" role="alert">
              No contacts found. Please add contacts to continue.
            </div>
          ) : (
            <>
              {/* Group contacts by source */}
              {contactSources.map(source => {
                const isExpanded = expandedSources[source] || false;
                const contactsFromSource = contacts.filter(c => c.source === source);
                const sourcePagination = sourcesPagination[source] || { page: 1, limit: 10, total: 0, totalPages: 1 };
                
                return (
                  <div key={source} className="card mb-3">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <button 
                        className="btn btn-link text-decoration-none text-start w-75"
                        onClick={() => toggleSourceExpanded(source)}
                        style={{ padding: 0 }}
                      >
                        <h6 className="mb-0">
                          <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} me-2`}></i>
                          {source}
                        </h6>
                      </button>
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`select-all-${source.replace(/\s+/g, '-')}`}
                          checked={selectedSourcesAll[source] || false}
                          onChange={() => toggleSelectAllBySource(source)}
                        />
                        <label className="form-check-label" htmlFor={`select-all-${source.replace(/\s+/g, '-')}`}>
                          Select All
                        </label>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="card-body p-0">
                        {contactsLoading && expandedSources[source] ? (
                          <div className="text-center py-4">
                            <div className="spinner-border" role="status">
                              <span className="visually-hidden">Loading...</span>
                            </div>
                          </div>
                        ) : contactsFromSource.length === 0 ? (
                          <div className="alert alert-info m-3" role="alert">
                            No contacts found in this list.
                          </div>
                        ) : (
                          <>
                            <div className="table-responsive">
                              <table className="table table-hover mb-0">
                                <thead>
                                  <tr>
                                    <th style={{ width: '40px' }}></th>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>Email</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {contactsFromSource.map(contact => (
                                    <tr key={contact.id}>
                                      <td>
                                        <div className="form-check">
                                          <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={selectedContacts.includes(contact.id)}
                                            onChange={() => toggleContactSelection(contact.id)}
                                          />
                                        </div>
                                      </td>
                                      <td>{contact.name} {contact.surname}</td>
                                      <td>{contact.phone}</td>
                                      <td>{contact.email}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            
                            {/* Source-specific pagination */}
                            {sourcePagination.totalPages > 1 && (
                              <nav aria-label={`${source} pagination`} className="p-2 bg-light border-top">
                                <ul className="pagination pagination-sm justify-content-center mb-0">
                                  <li className={`page-item ${sourcePagination.page === 1 ? 'disabled' : ''}`}>
                                    <button 
                                      className="page-link" 
                                      onClick={() => handleSourcePageChange(source, sourcePagination.page - 1)}
                                      disabled={sourcePagination.page === 1}
                                    >
                                      Previous
                                    </button>
                                  </li>
                                  
                                  {[...Array(sourcePagination.totalPages)].map((_, index) => (
                                    <li 
                                      key={index} 
                                      className={`page-item ${sourcePagination.page === index + 1 ? 'active' : ''}`}
                                    >
                                      <button
                                        className="page-link"
                                        onClick={() => handleSourcePageChange(source, index + 1)}
                                      >
                                        {index + 1}
                                      </button>
                                    </li>
                                  ))}
                                  
                                  <li className={`page-item ${sourcePagination.page === sourcePagination.totalPages ? 'disabled' : ''}`}>
                                    <button 
                                      className="page-link" 
                                      onClick={() => handleSourcePageChange(source, sourcePagination.page + 1)}
                                      disabled={sourcePagination.page === sourcePagination.totalPages}
                                    >
                                      Next
                                    </button>
                                  </li>
                                </ul>
                              </nav>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  };
  
  // Render the templates panel
  const renderTemplatesPanel = () => {
    return (
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Select Template</h5>
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          {templatesLoading ? (
            <div className="text-center py-4">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="alert alert-info" role="alert">
              No templates found. Please create templates to continue.
            </div>
          ) : (
            <div className="row">
              <div className="col-md-6">
                <div className="list-group">
                  {templates.map(template => (
                    <button
                      key={template.id}
                      type="button"
                      className={`list-group-item list-group-item-action ${selectedTemplate && selectedTemplate.id === template.id ? 'active' : ''}`}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="col-md-6">
                {selectedTemplate ? (
                  <div className="card">
                    <div className="card-header">
                      <h6 className="mb-0">Template Preview</h6>
                    </div>
                    <div className="card-body">
                      <h5 className="card-title">{selectedTemplate.name}</h5>
                      
                      {selectedTemplate.content.text && (
                        <p className="card-text">{selectedTemplate.content.text}</p>
                      )}
                      
                      {selectedTemplate.content.images && selectedTemplate.content.images.length > 0 && (
                        <div className="mt-3">
                          <img
                            src={selectedTemplate.content.images[0]}
                            alt="Template preview"
                            className="img-fluid rounded"
                            style={{ maxHeight: '200px' }}
                          />
                          
                          {selectedTemplate.content.images.length > 1 && (
                            <p className="mt-2 text-muted">
                              +{selectedTemplate.content.images.length - 1} more {selectedTemplate.content.images.length > 2 ? 'images' : 'image'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-info">
                    Select a template to see a preview
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Render the scheduled messages panel
  const renderScheduledMessagesPanel = () => {
    return (
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Scheduled Messages</h5>
          <div className="d-flex">
            <select
              className="form-select me-2"
              value={scheduledMessagesStatus}
              onChange={handleStatusFilterChange}
            >
              <option value="ALL">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="SENDING">Sending</option>
              <option value="SENT">Sent</option>
              <option value="DELIVERED">Delivered</option>
              <option value="READ">Read</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELED">Canceled</option>
            </select>
            {selectedScheduledMessages.length > 0 && (
              <button
                className="btn btn-danger"
                onClick={handleDeleteSelectedMessages}
                disabled={deleteMessagesLoading}
              >
                {deleteMessagesLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Deleting...
                  </>
                ) : (
                  `Delete Selected (${selectedScheduledMessages.length})`
                )}
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="alert alert-success" role="alert">
              {successMessage}
            </div>
          )}
          
          {scheduledMessagesLoading ? (
            <div className="text-center py-4">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : scheduledMessages.length === 0 ? (
            <div className="alert alert-info" role="alert">
              No scheduled messages found.
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={selectedScheduledMessages.length > 0}
                            onChange={toggleSelectAllScheduledMessages}
                          />
                        </div>
                      </th>
                      <th>Recipient</th>
                      <th>Phone</th>
                      <th>Template</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Messages are already sorted in the backend (newest first) */}
                    {scheduledMessages.map(message => (
                        <tr key={message.id}>
                          <td>
                            <div className="form-check">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={selectedScheduledMessages.includes(message.id)}
                                onChange={() => toggleScheduledMessageSelection(message.id)}
                              />
                            </div>
                          </td>
                          <td>
                            {message.contact_name} {message.contact_surname}
                          </td>
                          <td>{message.contact_phone}</td>
                          <td>{message.template_name}</td>
                          <td>
                            {new Date(message.scheduled_time).toLocaleDateString()} {new Date(message.scheduled_time).toLocaleTimeString()}
                          </td>
                          <td>
                            <div className="d-flex flex-column">
                              <span className={`badge ${getStatusBadgeColor(message.status)}`}>
                                {message.status}
                              </span>
                              <small className="text-muted">
                                {formatTimestamp(message.updated_at)}
                              </small>
                              
                              {/* Show status history */}
                              {message.status_history && message.status_history.length > 0 && (
                                <div className="mt-1 small status-history">
                                  {message.status_history.map((history, index) => (
                                    <div key={index} className="d-flex justify-content-between">
                                      <span className={`badge ${getStatusBadgeColor(history.status)} me-1`}>
                                        {history.status}
                                      </span>
                                      <small className="text-muted">
                                        {formatTimestamp(history.timestamp)}
                                      </small>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            {/* Only show Cancel button for SCHEDULED status */}
                            {message.status === 'SCHEDULED' && (
                              <button
                                className="btn btn-sm btn-warning"
                                onClick={() => handleCancelMessage(message.id)}
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {scheduledMessagesPagination.totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div className="d-flex align-items-center">
                    <span className="me-2">Go to page:</span>
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const page = parseInt(e.target.pageNumber.value);
                        if (page > 0 && page <= scheduledMessagesPagination.totalPages) {
                          handleScheduledMessagesPageChange(page);
                          e.target.pageNumber.value = '';
                        }
                      }}
                      className="d-flex align-items-center"
                    >
                      <input 
                        type="number" 
                        name="pageNumber" 
                        className="form-control form-control-sm me-2" 
                        min="1" 
                        max={scheduledMessagesPagination.totalPages} 
                        placeholder="Page #"
                        style={{ width: '70px' }}
                      />
                      <button type="submit" className="btn btn-sm btn-outline-primary me-2">Go</button>
                    </form>
                    <span className="text-muted">
                      (Page {scheduledMessagesPagination.page} of {scheduledMessagesPagination.totalPages})
                    </span>
                  </div>
                  
                  <nav aria-label="Scheduled messages pagination">
                    <ul className="pagination pagination-sm mb-0">
                      <li className={`page-item ${scheduledMessagesPagination.page === 1 ? 'disabled' : ''}`}>
                        <button 
                          className="page-link" 
                          onClick={() => handleScheduledMessagesPageChange(1)}
                          disabled={scheduledMessagesPagination.page === 1}
                        >
                          &laquo;
                        </button>
                      </li>
                      <li className={`page-item ${scheduledMessagesPagination.page === 1 ? 'disabled' : ''}`}>
                        <button 
                          className="page-link" 
                          onClick={() => handleScheduledMessagesPageChange(scheduledMessagesPagination.page - 1)}
                          disabled={scheduledMessagesPagination.page === 1}
                        >
                          &lt;
                        </button>
                      </li>
                      
                      <li className={`page-item ${scheduledMessagesPagination.page === scheduledMessagesPagination.totalPages ? 'disabled' : ''}`}>
                        <button 
                          className="page-link" 
                          onClick={() => handleScheduledMessagesPageChange(scheduledMessagesPagination.page + 1)}
                          disabled={scheduledMessagesPagination.page === scheduledMessagesPagination.totalPages}
                        >
                          &gt;
                        </button>
                      </li>
                      <li className={`page-item ${scheduledMessagesPagination.page === scheduledMessagesPagination.totalPages ? 'disabled' : ''}`}>
                        <button 
                          className="page-link" 
                          onClick={() => handleScheduledMessagesPageChange(scheduledMessagesPagination.totalPages)}
                          disabled={scheduledMessagesPagination.page === scheduledMessagesPagination.totalPages}
                        >
                          &raquo;
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };
  
  // Render the statistics panel
  const renderStatisticsPanel = () => {
    // Prepare chart data
    const prepareChartData = () => {
      if (!messageStats) return null;
      
      const statusLabels = {
        SCHEDULED: 'Scheduled',
        SENDING: 'Sending',
        SENT: 'Sent',
        DELIVERED: 'Delivered',
        READ: 'Read',
        FAILED: 'Failed',
        CANCELED: 'Canceled'
      };
      
      // Colors for each status
      const statusColors = {
        SCHEDULED: 'rgba(108, 117, 125, 0.7)', // Secondary
        SENDING: 'rgba(23, 162, 184, 0.7)',    // Info
        SENT: 'rgba(0, 123, 255, 0.7)',        // Primary
        DELIVERED: 'rgba(40, 167, 69, 0.7)',   // Success
        READ: 'rgba(0, 200, 81, 0.7)',         // Success (brighter)
        FAILED: 'rgba(220, 53, 69, 0.7)',      // Danger
        CANCELED: 'rgba(255, 193, 7, 0.7)'     // Warning
      };
      
      // Pie chart data
      const pieData = {
        labels: Object.keys(messageStats.statusCounts).map(status => statusLabels[status]),
        datasets: [
          {
            data: Object.values(messageStats.statusCounts),
            backgroundColor: Object.keys(messageStats.statusCounts).map(status => statusColors[status]),
            borderWidth: 1
          }
        ]
      };
      
      // Bar chart data for daily stats
      const barData = {
        labels: Object.keys(messageStats.dailyStats).map(date => {
          const d = new Date(date);
          return `${d.getMonth() + 1}/${d.getDate()}`;
        }),
        datasets: [
          {
            label: 'Scheduled',
            data: Object.values(messageStats.dailyStats).map(day => day.SCHEDULED),
            backgroundColor: statusColors.SCHEDULED
          },
          {
            label: 'Sent',
            data: Object.values(messageStats.dailyStats).map(day => day.SENT),
            backgroundColor: statusColors.SENT
          },
          {
            label: 'Delivered',
            data: Object.values(messageStats.dailyStats).map(day => day.DELIVERED),
            backgroundColor: statusColors.DELIVERED
          },
          {
            label: 'Read',
            data: Object.values(messageStats.dailyStats).map(day => day.READ),
            backgroundColor: statusColors.READ
          },
          {
            label: 'Failed',
            data: Object.values(messageStats.dailyStats).map(day => day.FAILED),
            backgroundColor: statusColors.FAILED
          },
          {
            label: 'Canceled',
            data: Object.values(messageStats.dailyStats).map(day => day.CANCELED),
            backgroundColor: statusColors.CANCELED
          }
        ]
      };
      
      return { pieData, barData };
    };
    
    const chartData = messageStats ? prepareChartData() : null;
    
    return (
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Message Statistics</h5>
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          <div className="mb-4">
            <div className="d-flex align-items-center mb-3">
              <div className="me-3">
                <label className="form-label">Time Period:</label>
                <select
                  className="form-select"
                  value={statsDateRange}
                  onChange={(e) => setStatsDateRange(e.target.value)}
                >
                  <option value="day">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              
              {statsDateRange === 'custom' && (
                <div className="d-flex align-items-center">
                  <div className="me-2">
                    <label className="form-label">Start Date:</label>
                    <input
                      type="date"
                      className="form-control"
                      value={statsCustomRange.startDate}
                      onChange={(e) => setStatsCustomRange(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="me-2">
                    <label className="form-label">End Date:</label>
                    <input
                      type="date"
                      className="form-control"
                      value={statsCustomRange.endDate}
                      onChange={(e) => setStatsCustomRange(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                  <div className="d-flex align-items-end">
                    <button
                      className="btn btn-primary"
                      onClick={loadMessageStats}
                      disabled={statsLoading}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
              
              {statsDateRange !== 'custom' && (
                <div className="d-flex align-items-end">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={loadMessageStats}
                    disabled={statsLoading}
                  >
                    {statsLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Loading...
                      </>
                    ) : (
                      'Refresh'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {statsLoading ? (
            <div className="text-center py-4">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : !messageStats || messageStats.total === 0 ? (
            <div className="alert alert-info" role="alert">
              No message data available for the selected time period.
            </div>
          ) : (
            <>
              <div className="row mb-4">
                <div className="col-md-12">
                  <div className="card">
                    <div className="card-header">
                      <h6 className="mb-0">Summary</h6>
                    </div>
                    <div className="card-body">
                      <div className="d-flex flex-wrap justify-content-between">
                        <div className="text-center p-3">
                          <h3>{messageStats.total}</h3>
                          <p className="mb-0">Total Messages</p>
                        </div>
                        {Object.entries(messageStats.statusCounts).map(([status, count]) => (
                          <div key={status} className="text-center p-3">
                            <h3>{count}</h3>
                            <p className="mb-0">
                              <span className={`badge ${getStatusBadgeColor(status)}`}>
                                {status}
                              </span>
                            </p>
                            <p className="mb-0 text-muted">
                              {messageStats.statusPercentages[status]}%
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="row">
                <div className="col-md-5">
                  <div className="card">
                    <div className="card-header">
                      <h6 className="mb-0">Message Status Distribution</h6>
                    </div>
                    <div className="card-body">
                      <div style={{ height: '300px' }}>
                        {chartData && <Pie data={chartData.pieData} options={{ maintainAspectRatio: false }} />}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="col-md-7">
                  <div className="card">
                    <div className="card-header">
                      <h6 className="mb-0">Daily Message Activity</h6>
                    </div>
                    <div className="card-body">
                      <div style={{ height: '300px' }}>
                        {chartData && <Bar 
                          data={chartData.barData} 
                          options={{ 
                            maintainAspectRatio: false,
                            scales: {
                              x: {
                                stacked: false,
                              },
                              y: {
                                stacked: false,
                                beginAtZero: true
                              }
                            }
                          }} 
                        />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="bulk-sender">
      {/* Workflow navigation */}
      <div className="d-flex justify-content-between mb-4">
        <ul className="nav nav-pills">
          <li className="nav-item">
            <button
              className={`nav-link ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveView('settings')}
            >
              1. Scheduler Settings
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeView === 'contacts' ? 'active' : ''}`}
              onClick={() => setActiveView('contacts')}
            >
              2. Select Contacts
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeView === 'templates' ? 'active' : ''}`}
              onClick={() => setActiveView('templates')}
            >
              3. Select Template
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeView === 'scheduled' ? 'active' : ''}`}
              onClick={() => setActiveView('scheduled')}
            >
              Scheduled Messages
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeView === 'statistics' ? 'active' : ''}`}
              onClick={() => setActiveView('statistics')}
            >
              Statistics
            </button>
          </li>
        </ul>
        
        {/* Bulk send button */}
        {(activeView === 'contacts' || activeView === 'templates') && (
          <button
            className="btn btn-success"
            disabled={bulkSendLoading || selectedContacts.length === 0 || !selectedTemplate}
            onClick={handleBulkSend}
          >
            {bulkSendLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Scheduling...
              </>
            ) : (
              <>
                <i className="bi bi-send me-1"></i>
                Bulk Send ({selectedContacts.length})
              </>
            )}
          </button>
        )}
      </div>
      
      {/* Active panel content */}
      {activeView === 'settings' && renderSettingsPanel()}
      {activeView === 'contacts' && renderContactsPanel()}
      {activeView === 'templates' && renderTemplatesPanel()}
      {activeView === 'scheduled' && renderScheduledMessagesPanel()}
      {activeView === 'statistics' && renderStatisticsPanel()}
    </div>
  );
};

export default BulkSender; 
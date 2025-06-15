import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement
);

const SalesScheduledMessages = () => {
  const { colors, theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalPages: 1,
    totalMessages: 0
  });
  const [filters, setFilters] = useState({
    status: 'ALL',
    messageNumber: '',
    startDate: null,
    endDate: null
  });
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [statistics, setStatistics] = useState({
    totalMessages: 0,
    statusCounts: {
      SCHEDULED: 0,
      SCHEDULED_FUTURE: 0,
      PENDING_FIRST_MESSAGE: 0,
      SENDING: 0,
      SENT: 0,
      DELIVERED: 0,
      READ: 0,
      FAILED: 0,
      CANCELED: 0
    },
    messageNumberCounts: {
      1: 0,
      2: 0
    }
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [modalMessage, setModalMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [timePeriod, setTimePeriod] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // seconds
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get status badge color
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'SCHEDULED':
      case 'SCHEDULED_FUTURE':
        return 'badge bg-info';
      case 'PENDING_FIRST_MESSAGE':
        return 'badge bg-secondary';
      case 'SENDING':
        return 'badge bg-warning';
      case 'SENT':
        return 'badge bg-primary';
      case 'DELIVERED':
        return 'badge bg-success';
      case 'READ':
        return 'badge bg-success';
      case 'FAILED':
        return 'badge bg-danger';
      case 'CANCELED':
        return 'badge bg-danger';
      default:
        return 'badge bg-secondary';
    }
  };

  // Get date range for time period
  const getDateRangeForPeriod = (period) => {
    const now = new Date();
    let startDate = null;
    let endDate = null;
    
    switch (period) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'this_week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // End of week (Saturday)
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        // Use existing custom dates
        startDate = filters.startDate;
        endDate = filters.endDate;
        break;
      case 'all':
      default:
        // All time, no date filters
        break;
    }
    
    return { startDate, endDate };
  };

  // Load scheduled messages
  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await window.electronAPI.getSalesScheduledMessages(
        pagination.page,
        pagination.limit,
        filters,
        { 
          orderBy: 'scheduledTime',
          orderDirection: 'desc',
          groupRelatedMessages: true // This will need to be implemented in the backend
        }
      );
      
      if (response.success) {
        setMessages(response.messages || []);
        setPagination(response.pagination || {
          page: 1,
          limit: 10,
          totalPages: 1,
          totalMessages: 0
        });
      } else {
        console.error('Failed to load scheduled messages:', response.error);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading scheduled messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  // Load statistics
  const loadStatistics = useCallback(async () => {
    try {
      setStatsLoading(true);
      
      // Get date range based on selected time period
      const { startDate, endDate } = getDateRangeForPeriod(timePeriod);
      
      const response = await window.electronAPI.getSalesMessageStatistics(
        startDate,
        endDate
      );
      
      if (response.success) {
        setStatistics(response);
      } else {
        console.error('Failed to load statistics:', response.error);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [timePeriod]);

  // Auto-refresh timer with improved position and selection maintenance
  useEffect(() => {
    let timer = null;
    
    if (autoRefresh) {
      timer = setInterval(() => {
        // Store the current scroll position before updating
        const scrollPosition = window.scrollY;
        
        // Store the current selected messages to maintain selection
        const currentSelectedMessages = [...selectedMessages];
        
        // Record currently focused element if any
        const activeElement = document.activeElement;
        const activeElementId = activeElement ? activeElement.id : null;
        const activeElementTagName = activeElement ? activeElement.tagName : null;
        const activeElementIndex = activeElement ? Array.from(document.querySelectorAll(activeElementTagName)).indexOf(activeElement) : -1;
        
        // Also store the cursor position if it's an input or textarea
        let selectionStart = null;
        let selectionEnd = null;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          selectionStart = activeElement.selectionStart;
          selectionEnd = activeElement.selectionEnd;
        }
        
        // Reload data without changing page
        const refreshData = async () => {
          try {
            // Keep current page and limit
            const response = await window.electronAPI.getSalesScheduledMessages(
              pagination.page,
              pagination.limit,
              filters,
              { 
                orderBy: 'scheduledTime',
                orderDirection: 'desc',
                groupRelatedMessages: true // Ensure msg1 is always followed by related msg2
              }
            );
            
            if (response.success) {
              // Update messages without affecting scroll
              setMessages(response.messages || []);
              
              // Only update total pages and total messages, not current page
              setPagination(prev => ({
                ...prev,
                totalPages: response.pagination?.totalPages || prev.totalPages,
                totalMessages: response.pagination?.totalMessages || prev.totalMessages
              }));
              
              // Restore selection state
              setSelectedMessages(currentSelectedMessages);
            }
            
            // Also refresh statistics
            loadStatistics();
            
            // Use double requestAnimationFrame for more reliable DOM updates
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // First restore scroll position precisely
                window.scrollTo({
                  top: scrollPosition,
                  behavior: 'instant' // Use instant to avoid any animation
                });
                
                // Then try to restore focus using multiple strategies
                if (activeElementId && document.getElementById(activeElementId)) {
                  // If we have an ID, use that first (most reliable)
                  const elementToFocus = document.getElementById(activeElementId);
                  elementToFocus.focus();
                  
                  // Restore cursor position if applicable
                  if ((elementToFocus.tagName === 'INPUT' || elementToFocus.tagName === 'TEXTAREA') && 
                      selectionStart !== null && selectionEnd !== null) {
                    elementToFocus.setSelectionRange(selectionStart, selectionEnd);
                  }
                } else if (activeElementTagName && activeElementIndex >= 0) {
                  // Fall back to tag name and index
                  const elements = document.querySelectorAll(activeElementTagName);
                  if (elements.length > activeElementIndex) {
                    elements[activeElementIndex].focus();
                  }
                }
              });
            });
          } catch (error) {
            console.error('Error in auto-refresh:', error);
          }
        };
        
        refreshData();
      }, refreshInterval * 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [autoRefresh, refreshInterval, filters, pagination.page, pagination.limit, loadStatistics, selectedMessages]);

  // Initial data loading
  useEffect(() => {
    loadMessages();
    loadStatistics();
  }, [loadMessages, loadStatistics]);

  // Handle auto-refresh change
  const handleAutoRefreshChange = (e) => {
    setAutoRefresh(e.target.checked);
  };

  // Handle refresh interval change
  const handleRefreshIntervalChange = (e) => {
    setRefreshInterval(parseInt(e.target.value, 10));
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setPagination({
      ...pagination,
      page: newPage
    });
  };

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
    // Reset to first page when filter changes
    setPagination({
      ...pagination,
      page: 1
    });
  };

  // Handle date filter changes
  const handleDateChange = (dates) => {
    const [start, end] = dates;
    setFilters({
      ...filters,
      startDate: start,
      endDate: end
    });
    
    // Update time period to custom
    if (start || end) {
      setTimePeriod('custom');
    }
    
    // Reset to first page when filter changes
    setPagination({
      ...pagination,
      page: 1
    });
  };
  
  // Handle time period change
  const handleTimePeriodChange = (e) => {
    const period = e.target.value;
    setTimePeriod(period);
    
    // If not custom, update the date filters
    if (period !== 'custom') {
      const { startDate, endDate } = getDateRangeForPeriod(period);
      
      // Only update the date filters if different to avoid unnecessary re-renders
      if (startDate !== filters.startDate || endDate !== filters.endDate) {
        setFilters(prev => ({
          ...prev,
          startDate,
          endDate
        }));
      }
    }
  };

  // Handle row selection
  const handleSelectRow = (id) => {
    if (selectedMessages.includes(id)) {
      setSelectedMessages(selectedMessages.filter(messageId => messageId !== id));
    } else {
      setSelectedMessages([...selectedMessages, id]);
    }
  };

  // Handle select all messages (across all pages)
  const handleSelectAll = async () => {
    if (selectedMessages.length > 0) {
      // If some are selected, deselect all
      setSelectedMessages([]);
      setSelectAll(false);
    } else {
      // Select all messages across all pages
      try {
        const response = await window.electronAPI.getAllSalesScheduledMessageIds(filters);
        
        if (response.success) {
          setSelectedMessages(response.messageIds);
          setSelectAll(true);
          setSnackbar({
            open: true,
            message: `Selected all ${response.messageIds.length} messages`,
            severity: 'success'
          });
        } else {
          setSnackbar({
            open: true,
            message: response.error || 'Failed to get all messages',
            severity: 'error'
          });
        }
      } catch (error) {
        setSnackbar({
          open: true,
          message: 'Error selecting all messages: ' + error.message,
          severity: 'error'
        });
      }
    }
  };

  // Handle view message
  const handleViewMessage = (message) => {
    setModalMessage(message);
    setShowModal(true);
  };

  // Handle delete selected messages
  const handleDeleteSelected = async () => {
    if (selectedMessages.length === 0) {
      setSnackbar({
        open: true,
        message: 'No messages selected for deletion',
        severity: 'warning'
      });
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete ${selectedMessages.length} selected message(s)?`);
    if (!confirmed) return;

    try {
      const result = await window.electronAPI.deleteSalesScheduledMessages(selectedMessages);
      if (result.success) {
        setSnackbar({
          open: true,
          message: `Successfully deleted ${selectedMessages.length} message(s)`,
          severity: 'success'
        });
        setSelectedMessages([]);
        handleManualRefresh();
      } else {
        throw new Error(result.message || 'Failed to delete messages');
      }
    } catch (error) {
      console.error('Error deleting messages:', error);
      setSnackbar({
        open: true,
        message: `Error: ${error.message || 'Failed to delete messages'}`,
        severity: 'error'
      });
    }
  };

  // Handle cancel selected messages
  const handleCancelSelected = async () => {
    if (selectedMessages.length === 0) {
      return;
    }
    
    // Filter only messages that can be canceled
    const cancelableMessages = messages
      .filter(m => m.status === 'SCHEDULED' && selectedMessages.includes(m.id))
      .map(m => m.id);
    
    if (cancelableMessages.length === 0) {
      alert('None of the selected messages can be canceled. Only scheduled messages can be canceled.');
      return;
    }
    
    if (window.confirm(`Are you sure you want to cancel ${cancelableMessages.length} selected messages?`)) {
      try {
        // Cancel each message
        const promises = cancelableMessages.map(messageId => 
          window.electronAPI.cancelSalesScheduledMessage(messageId)
        );
        
        await Promise.all(promises);
        
        // Reset selection
        setSelectedMessages([]);
        setSelectAll(false);
        
        // Reload data
        loadMessages();
        loadStatistics();
      } catch (error) {
        console.error('Error canceling messages:', error);
      }
    }
  };
  
  // Manual refresh that maintains scroll position and active element
  const handleManualRefresh = () => {
    // Store the current scroll position before updating
    const scrollPosition = window.scrollY;
    
    // Store the current selected items to maintain selection
    const currentSelectedMessages = [...selectedMessages];
    
    // Record currently focused element if any
    const activeElement = document.activeElement;
    const activeElementId = activeElement ? activeElement.id : null;
    const activeElementTagName = activeElement ? activeElement.tagName : null;
    const activeElementIndex = activeElement ? Array.from(document.querySelectorAll(activeElementTagName)).indexOf(activeElement) : -1;
    
    // Also store the cursor position if it's an input or textarea
    let selectionStart = null;
    let selectionEnd = null;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      selectionStart = activeElement.selectionStart;
      selectionEnd = activeElement.selectionEnd;
    }
    
    // Load fresh data
    loadMessages().then(() => {
      // Restore selection state
      setSelectedMessages(currentSelectedMessages);
      
      // Use double requestAnimationFrame for more reliable DOM updates
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // First restore scroll position precisely
          window.scrollTo({
            top: scrollPosition,
            behavior: 'instant' // Use instant to avoid any animation
          });
          
          // Then try to restore focus using multiple strategies
          if (activeElementId && document.getElementById(activeElementId)) {
            // If we have an ID, use that first (most reliable)
            const elementToFocus = document.getElementById(activeElementId);
            elementToFocus.focus();
            
            // Restore cursor position if applicable
            if ((elementToFocus.tagName === 'INPUT' || elementToFocus.tagName === 'TEXTAREA') && 
                selectionStart !== null && selectionEnd !== null) {
              elementToFocus.setSelectionRange(selectionStart, selectionEnd);
            }
          } else if (activeElementTagName && activeElementIndex >= 0) {
            // Fall back to tag name and index
            const elements = document.querySelectorAll(activeElementTagName);
            if (elements.length > activeElementIndex) {
              elements[activeElementIndex].focus();
            }
          }
        });
      });
    });
    
    loadStatistics();
  };
  
  // Get time period display name
  const getTimePeriodDisplayName = () => {
    switch (timePeriod) {
      case 'today':
        return 'Today';
      case 'this_week':
        return 'This Week';
      case 'this_month':
        return 'This Month';
      case 'this_year':
        return 'This Year';
      case 'custom':
        return filters.startDate && filters.endDate ? 
          `${filters.startDate.toLocaleDateString()} - ${filters.endDate.toLocaleDateString()}` : 
          'Custom Range';
      case 'all':
      default:
        return 'All Time';
    }
  };
  
  // Prepare chart data
  const chartData = statistics ? {
    labels: ['Scheduled', 'Sent', 'Delivered', 'Read', 'Failed', 'Canceled'],
    datasets: [
      {
        label: 'Message Status',
        data: [
          (statistics.statusCounts && statistics.statusCounts.SCHEDULED) || 0,
          (statistics.statusCounts && statistics.statusCounts.SENT) || 0,
          (statistics.statusCounts && statistics.statusCounts.DELIVERED) || 0,
          (statistics.statusCounts && statistics.statusCounts.READ) || 0,
          (statistics.statusCounts && statistics.statusCounts.FAILED) || 0,
          (statistics.statusCounts && statistics.statusCounts.CANCELED) || 0
        ],
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(255, 99, 132, 0.6)',
          'rgba(255, 159, 64, 0.6)'
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 159, 64, 1)'
        ],
        borderWidth: 1
      }
    ]
  } : {
    labels: ['Scheduled', 'Sent', 'Delivered', 'Read', 'Failed', 'Canceled'],
    datasets: [
      {
        label: 'Message Status',
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(255, 99, 132, 0.6)',
          'rgba(255, 159, 64, 0.6)'
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 159, 64, 1)'
        ],
        borderWidth: 1
      }
    ]
  };

  // Chart options
  const chartOptions = {
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    },
    plugins: {
      legend: {
        display: false
      }
    },
    maintainAspectRatio: false
  };



  return (
    <div className="card dashboard-card" style={{ marginBottom: '1rem' }}>
      <div className="card-body">
        <h2 className="card-title" style={{ color: colors.primary }}>
          Scheduled Sales Messages
        </h2>

        {/* Auto-refresh controls */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center">
            <div className="form-check form-switch me-3">
              <input
                className="form-check-input"
                type="checkbox"
                id="autoRefresh"
                checked={autoRefresh}
                onChange={handleAutoRefreshChange}
              />
              <label className="form-check-label" htmlFor="autoRefresh">
                Auto-refresh
              </label>
            </div>
            <div className="d-flex align-items-center">
              <label htmlFor="refreshInterval" className="me-2">Every</label>
              <select
                id="refreshInterval"
                className="form-select form-select-sm"
                value={refreshInterval}
                onChange={handleRefreshIntervalChange}
                style={{ width: 'auto' }}
              >
                <option value="5">5 seconds</option>
                <option value="10">10 seconds</option>
                <option value="15">15 seconds</option>
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
              </select>
            </div>
            <button
              className="btn btn-sm ms-2"
              style={{ backgroundColor: colors.primary, color: colors.textOnPrimary }}
              onClick={handleManualRefresh}
            >
              <i className="bi bi-arrow-clockwise me-1"></i> Refresh Now
            </button>
            
            {/* Add Delete Selected button in the main toolbar */}
            <button
              className="btn btn-sm ms-2"
              style={{ 
                backgroundColor: selectedMessages.length > 0 ? colors.danger : '#6c757d',
                color: colors.textOnDanger,
                opacity: selectedMessages.length > 0 ? 1 : 0.65
              }}
              onClick={handleDeleteSelected}
              disabled={selectedMessages.length === 0}
            >
              <i className="bi bi-trash me-1"></i> Delete Selected ({selectedMessages.length})
            </button>
          </div>

          {/* Time Period Selector */}
          <div className="d-flex align-items-center">
            <div className="me-2">Time Period:</div>
            <div className="d-flex">
              <select
                className="form-select form-select-sm me-2"
                value={timePeriod}
                onChange={handleTimePeriodChange}
                style={{ width: 'auto' }}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="this_year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
              {timePeriod === 'custom' && (
                <DatePicker
                  selected={filters.startDate}
                  onChange={handleDateChange}
                  startDate={filters.startDate}
                  endDate={filters.endDate}
                  selectsRange
                  className="form-control form-control-sm"
                  placeholderText="Select date range"
                  dateFormat="MM/dd/yyyy"
                />
              )}
            </div>
          </div>
        </div>

        {/* Statistics */}
        {statsLoading ? (
          <div className="d-flex justify-content-center my-4">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading statistics...</span>
            </div>
          </div>
        ) : (
          <div className="row mb-4">
            <div className="col-md-8">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Message Status Distribution</h5>
                  <div style={{ height: '250px' }}>
                    {chartData && (
                      <Bar data={chartData} options={chartOptions} />
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Statistics Summary</h5>
                  <p className="mb-1"><strong>Total Messages:</strong> {statistics?.totalMessages || 0}</p>
                  <hr />
                  <h6>By Message Type</h6>
                  <p className="mb-1"><strong>First Messages:</strong> {statistics?.messageNumberCounts?.[1] || 0}</p>
                  <p className="mb-1"><strong>Second Messages:</strong> {statistics?.messageNumberCounts?.[2] || 0}</p>
                  <hr />
                  <h6>By Status</h6>
                  <p className="mb-1"><strong>Scheduled:</strong> {statistics?.statusCounts?.SCHEDULED || 0}</p>
                  <p className="mb-1"><strong>Sent:</strong> {statistics?.statusCounts?.SENT || 0}</p>
                  <p className="mb-1"><strong>Delivered:</strong> {statistics?.statusCounts?.DELIVERED || 0}</p>
                  <p className="mb-1"><strong>Read:</strong> {statistics?.statusCounts?.READ || 0}</p>
                  <p className="mb-1"><strong>Failed/Canceled:</strong> {(statistics?.statusCounts?.FAILED || 0) + (statistics?.statusCounts?.CANCELED || 0)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Filters */}
        <div className="row mb-3">
          <div className="col-md-3">
            <label htmlFor="statusFilter" className="form-label">Status</label>
            <select 
              id="statusFilter"
              name="status"
              className="form-select"
              value={filters.status}
              onChange={handleFilterChange}
            >
              <option value="ALL">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="SCHEDULED_FUTURE">Scheduled Future</option>
              <option value="PENDING_FIRST_MESSAGE">Pending First Message</option>
              <option value="SENDING">Sending</option>
              <option value="SENT">Sent</option>
              <option value="DELIVERED">Delivered</option>
              <option value="READ">Read</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </div>
          <div className="col-md-3">
            <label htmlFor="messageNumberFilter" className="form-label">Message Number</label>
            <select 
              id="messageNumberFilter"
              name="messageNumber"
              className="form-select"
              value={filters.messageNumber}
              onChange={handleFilterChange}
            >
              <option value="">All Messages</option>
              <option value="1">First Messages</option>
              <option value="2">Second Messages</option>
            </select>
          </div>
          <div className="col-md-6 d-flex align-items-end justify-content-end">
            {selectedMessages.length > 0 && (
              <>
                <button
                  className="btn me-2"
                  style={{ backgroundColor: colors.danger, color: colors.textOnDanger }}
                  onClick={handleDeleteSelected}
                >
                  Delete Selected ({selectedMessages.length})
                </button>
                <button
                  className="btn"
                  style={{ backgroundColor: colors.secondary, color: colors.textOnSecondary }}
                  onClick={handleCancelSelected}
                >
                  Cancel Selected
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Messages Table */}
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedMessages.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Msg #</th>
                <th>Status</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Scheduled Time</th>
                <th>Status Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center">
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center">No scheduled messages found</td>
                </tr>
              ) : (
                messages.map(message => (
                  <tr key={message.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedMessages.includes(message.id)}
                        onChange={() => handleSelectRow(message.id)}
                      />
                    </td>
                    <td>{message.messageNumber}</td>
                    <td>
                      <div className="d-flex flex-column">
                        <span className={getStatusBadgeColor(message.status)}>
                          {message.status}
                        </span>
                        <small className="text-muted mt-1">
                          {message.status === 'SCHEDULED' && message.scheduledTime && formatDate(message.scheduledTime)}
                          {message.status === 'SENDING' && message.sendingTime && formatDate(message.sendingTime)}
                          {message.status === 'SENT' && message.sentTime && formatDate(message.sentTime)}
                          {message.status === 'DELIVERED' && message.deliveredTime && formatDate(message.deliveredTime)}
                          {message.status === 'READ' && message.readTime && formatDate(message.readTime)}
                          {message.status === 'FAILED' && message.failedTime && formatDate(message.failedTime)}
                          {message.status === 'CANCELED' && message.canceledTime && formatDate(message.canceledTime)}
                        </small>
                      </div>
                    </td>
                    <td>{message.customerName}</td>
                    <td>{message.phoneNumber}</td>
                    <td>{formatDate(message.scheduledTime)}</td>
                    <td>
                      <div className="d-flex flex-column">
                        {message.scheduledTime && (
                          <small>
                            <strong>SCHEDULED:</strong> {formatDate(message.scheduledTime)}
                          </small>
                        )}
                        {message.sendingTime && (
                          <small>
                            <strong>SENDING:</strong> {formatDate(message.sendingTime)}
                          </small>
                        )}
                        {message.sentTime && (
                          <small>
                            <strong>SENT:</strong> {formatDate(message.sentTime)}
                          </small>
                        )}
                        {message.deliveredTime && (
                          <small>
                            <strong>DELIVERED:</strong> {formatDate(message.deliveredTime)}
                          </small>
                        )}
                        {message.readTime && (
                          <small>
                            <strong>READ:</strong> {formatDate(message.readTime)}
                          </small>
                        )}
                        {message.failedTime && (
                          <small>
                            <strong>FAILED:</strong> {formatDate(message.failedTime)}
                          </small>
                        )}
                        {message.canceledTime && (
                          <small>
                            <strong>CANCELED:</strong> {formatDate(message.canceledTime)}
                          </small>
                        )}
                      </div>
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm"
                        style={{ backgroundColor: colors.primary, color: colors.textOnPrimary }}
                        onClick={() => handleViewMessage(message)}
                        title="View Message"
                      >
                        View
                      </button>
                      {message.status === 'SCHEDULED' && (
                        <button 
                          className="btn btn-sm ms-1"
                          style={{ backgroundColor: colors.secondary, color: colors.textOnSecondary }}
                          onClick={() => {
                            if (window.confirm('Are you sure you want to cancel this message?')) {
                              window.electronAPI.cancelSalesScheduledMessage(message.id)
                                .then(() => {
                                  loadMessages();
                                  loadStatistics();
                                })
                                .catch(error => {
                                  console.error('Error canceling message:', error);
                                });
                            }
                          }}
                          title="Cancel Message"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
                         <div className="d-flex align-items-center">
               <span className="me-2">Go to page:</span>
               <form 
                 onSubmit={(e) => {
                   e.preventDefault();
                   const page = parseInt(e.target.pageNumber.value);
                   if (page > 0 && page <= pagination.totalPages) {
                     handlePageChange(page);
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
                   max={pagination.totalPages} 
                   placeholder="Page #"
                   style={{ width: '70px' }}
                 />
                 <button type="submit" className="btn btn-sm btn-outline-primary me-2">Go</button>
               </form>
               <span className="text-muted">
                 (Page {pagination.page} of {pagination.totalPages})
               </span>
             </div>
            
            <nav aria-label="Message pagination">
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(1)}
                    disabled={pagination.page === 1}
                  >
                    &laquo;
                  </button>
                </li>
                <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    &lt;
                  </button>
                </li>
                
                <li className={`page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    &gt;
                  </button>
                </li>
                <li className={`page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(pagination.totalPages)}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    &raquo;
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      
        {/* Message Detail Modal */}
        {showModal && modalMessage && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Message Details</h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setShowModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <h6>Customer Information</h6>
                    <p><strong>Name:</strong> {modalMessage.customerName}</p>
                    <p><strong>Phone:</strong> {modalMessage.phoneNumber}</p>
                  </div>
                  <div className="mb-3">
                    <h6>Message Information</h6>
                    <p><strong>Message Type:</strong> {modalMessage.messageNumber === 1 ? 'First Message' : 'Second Message'}</p>
                    <p><strong>Current Status:</strong> <span className={getStatusBadgeColor(modalMessage.status)}>{modalMessage.status}</span></p>
                    
                    <h6 className="mt-3">Status Timeline</h6>
                    <div className="list-group">
                      {modalMessage.scheduledTime && (
                        <div className="list-group-item">
                          <div className="d-flex w-100 justify-content-between">
                            <h6 className="mb-1">SCHEDULED</h6>
                            <small>{formatDate(modalMessage.scheduledTime)}</small>
                          </div>
                        </div>
                      )}
                      {modalMessage.sendingTime && (
                        <div className="list-group-item">
                          <div className="d-flex w-100 justify-content-between">
                            <h6 className="mb-1">SENDING</h6>
                            <small>{formatDate(modalMessage.sendingTime)}</small>
                          </div>
                        </div>
                      )}
                      {modalMessage.sentTime && (
                        <div className="list-group-item">
                          <div className="d-flex w-100 justify-content-between">
                            <h6 className="mb-1">SENT</h6>
                            <small>{formatDate(modalMessage.sentTime)}</small>
                          </div>
                        </div>
                      )}
                      {modalMessage.deliveredTime && (
                        <div className="list-group-item">
                          <div className="d-flex w-100 justify-content-between">
                            <h6 className="mb-1">DELIVERED</h6>
                            <small>{formatDate(modalMessage.deliveredTime)}</small>
                          </div>
                        </div>
                      )}
                      {modalMessage.readTime && (
                        <div className="list-group-item">
                          <div className="d-flex w-100 justify-content-between">
                            <h6 className="mb-1">READ</h6>
                            <small>{formatDate(modalMessage.readTime)}</small>
                          </div>
                        </div>
                      )}
                      {modalMessage.failedTime && (
                        <div className="list-group-item">
                          <div className="d-flex w-100 justify-content-between">
                            <h6 className="mb-1">FAILED</h6>
                            <small>{formatDate(modalMessage.failedTime)}</small>
                          </div>
                        </div>
                      )}
                      {modalMessage.canceledTime && (
                        <div className="list-group-item">
                          <div className="d-flex w-100 justify-content-between">
                            <h6 className="mb-1">CANCELED</h6>
                            <small>{formatDate(modalMessage.canceledTime)}</small>
                          </div>
                          {modalMessage.cancelReason && (
                            <small className="text-muted">Reason: {modalMessage.cancelReason}</small>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mb-3">
                    <h6>Message Content</h6>
                    <div className="border p-2 rounded bg-light">
                      {modalMessage.messageContent}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn"
                    style={{ backgroundColor: colors.secondary, color: colors.textOnSecondary }}
                    onClick={() => setShowModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesScheduledMessages; 
import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const SalesAPI = () => {
  const { colors, theme } = useTheme();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalPages: 1,
    totalSales: 0
  });
  const [filters, setFilters] = useState({
    town: 'all',
    search: '',
    startDate: null,
    endDate: null
  });
  const [towns, setTowns] = useState(['all']);
  const [selectedSales, setSelectedSales] = useState([]);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [timeUntilNextFetch, setTimeUntilNextFetch] = useState(120);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentSale, setCurrentSale] = useState(null);
  const [selectAll, setSelectAll] = useState(false);

  // Function to format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Function to load sales
  const loadSales = useCallback(async () => {
    try {
      setLoading(true);
      const response = await window.electronAPI.getSales(
        pagination.page,
        pagination.limit,
        filters
      );
      
      if (response.success) {
        setSales(response.sales);
        setPagination(response.pagination);
      } else {
        console.error('Failed to load sales:', response.error);
      }
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  // Function to load towns
  const loadTowns = useCallback(async () => {
    try {
      const response = await window.electronAPI.getSalesTowns();
      if (response.success && response.towns.length > 0) {
        setTowns(['all', ...response.towns]);
      }
    } catch (error) {
      console.error('Error loading towns:', error);
    }
  }, []);

  // Function to get last fetch time
  const getLastFetchTime = useCallback(async () => {
    try {
      const response = await window.electronAPI.getLastFetchTime();
      if (response.success && response.lastFetchTime) {
        setLastFetchTime(response.lastFetchTime);
      }
    } catch (error) {
      console.error('Error getting last fetch time:', error);
    }
  }, []);

  // Timer for countdown
  useEffect(() => {
    // Only set up timer if we have a lastFetchTime
    if (lastFetchTime) {
      const interval = setInterval(() => {
        const now = new Date();
        const lastFetch = new Date(lastFetchTime);
        const elapsedSeconds = Math.floor((now - lastFetch) / 1000);
        const remainingSeconds = Math.max(0, 120 - (elapsedSeconds % 120));
        setTimeUntilNextFetch(remainingSeconds);
        
        // Auto-fetch when timer reaches zero
        if (remainingSeconds === 0) {
          window.electronAPI.fetchSalesNow()
            .then(response => {
              if (response.success) {
                getLastFetchTime();
                loadSales();
              }
            })
            .catch(error => {
              console.error('Error auto-fetching sales:', error);
            });
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [lastFetchTime, getLastFetchTime, loadSales]);

  // Initial data loading
  useEffect(() => {
    const initialize = async () => {
      await loadTowns();
      await getLastFetchTime();
      await loadSales();
    };
    
    initialize();
  }, [loadTowns, getLastFetchTime, loadSales]);

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
    // Reset to first page when filter changes
    setPagination({
      ...pagination,
      page: 1
    });
  };

  // Handle row selection
  const handleSelectRow = (id) => {
    if (selectedSales.includes(id)) {
      setSelectedSales(selectedSales.filter(saleId => saleId !== id));
    } else {
      setSelectedSales([...selectedSales, id]);
    }
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedSales([]);
    } else {
      // Select all sales across all pages
      window.electronAPI.getSales(1, 10000, filters)
        .then(response => {
          if (response.success) {
            setSelectedSales(response.sales.map(sale => sale.id));
          }
        })
        .catch(error => {
          console.error('Error selecting all sales:', error);
        });
    }
    setSelectAll(!selectAll);
  };

  // Handle delete selected
  const handleDeleteSelected = async () => {
    if (selectedSales.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedSales.length} sales?`)) {
      try {
        setLoading(true);
        const response = await window.electronAPI.deleteSales(selectedSales);
        
        if (response.success) {
          setSelectedSales([]);
          setSelectAll(false);
          await loadSales();
        }
      } catch (error) {
        console.error('Error deleting sales:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle edit sale
  const handleEditSale = (sale) => {
    setCurrentSale(sale);
    setShowEditModal(true);
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!currentSale) return;
    
    try {
      setLoading(true);
      const response = await window.electronAPI.updateSale(currentSale.id, currentSale);
      
      if (response.success) {
        setShowEditModal(false);
        await loadSales();
      }
    } catch (error) {
      console.error('Error updating sale:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change in edit modal
  const handleEditInputChange = (e, field, subfield = null) => {
    const { value } = e.target;
    
    if (subfield) {
      setCurrentSale({
        ...currentSale,
        [field]: {
          ...currentSale[field],
          [subfield]: value
        }
      });
    } else {
      setCurrentSale({
        ...currentSale,
        [field]: value
      });
    }
  };

  return (
    <div className="card dashboard-card" style={{ marginBottom: '1rem' }}>
      <div className="card-body">
        <h2 className="card-title" style={{ color: colors.primary }}>
          Sales API
        </h2>
        
        {/* Fetch status and timer */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <span>Last fetch: {lastFetchTime ? formatDate(lastFetchTime) : 'Never'}</span>
            <span className="ms-3">Next fetch in: {Math.floor(timeUntilNextFetch / 60)}:{(timeUntilNextFetch % 60).toString().padStart(2, '0')}</span>
          </div>
        </div>
        
        {/* Filters */}
        <div className="row mb-3">
          <div className="col-md-3">
            <label htmlFor="townFilter" className="form-label">Town</label>
            <select 
              id="townFilter"
              name="town"
              className="form-select"
              value={filters.town}
              onChange={handleFilterChange}
            >
              <option value="all">All Towns</option>
              <option value="tirane">Tirane</option>
              <option value="fier">Fier</option>
              <option value="vlore">Vlore</option>
            </select>
          </div>
          <div className="col-md-4">
            <label htmlFor="dateFilter" className="form-label">Date Range</label>
            <DatePicker
              id="dateFilter"
              selected={filters.startDate}
              onChange={handleDateChange}
              startDate={filters.startDate}
              endDate={filters.endDate}
              selectsRange
              className="form-control"
              placeholderText="Select date range"
              dateFormat="MM/dd/yyyy"
            />
          </div>
          <div className="col-md-5">
            <label htmlFor="searchFilter" className="form-label">Search</label>
            <input
              id="searchFilter"
              name="search"
              type="text"
              className="form-control"
              placeholder="Search sales..."
              value={filters.search}
              onChange={handleFilterChange}
            />
          </div>
        </div>
        
        {/* Delete selected button */}
        <div className="mb-3">
          <button
            className="btn btn-sm btn-danger"
            onClick={handleDeleteSelected}
            disabled={selectedSales.length === 0}
          >
            Delete Selected ({selectedSales.length})
          </button>
        </div>
        
        {/* Sales table */}
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Document #</th>
                <th>Date</th>
                <th>Fetch Date</th>
                <th>Customer</th>
                <th>Town</th>
                <th>Phone</th>
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
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center">No sales found</td>
                </tr>
              ) : (
                sales.map(sale => (
                  <tr key={sale.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedSales.includes(sale.id)}
                        onChange={() => handleSelectRow(sale.id)}
                      />
                    </td>
                    <td>{sale.documentNumber}</td>
                    <td>{formatDate(sale.documentDate)}</td>
                    <td>{formatDate(sale.fetchDate)}</td>
                    <td>{sale.businessEntity.name}</td>
                    <td>{sale.businessEntity.town}</td>
                    <td>{sale.businessEntity.phone}</td>
                    <td>
                      <button
                        className="btn btn-sm"
                        style={{ backgroundColor: colors.secondary, color: colors.textOnSecondary }}
                        onClick={() => handleEditSale(sale)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="d-flex justify-content-between align-items-center">
          <div>
            Showing {sales.length} of {pagination.totalSales} sales
          </div>
          <div>
            <button
              className="btn btn-sm me-1"
              style={{ backgroundColor: colors.primary, color: colors.textOnPrimary }}
              disabled={pagination.page === 1}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              Previous
            </button>
            <span className="mx-2">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              className="btn btn-sm ms-1"
              style={{ backgroundColor: colors.primary, color: colors.textOnPrimary }}
              disabled={pagination.page === pagination.totalPages}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
      
      {/* Edit Modal */}
      {showEditModal && currentSale && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Sale</h5>
                <button type="button" className="btn-close" onClick={() => setShowEditModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Document Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={currentSale.documentNumber || ''}
                    onChange={(e) => handleEditInputChange(e, 'documentNumber')}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Customer Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={currentSale.businessEntity.name || ''}
                    onChange={(e) => handleEditInputChange(e, 'businessEntity', 'name')}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Town</label>
                  <input
                    type="text"
                    className="form-control"
                    value={currentSale.businessEntity.town || ''}
                    onChange={(e) => handleEditInputChange(e, 'businessEntity', 'town')}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    className="form-control"
                    value={currentSale.businessEntity.phone || ''}
                    onChange={(e) => handleEditInputChange(e, 'businessEntity', 'phone')}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn"
                  style={{ backgroundColor: colors.primary, color: colors.textOnPrimary }}
                  onClick={handleSaveEdit}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesAPI; 
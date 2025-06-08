import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import BulkContactsImportExport from './BulkContactsImportExport';

const BulkContacts = () => {
  const { colors } = useTheme();
  const [contacts, setContacts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [addContactLoading, setAddContactLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [activeView, setActiveView] = useState('contacts'); // contacts, add, edit, import, importPreview, export
  const [contactToEdit, setContactToEdit] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    email: '',
    phone: '',
    birthday: ''
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Import-related state
  const [importFile, setImportFile] = useState(null);
  const [importedContacts, setImportedContacts] = useState([]);
  const [validContacts, setValidContacts] = useState([]);
  const [skippedContacts, setSkippedContacts] = useState([]);
  const [importTab, setImportTab] = useState('valid');
  const [exportFormat, setExportFormat] = useState('json');
  
  // Load contacts on component mount and when pagination/search changes
  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await window.electronAPI.getContacts(
        pagination.page,
        pagination.limit,
        search
      );
      
      if (response.success) {
        setContacts(response.contacts);
        setPagination(response.pagination);
      } else {
        setError(response.error || 'Failed to load contacts');
      }
    } catch (err) {
      setError('Error loading contacts: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search]);
  
  // Separate function for search to avoid circular dependencies
  const performSearch = useCallback(async () => {
    try {
      const response = await window.electronAPI.getContacts(
        1, // Reset to first page on search
        pagination.limit,
        search
      );
      
      if (response.success) {
        setContacts(response.contacts);
        setPagination(prev => ({
          ...response.pagination,
          page: 1 // Ensure we're on first page
        }));
      } else {
        setError(response.error || 'Failed to load contacts');
      }
    } catch (err) {
      setError('Error loading contacts: ' + err.message);
    }
  }, [pagination.limit, search]);
  
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);
  
  // Reset selection when contacts change
  useEffect(() => {
    setSelectedContacts([]);
    setSelectAll(false);
  }, [contacts]);
  
  // Handle pagination
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };
  
  // Handle search
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };
  
  // Handle search submit (with debounce)
  const [searchTimeout, setSearchTimeout] = useState(null);
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Don't block the UI by setting the main loading state
    setSearchLoading(true);
    
    const timeout = setTimeout(async () => {
      try {
        await performSearch();
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    
    setSearchTimeout(timeout);
  };
  
  // Debounced search when search input changes
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Don't block the UI with the main loading state
    setSearchLoading(true);
    
    const timeout = setTimeout(async () => {
      try {
        await performSearch();
      } finally {
        setSearchLoading(false);
      }
    }, 500);
    
    setSearchTimeout(timeout);
    
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search, performSearch]);
  
  // Handle checkbox selection
  const toggleContactSelection = (contactId) => {
    setSelectedContacts(prev => {
      if (prev.includes(contactId)) {
        return prev.filter(id => id !== contactId);
      } else {
        return [...prev, contactId];
      }
    });
  };
  
  // Handle select all
  const toggleSelectAll = async () => {
    if (selectAll) {
      setSelectedContacts([]);
    } else {
      // Get all contact IDs from all pages
      setSelectAllLoading(true);
      try {
        const response = await window.electronAPI.getAllContactIds(search);
        if (response.success) {
          setSelectedContacts(response.contactIds);
          
          // Show how many contacts were selected
          setSuccessMessage(`Selected all ${response.contactIds.length} contacts`);
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setError(response.error || 'Failed to get all contacts');
        }
      } catch (err) {
        setError('Error getting all contacts: ' + err.message);
      } finally {
        setSelectAllLoading(false);
      }
    }
    setSelectAll(!selectAll);
  };
  
  // Handle delete selected contacts
  const handleDeleteSelected = async () => {
    if (selectedContacts.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedContacts.length} contact(s)?`)) {
      return;
    }
    
    setDeleteLoading(true);
    try {
      const response = await window.electronAPI.deleteContacts(selectedContacts);
      
      if (response.success) {
        setSuccessMessage(`Successfully deleted ${response.deletedCount} contact(s)`);
        loadContacts();
      } else {
        setError(response.error || 'Failed to delete contacts');
      }
    } catch (err) {
      setError('Error deleting contacts: ' + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };
  
  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Switch to add contact view
  const showAddContactForm = () => {
    setFormData({
      name: '',
      surname: '',
      email: '',
      phone: '',
      birthday: ''
    });
    setError('');
    setSuccessMessage('');
    setActiveView('add');
  };
  
  // Switch to edit contact view
  const showEditContactForm = (contact) => {
    setContactToEdit(contact);
    setFormData({
      name: contact.name || '',
      surname: contact.surname || '',
      email: contact.email || '',
      phone: contact.phone || '',
      birthday: contact.birthday || ''
    });
    setError('');
    setSuccessMessage('');
    setActiveView('edit');
  };
  
  // Handle add contact form submit
  const handleAddContact = async (e) => {
    e.preventDefault();
    
    if (!formData.phone) {
      setError('Phone number is required');
      return;
    }
    
    setAddContactLoading(true);
    try {
      const response = await window.electronAPI.addContact(formData);
      
      if (response.success) {
        setSuccessMessage('Contact added successfully');
        loadContacts();
        setActiveView('contacts');
      } else {
        setError(response.error || 'Failed to add contact');
      }
    } catch (err) {
      setError('Error adding contact: ' + err.message);
    } finally {
      setAddContactLoading(false);
    }
  };
  
  // Handle edit contact form submit
  const handleUpdateContact = async (e) => {
    e.preventDefault();
    
    if (!formData.phone) {
      setError('Phone number is required');
      return;
    }
    
    setAddContactLoading(true);
    try {
      const response = await window.electronAPI.updateContact(contactToEdit.id, formData);
      
      if (response.success) {
        setSuccessMessage('Contact updated successfully');
        loadContacts();
        setActiveView('contacts');
      } else {
        setError(response.error || 'Failed to update contact');
      }
    } catch (err) {
      setError('Error updating contact: ' + err.message);
    } finally {
      setAddContactLoading(false);
    }
  };
  
  // Format phone number for display
  const formatPhone = (phone) => {
    return phone || 'N/A';
  };
  
  // Render contact form (used for both add and edit)
  const renderContactForm = () => {
    return (
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">{activeView === 'add' ? 'Add New Contact' : 'Edit Contact'}</h5>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setActiveView('contacts')}
          >
            Back to Contacts
          </button>
        </div>
        <div className="card-body">
          {error && <div className="alert alert-danger">{error}</div>}
          {successMessage && <div className="alert alert-success">{successMessage}</div>}
          
          <form onSubmit={activeView === 'add' ? handleAddContact : handleUpdateContact}>
            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="name" className="form-label">Name</label>
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="surname" className="form-label">Surname</label>
                <input
                  type="text"
                  className="form-control"
                  id="surname"
                  name="surname"
                  value={formData.surname}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            
            <div className="mb-3">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="mb-3">
              <label htmlFor="phone" className="form-label">Phone Number*</label>
              <input
                type="text"
                className="form-control"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
              />
              <div className="form-text">Phone number is required</div>
            </div>
            
            <div className="mb-3">
              <label htmlFor="birthday" className="form-label">Birthday</label>
              <input
                type="date"
                className="form-control"
                id="birthday"
                name="birthday"
                value={formData.birthday || ''}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="d-grid gap-2 d-md-flex justify-content-md-end">
              <button
                type="button"
                className="btn btn-secondary me-md-2"
                onClick={() => setActiveView('contacts')}
                disabled={addContactLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={addContactLoading}
                style={{
                  backgroundColor: colors.primary,
                  borderColor: colors.primaryDark
                }}
              >
                {addContactLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Processing...
                  </>
                ) : activeView === 'add' ? 'Add Contact' : 'Update Contact'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };
  
  // Render contacts table
  const renderContactsTable = () => {
    return (
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center flex-wrap">
          <h5 className="mb-0">Contacts</h5>
          <div className="d-flex flex-wrap mt-2 mt-md-0">
            <button
              className="btn btn-sm btn-success me-2 mb-2 mb-md-0"
              onClick={showAddContactForm}
            >
              <i className="bi bi-plus-circle me-1"></i> Add Contact
            </button>
            <button
              className="btn btn-sm btn-primary me-2 mb-2 mb-md-0"
              onClick={() => setActiveView('import')}
              style={{
                backgroundColor: colors.primary,
                borderColor: colors.primaryDark
              }}
            >
              <i className="bi bi-upload me-1"></i> Import Contacts
            </button>
            <button
              className="btn btn-sm btn-secondary me-2 mb-2 mb-md-0"
              onClick={() => setActiveView('export')}
            >
              <i className="bi bi-download me-1"></i> Export Contacts
            </button>
            {selectedContacts.length > 0 && (
              <button
                className="btn btn-sm btn-danger mb-2 mb-md-0"
                onClick={handleDeleteSelected}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                ) : (
                  <i className="bi bi-trash me-1"></i>
                )}
                Delete Selected
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
          {error && <div className="alert alert-danger">{error}</div>}
          {successMessage && <div className="alert alert-success">{successMessage}</div>}
          
          <div className="mb-3">
            <form onSubmit={handleSearchSubmit}>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search contacts..."
                  value={search}
                  onChange={handleSearchChange}
                />
                <button 
                  className="btn btn-outline-secondary" 
                  type="submit"
                  disabled={searchLoading}
                >
                  {searchLoading ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  ) : (
                    <i className="bi bi-search"></i>
                  )}
                </button>
              </div>
            </form>
          </div>
          
          {loading ? (
            <div className="d-flex justify-content-center my-5">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center my-5">
              <p>No contacts found. {search && 'Try a different search term or'} Add a new contact to get started.</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={selectAll}
                            onChange={toggleSelectAll}
                            disabled={selectAllLoading}
                          />
                          {selectAllLoading && (
                            <span className="ms-2 spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          )}
                        </div>
                      </th>
                      <th>Name</th>
                      <th>Surname</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Birthday</th>
                      <th>Source</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(contact => (
                      <tr key={contact.id}>
                        <td>
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={selectedContacts.includes(contact.id)}
                              onChange={() => toggleContactSelection(contact.id)}
                            />
                          </div>
                        </td>
                        <td>{contact.name || 'N/A'}</td>
                        <td>{contact.surname || 'N/A'}</td>
                        <td>{contact.email || 'N/A'}</td>
                        <td>{formatPhone(contact.phone)}</td>
                        <td>{contact.birthday || 'N/A'}</td>
                        <td>{contact.source || 'N/A'}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={() => showEditContactForm(contact)}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => {
                              setSelectedContacts([contact.id]);
                              handleDeleteSelected();
                            }}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination controls */}
              {pagination.totalPages > 1 && (
                <nav className="d-flex justify-content-center mt-4">
                  <ul className="pagination">
                    <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(1)}
                      >
                        First
                      </button>
                    </li>
                    <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(pagination.page - 1)}
                      >
                        Previous
                      </button>
                    </li>
                    
                    {/* Current page indicator */}
                    <li className="page-item active">
                      <span className="page-link">
                        {pagination.page} of {pagination.totalPages}
                      </span>
                    </li>
                    
                    <li className={`page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(pagination.page + 1)}
                      >
                        Next
                      </button>
                    </li>
                    <li className={`page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(pagination.totalPages)}
                      >
                        Last
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
              
              {/* Items per page selector and page jump */}
              <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
                <div className="d-flex align-items-center mb-2 mb-md-0">
                  <span className="me-2">Items per page:</span>
                  <select 
                    className="form-select form-select-sm" 
                    value={pagination.limit}
                    onChange={(e) => {
                      const newLimit = parseInt(e.target.value);
                      setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
                    }}
                    style={{ width: 'auto' }}
                  >
                    <option value="10">10</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                    <option value="500">500</option>
                  </select>
                </div>
                
                <div className="d-flex align-items-center">
                  <span className="me-2">Go to page:</span>
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const page = parseInt(e.target.pageNumber.value);
                      if (page > 0 && page <= pagination.totalPages) {
                        handlePageChange(page);
                      }
                    }}
                    className="d-flex"
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
                    <button type="submit" className="btn btn-sm btn-outline-primary">Go</button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bulk-contacts-container">
      {activeView === 'contacts' && renderContactsTable()}
      {(activeView === 'add' || activeView === 'edit') && renderContactForm()}
      {(activeView === 'import' || activeView === 'export' || activeView === 'importPreview') && (
        <BulkContactsImportExport
          setActiveView={setActiveView}
          loadContacts={loadContacts}
          activeView={activeView}
          importedContacts={importedContacts}
          setImportedContacts={setImportedContacts}
          validContacts={validContacts}
          setValidContacts={setValidContacts}
          skippedContacts={skippedContacts}
          setSkippedContacts={setSkippedContacts}
          importTab={importTab}
          setImportTab={setImportTab}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
        />
      )}
    </div>
  );
};

export default BulkContacts; 
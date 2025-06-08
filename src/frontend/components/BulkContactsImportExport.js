import React, { useState, useEffect } from 'react';
import { useTheme } from './ThemeContext';

const BulkContactsImportExport = ({ 
  setActiveView, 
  loadContacts, 
  activeView, 
  importedContacts, 
  setImportedContacts,
  validContacts, 
  setValidContacts,
  skippedContacts, 
  setSkippedContacts,
  importTab, 
  setImportTab,
  exportFormat, 
  setExportFormat
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editingContact, setEditingContact] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    surname: '',
    email: '',
    phone: '',
    birthday: ''
  });
  const [previewPagination, setPreviewPagination] = useState({
    page: 1,
    limit: 100,
    totalPages: 1
  });
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fileLoadTime: 0,
    processingTime: 0,
    totalTime: 0
  });
  const [importProgress, setImportProgress] = useState({
    status: '',
    step: '',
    progress: 0
  });
  
  // Handle importing a file by path
  const handleImportFile = async (filePath) => {
    try {
      if (!filePath) {
        setError('No file path provided');
        setLoading(false);
        return;
      }
      
      setSuccessMessage(`Loading file: ${filePath}`);
      console.log('Importing file:', filePath);
      
      // Start tracking performance
      const startTime = Date.now();
      
      // Set initial progress
      setImportProgress({
        status: 'active',
        step: 'Loading file',
        progress: 10
      });
      
      // Pass the file path directly as a string, not in an object
      const importResponse = await window.electronAPI.importContactsFile(filePath);
      
      // File loading complete
      const fileLoadTime = Date.now() - startTime;
      
      if (!importResponse.success) {
        setError(importResponse.error || 'Failed to import contacts');
        setLoading(false);
        return;
      }
      
      setImportProgress({
        status: 'active',
        step: 'Processing contacts',
        progress: 40
      });
      
      setImportedContacts(importResponse.contacts);
      
      // For large files, show a more detailed message
      if (importResponse.contacts.length > 1000) {
        setSuccessMessage(`Processing ${importResponse.contacts.length} contacts from ${importResponse.fileName}. This might take a moment...`);
      }
      
      // Use a small timeout to allow the UI to update
      setTimeout(() => {
        const processStartTime = Date.now();
        
        // Validate contacts and separate into valid and skipped
        const valid = [];
        const skipped = [];
        const phoneMap = new Map(); // For fast duplicate checking
        
        // Process contacts in batches for better UI responsiveness
        const batchSize = 1000;
        
        const processContactsBatch = (startIndex) => {
          const endIndex = Math.min(startIndex + batchSize, importResponse.contacts.length);
          
          // Update progress
          const progressPercentage = Math.floor((startIndex / importResponse.contacts.length) * 50) + 40;
          setImportProgress({
            status: 'active',
            step: `Processing contacts (${startIndex} of ${importResponse.contacts.length})`,
            progress: progressPercentage
          });
          
          for (let i = startIndex; i < endIndex; i++) {
            const contact = importResponse.contacts[i];
            
            // Create a processed contact with consistent fields
            const processedContact = {
              id: `temp_${Math.random().toString(36).substr(2, 9)}`,
              name: contact.name || null,
              surname: contact.surname || null,
              email: contact.email || null,
              phone: contact.phone ? contact.phone.toString().trim() : null,
              birthday: contact.birthday || null,
              source: `imported from ${importResponse.fileName}`,
              valid: true,
              duplicate: false,
              skipReason: null
            };
            
            // Check for required phone number
            if (!processedContact.phone) {
              processedContact.valid = false;
              processedContact.skipReason = 'Missing phone number';
              skipped.push(processedContact);
            } else {
              // Check for duplicates within the file
              if (phoneMap.has(processedContact.phone)) {
                processedContact.valid = false;
                processedContact.duplicate = true;
                processedContact.skipReason = 'Duplicate phone number in import file';
                skipped.push(processedContact);
              } else {
                phoneMap.set(processedContact.phone, true);
                valid.push(processedContact);
              }
            }
          }
          
          // Process next batch or finish
          if (endIndex < importResponse.contacts.length) {
            setTimeout(() => processContactsBatch(endIndex), 0);
          } else {
            // Processing complete
            const processTime = Date.now() - processStartTime;
            const totalTime = Date.now() - startTime;
            
            // Update performance metrics
            setPerformanceMetrics({
              fileLoadTime,
              processingTime: processTime,
              totalTime,
              contactsPerSecond: Math.floor(importResponse.contacts.length / (totalTime / 1000))
            });
            
            setValidContacts(valid);
            setSkippedContacts(skipped);
            setActiveView('importPreview');
            setImportTab('valid');
            setImportProgress({
              status: 'complete',
              step: 'Ready to import',
              progress: 100
            });
            
            setSuccessMessage(
              `Loaded ${importResponse.contacts.length} contacts from ${importResponse.fileName} ` +
              `(${valid.length} valid, ${skipped.length} skipped). ` +
              `Processing speed: ${Math.floor(importResponse.contacts.length / (totalTime / 1000))} contacts/second`
            );
            
            setLoading(false);
          }
        };
        
        // Start processing the first batch
        processContactsBatch(0);
        
      }, 50);
    } catch (err) {
      console.error('Error in handleImportFile:', err);
      setError('Error importing contacts: ' + (err.message || 'Unknown error'));
      setLoading(false);
    }
  };
  
  // Calculate paginated contacts based on current tab and pagination
  const getPaginatedContacts = () => {
    const contacts = importTab === 'valid' ? validContacts : skippedContacts;
    const { page, limit } = previewPagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return contacts.slice(startIndex, endIndex);
  };
  
  // Update pagination when contacts change
  useEffect(() => {
    const contacts = importTab === 'valid' ? validContacts : skippedContacts;
    setPreviewPagination(prev => ({
      ...prev,
      totalPages: Math.max(1, Math.ceil(contacts.length / prev.limit))
    }));
  }, [validContacts, skippedContacts, importTab]);
  
  // Reset pagination when tab changes
  useEffect(() => {
    setPreviewPagination(prev => ({
      ...prev,
      page: 1
    }));
  }, [importTab]);
  
  // Handle page change
  const handlePageChange = (newPage) => {
    setPreviewPagination(prev => ({
      ...prev,
      page: Math.max(1, Math.min(newPage, prev.totalPages))
    }));
  };
  
  // Handle import file selection using input element (legacy method - kept for backup)
  const handleFileSelect = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      
      setError('');
      setSuccessMessage('');
      setValidContacts([]);
      setSkippedContacts([]);
      setLoading(true);
      
      // Use file path if available
      if (file.path) {
        await handleImportFile(file.path);
      } else {
        setError('File path not available');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error in handleFileSelect:', err);
      setError('Error selecting file: ' + (err.message || 'Unknown error'));
      setLoading(false);
    }
  };
  
  // Handle import submit (after preview)
  const handleImportSubmit = async () => {
    if (validContacts.length === 0) {
      setError('No valid contacts to import');
      return;
    }
    
    setLoading(true);
    setError('');
    setImportProgress({
      status: 'active',
      step: 'Starting import',
      progress: 0
    });
    
    try {
      // For large imports, inform the user that this might take some time
      if (validContacts.length > 1000) {
        setSuccessMessage(`Importing ${validContacts.length} contacts. This might take some time for large imports...`);
      }
      
      const startTime = Date.now();
      const response = await window.electronAPI.importContacts(validContacts, true);
      const importTime = Date.now() - startTime;
      
      if (response.success) {
        const contactsPerSecond = Math.floor(response.added / (importTime / 1000));
        
        setSuccessMessage(
          `Successfully imported ${response.added} contacts ` +
          `(${response.skipped} skipped). ` +
          `Time: ${importTime}ms (${contactsPerSecond} contacts/second)`
        );
        
        // If we have performance metrics from the backend, show them
        if (response.performance) {
          setPerformanceMetrics({
            importTime: importTime,
            contactsPerSecond: contactsPerSecond,
            backendTime: response.performance.duration || 0
          });
        }
        
        // Load contacts with a slight delay to allow the backend to finish
        setTimeout(() => {
          loadContacts();
          setActiveView('contacts');
        }, 500);
      } else {
        setError(response.error || 'Failed to import contacts');
      }
    } catch (err) {
      setError('Error importing contacts: ' + err.message);
    } finally {
      setImportProgress({
        status: 'complete',
        step: 'Import complete',
        progress: 100
      });
      setLoading(false);
    }
  };
  
  // Handle export
  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await window.electronAPI.exportContacts(exportFormat);
      
      if (response.success) {
        setSuccessMessage(`Successfully exported contacts to ${response.fileName}`);
      } else {
        setError(response.error || 'Failed to export contacts');
      }
    } catch (err) {
      setError('Error exporting contacts: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Move contact between valid and skipped lists
  const moveContact = (contact, destination) => {
    if (destination === 'valid') {
      setValidContacts(prev => [...prev, contact]);
      setSkippedContacts(prev => prev.filter(c => c.id !== contact.id));
    } else {
      setSkippedContacts(prev => [...prev, contact]);
      setValidContacts(prev => prev.filter(c => c.id !== contact.id));
    }
  };
  
  // Edit contact in import preview
  const startEditing = (contact) => {
    setEditingContact(contact);
    setEditFormData({
      name: contact.name || '',
      surname: contact.surname || '',
      email: contact.email || '',
      phone: contact.phone || '',
      birthday: contact.birthday || ''
    });
  };
  
  // Handle edit form input change
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Save edited contact
  const saveEditedContact = () => {
    if (!editFormData.phone) {
      setError('Phone number is required');
      return;
    }
    
    // Check for duplicates in both lists
    const duplicateInValid = validContacts.some(c => 
      c.id !== editingContact.id && c.phone === editFormData.phone
    );
    const duplicateInSkipped = skippedContacts.some(c => 
      c.id !== editingContact.id && c.phone === editFormData.phone
    );
    
    if (duplicateInValid || duplicateInSkipped) {
      setError('Phone number already exists in the import list');
      return;
    }
    
    const updatedContact = {
      ...editingContact,
      name: editFormData.name || null,
      surname: editFormData.surname || null,
      email: editFormData.email || null,
      phone: editFormData.phone,
      birthday: editFormData.birthday || null
    };
    
    if (importTab === 'valid') {
      setValidContacts(prev => 
        prev.map(c => c.id === editingContact.id ? updatedContact : c)
      );
    } else {
      setSkippedContacts(prev => 
        prev.map(c => c.id === editingContact.id ? updatedContact : c)
      );
    }
    
    setEditingContact(null);
  };
  
  // Render import file selection view
  const renderImportView = () => {
    return (
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Import Contacts</h5>
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
          
          <div className="mb-4">
            <h6>Import from File</h6>
            <p>Select a CSV, Excel, or JSON file containing contacts data.</p>
            <p>The file should have columns matching these fields: name, surname, email, phone, birthday.</p>
            <p>Phone number is required for each contact.</p>
            
            <div className="mt-3">
              <button
                className="btn btn-primary"
                type="button"
                disabled={loading}
                onClick={async () => {
                  try {
                    setError('');
                    setSuccessMessage('');
                    setLoading(true);
                    
                    // Directly open the file dialog without using input element
                    const response = await window.electronAPI.openFileDialog({
                      title: 'Select Contacts File',
                      filters: [
                        { name: 'Contact Files', extensions: ['csv', 'xlsx', 'xls', 'json'] },
                        { name: 'All Files', extensions: ['*'] }
                      ],
                      properties: ['openFile']
                    });
                    
                    if (!response.success || !response.filePaths || response.filePaths.length === 0) {
                      // User cancelled or error occurred
                      setError(response.error || 'No file selected');
                      setLoading(false);
                      return;
                    }
                    
                    // Get the selected file path as a string
                    const selectedFilePath = response.filePaths[0];
                    console.log('Selected file path:', selectedFilePath);
                    
                    // Trigger the rest of the import process with the path string
                    await handleImportFile(selectedFilePath);
                  } catch (err) {
                    console.error('Error opening file dialog:', err);
                    setError('Error selecting file: ' + (err.message || 'Unknown error'));
                    setLoading(false);
                  }
                }}
                style={{
                  backgroundColor: colors.primary,
                  borderColor: colors.primaryDark
                }}
              >
                {loading ? 'Processing...' : 'Select File'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render export view
  const renderExportView = () => {
    return (
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Export Contacts</h5>
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
          
          <div className="mb-4">
            <h6>Export Format</h6>
            <p>Select a format to export your contacts.</p>
            
            <div className="mb-3">
              <select
                className="form-select"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                disabled={loading}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
              </select>
            </div>
            
            <button
              className="btn btn-primary"
              onClick={handleExport}
              disabled={loading}
              style={{
                backgroundColor: colors.primary,
                borderColor: colors.primaryDark
              }}
            >
              {loading ? 'Processing...' : 'Export Contacts'}
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Render import preview (valid and skipped contacts)
  const renderImportPreview = () => {
    const currentContacts = getPaginatedContacts();
    const totalContacts = importTab === 'valid' ? validContacts.length : skippedContacts.length;
    
    return (
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Import Preview</h5>
          <div>
            <button
              className="btn btn-sm btn-outline-secondary me-2"
              onClick={() => setActiveView('import')}
            >
              Back to Import
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setActiveView('contacts')}
            >
              Cancel
            </button>
          </div>
        </div>
        <div className="card-body">
          {error && <div className="alert alert-danger">{error}</div>}
          {successMessage && <div className="alert alert-success">{successMessage}</div>}
          
          {/* Performance metrics */}
          {performanceMetrics.totalTime > 0 && (
            <div className="card mb-3">
              <div className="card-header">
                <h6 className="mb-0">Performance Metrics</h6>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-4">
                    <small>File Loading: {performanceMetrics.fileLoadTime}ms</small>
                  </div>
                  <div className="col-md-4">
                    <small>Processing: {performanceMetrics.processingTime}ms</small>
                  </div>
                  <div className="col-md-4">
                    <small>Total Time: {performanceMetrics.totalTime}ms</small>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Import progress during actual import */}
          {loading && importProgress.status && (
            <div className="progress mb-3">
              <div 
                className="progress-bar" 
                role="progressbar" 
                style={{
                  width: `${importProgress.progress}%`,
                  backgroundColor: colors.primary
                }}
                aria-valuenow={importProgress.progress} 
                aria-valuemin="0" 
                aria-valuemax="100"
              >
                {importProgress.step} ({importProgress.progress}%)
              </div>
            </div>
          )}
          
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button
                className={`nav-link ${importTab === 'valid' ? 'active' : ''}`}
                onClick={() => setImportTab('valid')}
              >
                Valid Contacts ({validContacts.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${importTab === 'skipped' ? 'active' : ''}`}
                onClick={() => setImportTab('skipped')}
              >
                Skipped Contacts ({skippedContacts.length})
              </button>
            </li>
          </ul>
          
          {totalContacts === 0 ? (
            <div className="text-center my-4">
              <p>No {importTab} contacts found.</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Surname</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Birthday</th>
                      <th>Source</th>
                      {importTab === 'skipped' && <th>Reason</th>}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentContacts.map(contact => (
                      <tr key={contact.id} className={contact.duplicate ? 'table-danger' : ''}>
                        <td>
                          {editingContact?.id === contact.id ? (
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              name="name"
                              value={editFormData.name}
                              onChange={handleEditInputChange}
                            />
                          ) : (
                            contact.name || 'N/A'
                          )}
                        </td>
                        <td>
                          {editingContact?.id === contact.id ? (
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              name="surname"
                              value={editFormData.surname}
                              onChange={handleEditInputChange}
                            />
                          ) : (
                            contact.surname || 'N/A'
                          )}
                        </td>
                        <td>
                          {editingContact?.id === contact.id ? (
                            <input
                              type="email"
                              className="form-control form-control-sm"
                              name="email"
                              value={editFormData.email}
                              onChange={handleEditInputChange}
                            />
                          ) : (
                            contact.email || 'N/A'
                          )}
                        </td>
                        <td>
                          {editingContact?.id === contact.id ? (
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              name="phone"
                              value={editFormData.phone}
                              onChange={handleEditInputChange}
                              required
                            />
                          ) : (
                            <span className={!contact.phone ? 'text-danger' : ''}>
                              {contact.phone || 'Missing'}
                            </span>
                          )}
                        </td>
                        <td>
                          {editingContact?.id === contact.id ? (
                            <input
                              type="date"
                              className="form-control form-control-sm"
                              name="birthday"
                              value={editFormData.birthday || ''}
                              onChange={handleEditInputChange}
                            />
                          ) : (
                            contact.birthday || 'N/A'
                          )}
                        </td>
                        <td>{contact.source}</td>
                        {importTab === 'skipped' && <td>{contact.skipReason}</td>}
                        <td>
                          {editingContact?.id === contact.id ? (
                            <>
                              <button
                                className="btn btn-sm btn-success me-1"
                                onClick={saveEditedContact}
                              >
                                <i className="bi bi-check"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => setEditingContact(null)}
                              >
                                <i className="bi bi-x"></i>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-sm btn-outline-primary me-1"
                                onClick={() => startEditing(contact)}
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              {importTab === 'valid' ? (
                                <button
                                  className="btn btn-sm btn-outline-warning"
                                  onClick={() => moveContact(contact, 'skipped')}
                                  title="Skip this contact"
                                >
                                  <i className="bi bi-skip-forward"></i>
                                </button>
                              ) : (
                                <button
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => moveContact(contact, 'valid')}
                                  title="Move to valid contacts"
                                >
                                  <i className="bi bi-check-circle"></i>
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {previewPagination.totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div>
                    <small>
                      Showing {(previewPagination.page - 1) * previewPagination.limit + 1} to {
                        Math.min(previewPagination.page * previewPagination.limit, totalContacts)
                      } of {totalContacts} {importTab} contacts
                    </small>
                  </div>
                  <nav aria-label="Contacts pagination">
                    <ul className="pagination pagination-sm">
                      <li className={`page-item ${previewPagination.page === 1 ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(1)}
                          disabled={previewPagination.page === 1}
                        >
                          First
                        </button>
                      </li>
                      <li className={`page-item ${previewPagination.page === 1 ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(previewPagination.page - 1)}
                          disabled={previewPagination.page === 1}
                        >
                          Previous
                        </button>
                      </li>
                      <li className="page-item disabled">
                        <span className="page-link">
                          {previewPagination.page} / {previewPagination.totalPages}
                        </span>
                      </li>
                      <li className={`page-item ${previewPagination.page === previewPagination.totalPages ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(previewPagination.page + 1)}
                          disabled={previewPagination.page === previewPagination.totalPages}
                        >
                          Next
                        </button>
                      </li>
                      <li className={`page-item ${previewPagination.page === previewPagination.totalPages ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(previewPagination.totalPages)}
                          disabled={previewPagination.page === previewPagination.totalPages}
                        >
                          Last
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              )}
            </>
          )}
          
          <div className="d-flex justify-content-end mt-3">
            <button
              className="btn btn-primary"
              onClick={handleImportSubmit}
              disabled={loading || validContacts.length === 0}
              style={{
                backgroundColor: colors.primary,
                borderColor: colors.primaryDark
              }}
            >
              {loading ? 'Processing...' : `Import ${validContacts.length} Contacts`}
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Render the appropriate view based on activeView
  if (activeView === 'import') {
    return renderImportView();
  } else if (activeView === 'export') {
    return renderExportView();
  } else if (activeView === 'importPreview') {
    return renderImportPreview();
  }
  
  return null;
};

export default BulkContactsImportExport; 
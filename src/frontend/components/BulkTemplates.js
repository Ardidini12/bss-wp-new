import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from './ThemeContext';

const BulkTemplates = () => {
  const { colors } = useTheme();
  const [templates, setTemplates] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [addTemplateLoading, setAddTemplateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [activeView, setActiveView] = useState('templates'); // templates, add, edit
  const [templateToEdit, setTemplateToEdit] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    content: {
      text: '',
      images: []
    }
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const textareaRef = useRef(null);
  
  // Load templates on component mount and when pagination/search changes
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await window.electronAPI.getTemplates(
        pagination.page,
        pagination.limit,
        search
      );
      
      if (response.success) {
        setTemplates(response.templates);
        setPagination(response.pagination);
      } else {
        setError(response.error || 'Failed to load templates');
      }
    } catch (err) {
      setError('Error loading templates: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search]);
  
  // Separate function for search to avoid circular dependencies
  const performSearch = useCallback(async () => {
    try {
      const response = await window.electronAPI.getTemplates(
        1, // Reset to first page on search
        pagination.limit,
        search
      );
      
      if (response.success) {
        setTemplates(response.templates);
        setPagination(prev => ({
          ...response.pagination,
          page: 1 // Ensure we're on first page
        }));
      } else {
        setError(response.error || 'Failed to load templates');
      }
    } catch (err) {
      setError('Error loading templates: ' + err.message);
    }
  }, [pagination.limit, search]);
  
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);
  
  // Reset selection when templates change
  useEffect(() => {
    setSelectedTemplates([]);
    setSelectAll(false);
  }, [templates]);
  
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
  const toggleTemplateSelection = (templateId) => {
    setSelectedTemplates(prev => {
      if (prev.includes(templateId)) {
        return prev.filter(id => id !== templateId);
      } else {
        return [...prev, templateId];
      }
    });
  };
  
  // Handle select all
  const toggleSelectAll = async () => {
    if (selectAll) {
      setSelectedTemplates([]);
    } else {
      // Get all template IDs from all pages
      setSelectAllLoading(true);
      try {
        const response = await window.electronAPI.getAllTemplateIds(search);
        if (response.success) {
          setSelectedTemplates(response.templateIds);
          
          // Show how many templates were selected
          setSuccessMessage(`Selected all ${response.templateIds.length} templates`);
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setError(response.error || 'Failed to get all templates');
        }
      } catch (err) {
        setError('Error getting all templates: ' + err.message);
      } finally {
        setSelectAllLoading(false);
      }
    }
    setSelectAll(!selectAll);
  };
  
  // Handle delete selected templates
  const handleDeleteSelected = async () => {
    if (selectedTemplates.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedTemplates.length} template(s)?`)) {
      return;
    }
    
    setDeleteLoading(true);
    try {
      const response = await window.electronAPI.deleteTemplates(selectedTemplates);
      if (response.success) {
        setSuccessMessage(`Successfully deleted ${response.deletedCount} template(s)`);
        setTimeout(() => setSuccessMessage(''), 3000);
        
        // Refresh templates
        await loadTemplates();
      } else {
        setError(response.error || 'Failed to delete templates');
      }
    } catch (err) {
      setError('Error deleting templates: ' + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };
  
  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'text') {
      // Update form data
      setFormData({
        ...formData,
        content: {
          ...formData.content,
          text: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
    
    // Clear any error messages when user types
    if (error) setError('');
  };
  
  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.match('image.*')) {
      setError('Please select an image file');
      return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target.result;
      setImagePreview(imageData);
      
      // Add image to form data
      setFormData(prev => ({
        ...prev,
        content: {
          ...prev.content,
          images: [...prev.content.images, imageData]
        }
      }));
    };
    reader.readAsDataURL(file);
  };
  
  // Remove image from template
  const handleRemoveImage = (index) => {
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        images: prev.content.images.filter((_, i) => i !== index)
      }
    }));
    
    if (index === 0 && formData.content.images.length === 1) {
      setImagePreview(null);
    }
  };
  
  // Reset form and switch to add view
  const handleAddNew = () => {
    setFormData({
      name: '',
      content: {
        text: '',
        images: []
      }
    });
    setError('');
    setActiveView('add');
  };
  
  // Set up edit form with template data
  const handleEdit = (template) => {
    setTemplateToEdit(template);
    setFormData({
      name: template.name,
      content: {
        text: template.content.text || '',
        images: template.content.images || []
      }
    });
    setError('');
    setActiveView('edit');
  };
  
  // Handle add template
  const handleAddTemplate = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }
    
    setAddTemplateLoading(true);
    try {
      const response = await window.electronAPI.addTemplate(formData);
      if (response.success) {
        setSuccessMessage('Template added successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        
        // Reset form and go back to templates view
        setFormData({
          name: '',
          content: {
            text: '',
            images: []
          }
        });
        setImagePreview(null);
        setActiveView('templates');
        
        // Refresh templates
        await loadTemplates();
      } else {
        setError(response.error || 'Failed to add template');
      }
    } catch (err) {
      setError('Error adding template: ' + err.message);
    } finally {
      setAddTemplateLoading(false);
    }
  };
  
  // Handle update template
  const handleUpdateTemplate = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }
    
    setAddTemplateLoading(true);
    try {
      const response = await window.electronAPI.updateTemplate(templateToEdit.id, formData);
      if (response.success) {
        setSuccessMessage('Template updated successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        
        // Reset form and go back to templates view
        setFormData({
          name: '',
          content: {
            text: '',
            images: []
          }
        });
        setImagePreview(null);
        setTemplateToEdit(null);
        setActiveView('templates');
        
        // Refresh templates
        await loadTemplates();
      } else {
        setError(response.error || 'Failed to update template');
      }
    } catch (err) {
      setError('Error updating template: ' + err.message);
    } finally {
      setAddTemplateLoading(false);
    }
  };
  

  
  // Insert special character at cursor position
  const insertCharacter = (char) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.content.text;
    
    // Insert the character at cursor position
    const newText = text.substring(0, start) + char + text.substring(end);
    
    // Update form data
    setFormData({
      ...formData,
      content: {
        ...formData.content,
        text: newText
      }
    });
    
    // Set cursor position after the inserted character
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + char.length, start + char.length);
    }, 10);
  };
  

  
  // Render template form (for both add and edit)
  const renderTemplateForm = () => {
    return (
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            {activeView === 'add' ? 'Add New Template' : 'Edit Template'}
          </h5>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setActiveView('templates')}
          >
            Back to Templates
          </button>
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          <form onSubmit={activeView === 'add' ? handleAddTemplate : handleUpdateTemplate}>
            <div className="mb-3">
              <label htmlFor="name" className="form-label">Template Name*</label>
              <input
                type="text"
                className="form-control"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter template name"
                required
              />
            </div>
            
            <div className="mb-3">
              <label htmlFor="text" className="form-label">Template Content</label>
              
              {/* Albanian Characters Only */}
              <div className="d-flex align-items-center mb-2">
                <span className="me-2 d-flex align-items-center">
                  <small className="text-muted">Albanian Characters:</small>
                </span>
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-secondary" 
                  onClick={() => insertCharacter('Ç')}
                  title="Ç"
                >
                  Ç
                </button>
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-secondary" 
                  onClick={() => insertCharacter('ç')}
                  title="ç"
                >
                  ç
                </button>
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-secondary" 
                  onClick={() => insertCharacter('Ë')}
                  title="Ë"
                >
                  Ë
                </button>
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-secondary" 
                  onClick={() => insertCharacter('ë')}
                  title="ë"
                >
                  ë
                </button>
              </div>
              
              <textarea
                className="form-control"
                id="text"
                name="text"
                value={formData.content.text}
                onChange={handleInputChange}
                placeholder="Enter template content"
                rows="5"
                ref={textareaRef}
              />
              

            </div>
            
            <div className="mb-3">
              <div className="alert alert-info">
                <h6>Template Variables</h6>
                <p className="mb-2">
                  You can use the following variables in your template content:
                </p>
                <ul className="mb-2">
                  <li><code>{'{name}'}</code> - Contact's name</li>
                  <li><code>{'{surname}'}</code> - Contact's surname</li>
                  <li><code>{'{phone}'}</code> - Contact's phone number</li>
                  <li><code>{'{email}'}</code> - Contact's email</li>
                  <li><code>{'{birthday}'}</code> - Contact's birthday</li>
                </ul>
                <p className="mb-2">
                  Date and time variables:
                </p>
                <ul className="mb-0">
                  <li><code>{'{date}'}</code> - Current date (e.g., 6/8/2023)</li>
                  <li><code>{'{time}'}</code> - Current time (e.g., 3:45:30 PM)</li>
                  <li><code>{'{datetime}'}</code> - Current date and time</li>
                  <li><code>{'{day}'}</code> - Current day of month</li>
                  <li><code>{'{month}'}</code> - Current month number</li>
                  <li><code>{'{year}'}</code> - Current year</li>
                </ul>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="alert alert-info">
                <h6>WhatsApp Formatting</h6>
                <p className="mb-2">
                  You can format your text using these WhatsApp formatting options:
                </p>
                <ul className="mb-0">
                  <li><code>*bold*</code> - Makes text <strong>bold</strong></li>
                  <li><code>_italic_</code> - Makes text <em>italic</em></li>
                  <li><code>~strikethrough~</code> - Makes text <s>strikethrough</s></li>
                  <li><code>```monospace```</code> - Makes text <code>monospace</code></li>
                </ul>
              </div>
            </div>
            
            <div className="mb-3">
              <label className="form-label">Images</label>
              <div className="d-flex mb-2">
                <input
                  type="file"
                  className="form-control me-2"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </div>
              
              {formData.content.images.length > 0 && (
                <div className="row mt-3">
                  {formData.content.images.map((image, index) => (
                    <div key={index} className="col-md-3 mb-3">
                      <div className="position-relative">
                        <img
                          src={image}
                          alt={`Template image ${index + 1}`}
                          className="img-thumbnail"
                          style={{ maxHeight: '150px' }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-danger position-absolute top-0 end-0"
                          onClick={() => handleRemoveImage(index)}
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-secondary me-2"
                onClick={() => setActiveView('templates')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={addTemplateLoading}
              >
                {addTemplateLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    {activeView === 'add' ? 'Adding...' : 'Updating...'}
                  </>
                ) : (
                  activeView === 'add' ? 'Add Template' : 'Update Template'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };
  
  // Render templates table
  const renderTemplatesTable = () => {
    return (
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Message Templates</h5>
          <div>
            <button 
              className="btn btn-sm btn-primary me-2"
              onClick={handleAddNew}
            >
              Add New Template
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={handleDeleteSelected}
              disabled={selectedTemplates.length === 0 || deleteLoading}
            >
              {deleteLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Deleting...
                </>
              ) : (
                `Delete Selected (${selectedTemplates.length})`
              )}
            </button>
          </div>
        </div>
        <div className="card-body">
          {successMessage && (
            <div className="alert alert-success" role="alert">
              {successMessage}
            </div>
          )}
          
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          <div className="mb-3">
            <form onSubmit={handleSearchSubmit} className="d-flex">
              <input
                type="text"
                className="form-control me-2"
                placeholder="Search templates..."
                value={search}
                onChange={handleSearchChange}
              />
              <button 
                type="submit"
                className="btn btn-primary"
                disabled={searchLoading}
              >
                {searchLoading ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  'Search'
                )}
              </button>
            </form>
          </div>
          
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="alert alert-info" role="alert">
              No templates found. Add your first template to get started.
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={selectAll}
                            onChange={toggleSelectAll}
                            disabled={selectAllLoading}
                          />
                        </div>
                      </th>
                      <th>Template Name</th>
                      <th>Content Preview</th>
                      <th>Images</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map(template => (
                      <tr key={template.id}>
                        <td>
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={selectedTemplates.includes(template.id)}
                              onChange={() => toggleTemplateSelection(template.id)}
                            />
                          </div>
                        </td>
                        <td>{template.name}</td>
                        <td>
                          <div style={{ maxHeight: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {template.content.text ? (
                              template.content.text.length > 100 
                                ? `${template.content.text.substring(0, 100)}...` 
                                : template.content.text
                            ) : (
                              <em>No text content</em>
                            )}
                          </div>
                        </td>
                        <td>
                          {template.content.images && template.content.images.length > 0 ? (
                            <div className="d-flex">
                              <img 
                                src={template.content.images[0]} 
                                alt="Template preview" 
                                style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                                className="img-thumbnail"
                              />
                              {template.content.images.length > 1 && (
                                <span className="ms-2 badge bg-secondary">
                                  +{template.content.images.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <em>No images</em>
                          )}
                        </td>
                        <td>
                          {new Date(template.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary me-1"
                            onClick={() => handleEdit(template)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <nav aria-label="Template pagination" className="mt-3">
                  <ul className="pagination justify-content-center">
                    <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </button>
                    </li>
                    
                    {[...Array(pagination.totalPages)].map((_, index) => (
                      <li 
                        key={index} 
                        className={`page-item ${pagination.page === index + 1 ? 'active' : ''}`}
                      >
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(index + 1)}
                        >
                          {index + 1}
                        </button>
                      </li>
                    ))}
                    
                    <li className={`page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages}
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
      </div>
    );
  };
  
  return (
    <div className="bulk-templates">
      {activeView === 'templates' && renderTemplatesTable()}
      {(activeView === 'add' || activeView === 'edit') && renderTemplateForm()}
    </div>
  );
};

export default BulkTemplates; 
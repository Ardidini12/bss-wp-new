import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from './ThemeContext';

const SalesSettings = () => {
  const { colors } = useTheme();
  const [settings, setSettings] = useState({
    autoSchedulerEnabled: false,
    firstMessageDelay: 2,
    firstMessageDelayUnit: 'hours',
    secondMessageDelay: 180,
    secondMessageDelayUnit: 'days',
    firstMessageTemplate: "",
    firstMessageImages: [],
    secondMessageTemplate: "",
    secondMessageImages: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const response = await window.electronAPI.getSalesSettings();
        if (response.success) {
          // If the settings don't have the unit fields, add them with defaults
          const loadedSettings = response.settings;
          if (!loadedSettings.firstMessageDelayUnit) {
            loadedSettings.firstMessageDelayUnit = 'hours';
          }
          if (!loadedSettings.secondMessageDelayUnit) {
            loadedSettings.secondMessageDelayUnit = 'days';
          }
          // Add image arrays if they don't exist
          if (!loadedSettings.firstMessageImages) {
            loadedSettings.firstMessageImages = [];
          }
          if (!loadedSettings.secondMessageImages) {
            loadedSettings.secondMessageImages = [];
          }
          setSettings(loadedSettings);
        }
      } catch (error) {
        console.error('Error loading sales settings:', error);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : (
        type === 'number' ? parseInt(value, 10) : value
      )
    });
    
    // Clear any error messages when user types
    if (error) setError('');
  };

  // Handle image upload for first or second message
  const handleImageUpload = (e, messageType) => {
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
      
      // Add image to the appropriate message type
      setSettings(prev => ({
        ...prev,
        [messageType === 'first' ? 'firstMessageImages' : 'secondMessageImages']: [
          ...prev[messageType === 'first' ? 'firstMessageImages' : 'secondMessageImages'],
          imageData
        ]
      }));
    };
    reader.readAsDataURL(file);
    
    // Reset the input
    e.target.value = '';
  };

  // Remove image from message template
  const handleRemoveImage = (messageType, index) => {
    setSettings(prev => ({
      ...prev,
      [messageType === 'first' ? 'firstMessageImages' : 'secondMessageImages']: 
        prev[messageType === 'first' ? 'firstMessageImages' : 'secondMessageImages'].filter((_, i) => i !== index)
    }));
  };

  // Format phone number for international use
  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    
    // Remove all non-numeric characters except + at the beginning
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it starts with +, remove it and keep the rest
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    
    // Remove any + signs that might be in the middle
    cleaned = cleaned.replace(/\+/g, '');
    
    // If it starts with 00, remove it (international prefix)
    if (cleaned.startsWith('00')) {
      cleaned = cleaned.substring(2);
    }
    
    // Return the cleaned number (should be in international format without + prefix)
    return cleaned;
  };

  // Convert delay to milliseconds based on unit
  const getDelayInMilliseconds = (value, unit) => {
    switch (unit) {
      case 'seconds':
        return value * 1000;
      case 'minutes':
        return value * 60 * 1000;
      case 'hours':
        return value * 60 * 60 * 1000;
      case 'days':
        return value * 24 * 60 * 60 * 1000;
      default:
        return value * 60 * 60 * 1000; // Default to hours
    }
  };

  // Save settings
  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      // Make sure to include all settings including images
      const settingsToSave = {
        ...settings,
        // Ensure delay units are included
        firstMessageDelayUnit: settings.firstMessageDelayUnit,
        secondMessageDelayUnit: settings.secondMessageDelayUnit,
        // Include image data
        firstMessageImages: settings.firstMessageImages || [],
        secondMessageImages: settings.secondMessageImages || []
      };
      
      const response = await window.electronAPI.updateSalesSettings(settingsToSave);
      
      if (response.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setError(response.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Test message template with sample data
  const testTemplate = (template) => {
    const sampleData = {
      name: 'John Doe',
      amount: '12345'
    };
    
    return template
      .replace(/{{name}}/g, sampleData.name)
      .replace(/{{amount}}/g, sampleData.amount);
  };

  if (loading) {
    return (
      <div className="card dashboard-card">
        <div className="card-body">
          <div className="d-flex justify-content-center">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card dashboard-card" style={{ marginBottom: '1rem' }}>
      <div className="card-body">
        <h2 className="card-title" style={{ color: colors.primary }}>
          Sales Message Settings
        </h2>
        
        <div className="form-check form-switch mb-3">
          <input
            className="form-check-input"
            type="checkbox"
            id="autoSchedulerEnabled"
            name="autoSchedulerEnabled"
            checked={settings.autoSchedulerEnabled}
            onChange={handleChange}
          />
          <label className="form-check-label" htmlFor="autoSchedulerEnabled">
            Auto-scheduler Enabled
          </label>
          <small className="d-block text-muted">
            When enabled, messages will be automatically scheduled for new sales
          </small>
        </div>
        
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="mb-3">
              <label htmlFor="firstMessageDelay" className="form-label">
                First Message Delay
              </label>
              <div className="input-group">
                <input
                  type="number"
                  className="form-control"
                  id="firstMessageDelay"
                  name="firstMessageDelay"
                  value={settings.firstMessageDelay}
                  onChange={handleChange}
                  min="1"
                />
                <select
                  className="form-select"
                  id="firstMessageDelayUnit"
                  name="firstMessageDelayUnit"
                  value={settings.firstMessageDelayUnit}
                  onChange={handleChange}
                >
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
              <small className="text-muted">
                Time delay before sending the first message after a sale
              </small>
            </div>
          </div>
          <div className="col-md-6">
            <div className="mb-3">
              <label htmlFor="secondMessageDelay" className="form-label">
                Second Message Delay
              </label>
              <div className="input-group">
                <input
                  type="number"
                  className="form-control"
                  id="secondMessageDelay"
                  name="secondMessageDelay"
                  value={settings.secondMessageDelay}
                  onChange={handleChange}
                  min="1"
                />
                <select
                  className="form-select"
                  id="secondMessageDelayUnit"
                  name="secondMessageDelayUnit"
                  value={settings.secondMessageDelayUnit}
                  onChange={handleChange}
                >
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
              <small className="text-muted">
                Time delay before sending the second message after the first message
              </small>
            </div>
          </div>
        </div>
        
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="mb-3">
              <label htmlFor="firstMessageTemplate" className="form-label">
                First Message Template
              </label>
              <textarea
                className="form-control"
                id="firstMessageTemplate"
                name="firstMessageTemplate"
                value={settings.firstMessageTemplate}
                onChange={handleChange}
                rows="5"
                placeholder="Enter the first message template..."
              />
              <small className="text-muted">
                Available variables: {'{{'} name {'}}'}  - Customer name, {'{{'} amount {'}}'}  - Document number
              </small>
              {settings.firstMessageTemplate && (
                <div className="mt-2 p-2 border rounded">
                  <small className="d-block text-muted mb-1">Preview:</small>
                  {testTemplate(settings.firstMessageTemplate)}
                </div>
              )}
              
              {/* Image upload for first message */}
              <div className="mt-3">
                <label className="form-label">Images for First Message</label>
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {settings.firstMessageImages.map((image, index) => (
                    <div key={index} className="position-relative">
                      <img 
                        src={image} 
                        alt={`First message image ${index + 1}`}
                        style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                        className="rounded border"
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-danger position-absolute"
                        style={{ top: '-5px', right: '-5px', width: '20px', height: '20px', padding: '0', fontSize: '12px' }}
                        onClick={() => handleRemoveImage('first', index)}
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'first')}
                />
                <small className="text-muted">
                  Select images to include with the first message (max 5MB each)
                </small>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="mb-3">
              <label htmlFor="secondMessageTemplate" className="form-label">
                Second Message Template
              </label>
              <textarea
                className="form-control"
                id="secondMessageTemplate"
                name="secondMessageTemplate"
                value={settings.secondMessageTemplate}
                onChange={handleChange}
                rows="5"
                placeholder="Enter the second message template..."
              />
              <small className="text-muted">
                Available variables: {'{{'} name {'}}'}  - Customer name, {'{{'} amount {'}}'}  - Document number
              </small>
              {settings.secondMessageTemplate && (
                <div className="mt-2 p-2 border rounded">
                  <small className="d-block text-muted mb-1">Preview:</small>
                  {testTemplate(settings.secondMessageTemplate)}
                </div>
              )}
              
              {/* Image upload for second message */}
              <div className="mt-3">
                <label className="form-label">Images for Second Message</label>
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {settings.secondMessageImages.map((image, index) => (
                    <div key={index} className="position-relative">
                      <img 
                        src={image} 
                        alt={`Second message image ${index + 1}`}
                        style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                        className="rounded border"
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-danger position-absolute"
                        style={{ top: '-5px', right: '-5px', width: '20px', height: '20px', padding: '0', fontSize: '12px' }}
                        onClick={() => handleRemoveImage('second', index)}
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'second')}
                />
                <small className="text-muted">
                  Select images to include with the second message (max 5MB each)
                </small>
              </div>
            </div>
          </div>
        </div>
        
        <div className="d-flex justify-content-end">
          {error && (
            <div className="alert alert-danger me-3 mb-0 py-2">
              {error}
            </div>
          )}
          {saveSuccess && (
            <div className="alert alert-success me-3 mb-0 py-2">
              Settings saved successfully!
            </div>
          )}
          <button
            className="btn"
            style={{ backgroundColor: colors.primary, color: colors.textOnPrimary }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesSettings; 
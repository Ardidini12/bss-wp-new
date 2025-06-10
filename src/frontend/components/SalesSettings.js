import React, { useState, useEffect } from 'react';
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
    secondMessageTemplate: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
          setSettings(loadedSettings);
        }
      } catch (error) {
        console.error('Error loading sales settings:', error);
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
      
      // Make sure to include the delay units in the saved settings
      const settingsToSave = {
        ...settings,
        // Keep the delay unit information in the saved settings
        firstMessageDelayUnit: settings.firstMessageDelayUnit,
        secondMessageDelayUnit: settings.secondMessageDelayUnit
      };
      
      const response = await window.electronAPI.updateSalesSettings(settingsToSave);
      
      if (response.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
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
            </div>
          </div>
        </div>
        
        <div className="d-flex justify-content-end">
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
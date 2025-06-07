import React from 'react';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import WhatsAppConnect from './WhatsAppConnect';

const Settings = () => {
  const { currentUser } = useAuth();
  const { colors } = useTheme();

  return (
    <div className="settings-container">
      <div className="card mb-4" style={{ borderColor: colors.primary }}>
        <div className="card-header" style={{ backgroundColor: colors.primary, color: colors.textOnPrimary }}>
          <h3 className="mb-0">User Settings</h3>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <h5>Account Information</h5>
            <p><strong>Username:</strong> {currentUser?.username}</p>
            <p><strong>User ID:</strong> {currentUser?.id}</p>
          </div>
          
          <div className="mb-3">
            <h5>Application Information</h5>
            <p>This is a simple settings page. Additional settings will be added in future updates.</p>
          </div>
        </div>
      </div>
      
      {/* WhatsApp Connection Section */}
      <WhatsAppConnect />
    </div>
  );
};

export default Settings; 
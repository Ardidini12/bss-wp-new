// Import assets so webpack can process them
import LogoBSS from '../../assets/Logo-BSS.png';

// Map of asset names to their imported references
const assets = {
  'Logo-BSS': LogoBSS
};

/**
 * Get the URL for an asset by name
 * @param {string} name - The asset name
 * @returns {string} The asset URL
 */
export const getAsset = (name) => {
  if (!assets[name]) {
    console.error(`Asset not found: ${name}`);
    return '';
  }
  return assets[name];
};

export default {
  getAsset,
  LogoBSS
}; 
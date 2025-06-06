import ColorThief from 'colorthief';

// Function to extract dominant color and palette from an image
export const extractColors = async (imagePath) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const colorThief = new ColorThief();
    
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      try {
        const dominantColor = colorThief.getColor(img);
        const palette = colorThief.getPalette(img, 5);
        resolve({ dominantColor, palette });
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      reject(error);
    };
    
    img.src = imagePath;
  });
};

// Convert RGB array to hex string
export const rgbToHex = (rgb) => {
  return '#' + rgb.map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

// Generate lighter or darker versions of a color
export const lightenDarkenColor = (rgb, amount) => {
  return rgb.map(value => {
    const newValue = value + amount;
    return Math.min(255, Math.max(0, newValue));
  });
};

// Generate a color scheme from dominant color
export const generateColorScheme = (dominantColor, palette) => {
  const primary = dominantColor;
  const secondary = palette[1] || dominantColor;
  const accent = palette[2] || dominantColor;
  
  // Generate lighter and darker versions
  const primaryLight = lightenDarkenColor(primary, 40);
  const primaryDark = lightenDarkenColor(primary, -40);
  
  const secondaryLight = lightenDarkenColor(secondary, 40);
  const secondaryDark = lightenDarkenColor(secondary, -40);
  
  // Convert all colors to hex
  return {
    primary: rgbToHex(primary),
    primaryLight: rgbToHex(primaryLight),
    primaryDark: rgbToHex(primaryDark),
    
    secondary: rgbToHex(secondary),
    secondaryLight: rgbToHex(secondaryLight),
    secondaryDark: rgbToHex(secondaryDark),
    
    accent: rgbToHex(accent),
    
    // Text colors based on brightness
    textOnPrimary: getContrastColor(primary),
    textOnSecondary: getContrastColor(secondary),
  };
};

// Calculate contrasting text color (black or white) based on background
export const getContrastColor = (rgb) => {
  // Calculate brightness using the YIQ formula
  const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  return brightness >= 128 ? '#000000' : '#ffffff';
}; 
/**
 * Utility function to safely parse boolean values from various input types
 * Handles strings like "true", "false", "1", "0", and actual boolean values
 */
export const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase().trim();
    return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return false;
};

/**
 * Utility function to safely parse boolean values with default fallback
 */
export const parseBooleanWithDefault = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  return parseBoolean(value);
};

/**
 * CRA AI Assistant - Excel Styles Configuration
 */

// ============================================================================
// Color Constants
// ============================================================================

export const COLORS = {
  PRIMARY: '0E5A8A',
  PRIMARY_LIGHT: 'E8F4F8',
  HEADER_BG: '4472C4',
  HEADER_TEXT: 'FFFFFF',
  BORDER: 'D0D0D0',
  LIGHT_BORDER: 'E7E7E7',
  SUCCESS: '70AD47',
  WARNING: 'FFC000',
  ERROR: 'C00000',
  INFO: '5B9BD5',
} as const;

// ============================================================================
// Cell Styles
// ============================================================================

export const STYLES = {
  // Title style
  title: {
    font: {
      name: '微软雅黑',
      size: 18,
      bold: true,
      color: { argb: COLORS.PRIMARY },
    },
    alignment: {
      horizontal: 'center' as const,
      vertical: 'middle' as const,
    },
  },

  // Subtitle style
  subtitle: {
    font: {
      name: '微软雅黑',
      size: 14,
      bold: true,
      color: { argb: COLORS.PRIMARY },
    },
    alignment: {
      horizontal: 'left' as const,
      vertical: 'middle' as const,
    },
  },

  // Header style
  header: {
    font: {
      name: '微软雅黑',
      size: 11,
      bold: true,
      color: { argb: COLORS.HEADER_TEXT },
    },
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: COLORS.HEADER_BG },
    },
    alignment: {
      horizontal: 'center' as const,
      vertical: 'middle' as const,
      wrapText: true,
    },
    border: {
      top: { style: 'thin' as const, color: { argb: COLORS.BORDER } },
      left: { style: 'thin' as const, color: { argb: COLORS.BORDER } },
      bottom: { style: 'thin' as const, color: { argb: COLORS.BORDER } },
      right: { style: 'thin' as const, color: { argb: COLORS.BORDER } },
    },
  },

  // Data style
  data: {
    font: {
      name: '微软雅黑',
      size: 10,
    },
    alignment: {
      horizontal: 'left' as const,
      vertical: 'middle' as const,
      wrapText: false,
    },
    border: {
      top: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
      left: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
      bottom: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
      right: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
    },
  },

  // Center data style
  dataCenter: {
    font: {
      name: '微软雅黑',
      size: 10,
    },
    alignment: {
      horizontal: 'center' as const,
      vertical: 'middle' as const,
      wrapText: false,
    },
    border: {
      top: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
      left: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
      bottom: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
      right: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
    },
  },

  // Date style
  date: {
    font: {
      name: '微软雅黑',
      size: 10,
    },
    alignment: {
      horizontal: 'center' as const,
      vertical: 'middle' as const,
    },
    numFmt: 'yyyy-mm-dd',
    border: {
      top: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
      left: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
      bottom: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
      right: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
    },
  },

  // Warning style
  warning: {
    font: {
      name: '微软雅黑',
      size: 10,
      color: { argb: COLORS.WARNING },
    },
    alignment: {
      horizontal: 'left' as const,
      vertical: 'middle' as const,
    },
    border: {
      top: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
      left: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
      bottom: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
      right: { style: 'thin' as const, color: { argb: COLORS.LIGHT_BORDER } },
    },
  },

  // Info style
  info: {
    font: {
      name: '微软雅黑',
      size: 10,
      italic: true,
      color: { argb: COLORS.INFO },
    },
    alignment: {
      horizontal: 'left' as const,
      vertical: 'middle' as const,
    },
  },
} as const;

// ============================================================================
// Column Widths
// ============================================================================

export const COLUMN_WIDTHS = {
  narrow: 10,
  medium: 15,
  wide: 25,
  extraWide: 35,
} as const;

// ============================================================================
// Row Heights
// ============================================================================

export const ROW_HEIGHTS = {
  standard: 20,
  tall: 30,
  extraTall: 40,
} as const;

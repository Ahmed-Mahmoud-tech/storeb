function hexToRgb(hex: string) {
  const cleanHex = hex.replace(/^#/, '');

  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    console.error('Invalid hex:', cleanHex);
    return { r: 0, g: 0, b: 0 };
  }

  const bigint = parseInt(cleanHex, 16);
  const result = {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };

  return result;
}

function getCloseMatchingColors(
  targetColor: string,
  colorList: string[],
  tolerance = 10
) {
  const hexTargetColor = convertToHexColor(targetColor);
  const targetRgb = hexToRgb(hexTargetColor);

  console.log(
    'Target:',
    hexTargetColor,
    'RGB:',
    targetRgb,
    'Tolerance:',
    tolerance
  );

  if (colorList.length === 0) {
    console.log('Empty color list');
    return [];
  }

  const matches = colorList.filter((color) => {
    const hexColor = convertToHexColor(color);
    const rgb = hexToRgb(hexColor);

    const rDiff = Math.abs(rgb.r - targetRgb.r);
    const gDiff = Math.abs(rgb.g - targetRgb.g);
    const bDiff = Math.abs(rgb.b - targetRgb.b);

    const isMatch =
      rDiff <= tolerance && gDiff <= tolerance && bDiff <= tolerance;

    console.log(
      `${hexColor} diff(${rDiff},${gDiff},${bDiff}) match:${isMatch}`
    );

    return isMatch;
  });

  console.log('Matches found:', matches);
  return matches;
}

/**
 * Converts color to hex format (adds # if not present)
 * @param color - Color string that may or may not have #
 * @returns Color string with # prefix
 */
function convertToHexColor(color: string): string {
  // Handle empty or invalid input
  if (!color || typeof color !== 'string' || color.trim().length === 0) {
    console.error('Invalid color input:', color);
    return '#000000'; // Return black as fallback
  }

  if (color.startsWith('#')) {
    return color;
  }
  return `#${color}`;
}

/**
 * Generates matching color tags for product filtering
 * This function is used after the main filter to find products with similar colors
 * @param targetColor - The target color to match (will be converted to hex if needed)
 * @param productColors - Array of all product colors from database
 * @param tolerance - Color tolerance for matching (default: 30)
 * @returns Array of color tags that match the target color
 */
function getMatchingColorTags(
  targetColor: string,
  productColors: string[] = [],
  tolerance = 30
): string[] {
  console.log(
    'getMatchingColorTags:',
    targetColor,
    'from',
    productColors.length,
    'colors'
  );

  // Validate target color input
  if (
    !targetColor ||
    typeof targetColor !== 'string' ||
    targetColor.trim().length === 0
  ) {
    console.error('Invalid target color:', targetColor);
    return [];
  }

  const hexTargetColor = convertToHexColor(targetColor);

  if (productColors.length === 0) {
    console.log('No product colors, returning target:', hexTargetColor);
    return [`color:${hexTargetColor}`];
  }

  const matchingColors = getCloseMatchingColors(
    hexTargetColor,
    productColors,
    tolerance
  );

  console.log(matchingColors, 'matchingColors');

  const matchingColorTags = matchingColors.map((color) => `color:${color}`);

  if (matchingColorTags.length === 0) {
    console.log('No matches found, returning target for exact match');
    return [`color:${hexTargetColor}`];
  }

  console.log('Matching tags:', matchingColorTags);
  return matchingColorTags;
}

export { getCloseMatchingColors, convertToHexColor, getMatchingColorTags };
// const nearest = getCloseMatchingColors('#FF3300', colorPalette, 130);

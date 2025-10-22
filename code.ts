// ============================================================================
// KOVA TOKEN VALIDATOR - MAIN PLUGIN
// ============================================================================

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

type SavedLibrary = {
  libraryName: string;
  libraryFileKey?: string | null;
  generatedAt: string;
  type: 'design-system-export';
  version: number;
  items: Record<string, string>; // "Display/Large" -> style.key
  variables?: Record<string, any>; // Variable data
};

interface PluginMessage {
  type: 'get-ui-mode' | 'switch-mode' | 'export-keys' | 'get-saved-libraries' | 'select-library' | 'apply-text-style' | 'apply-spacing-token' | 'apply-corner-radius-token' | 'apply-corner-radius-tokens' | 'apply-hardcoded-corner-radius' | 'apply-color-token' | 'create-text-style' | 'resize-ui' | 'clear-all-libraries' | 'close-plugin' | 'user-going-to-design-system' | 'cancel-export-instructions' | 'get-text-styles' | 'get-spacing-variables' | 'get-colors' | 'get-corner-radius' | 'run-validation' | 'back-to-validation' | 'select-node' | 'select-and-position-node' | 'selection-changed' | 'enable-selection-tracking' | 'disable-selection-tracking' | 'minimize-and-position' | 'validate-issue-resolution' | 'get-node-name' | 'get-current-node-values';
  libraryKey?: string;
  styleName?: string;
  tokenName?: string;
  cornerTokens?: Record<string, string>;
  corner?: string;
  value?: number;
  nodeId?: string;
  nodeName?: string;
  targetNodeId?: string;
  resultType?: string;
  issueType?: string;
  validationId?: number;
  mode?: 'export' | 'link' | 'selection' | 'home' | 'export-instructions' | 'export-confirmation' | 'validation-results';
  width?: number;
  height?: number;
  position?: {
    horizontal: 'center' | 'left' | 'right';
    vertical: number; // 0-1, where 0 is top, 1 is bottom
  };
  sizeMode?: 'export' | 'link' | 'selection' | 'home' | 'export-instructions' | 'validation-results' | 'validation-results-collapsed';
  library?: {
    name: string;
    count: number;
    key: string;
  };
  textStyles?: Record<string, string>;
  options?: {
    textStyles: boolean;
    spacing: boolean;
    cornerRadius?: boolean;
    colors?: boolean;
    typography?: boolean;
    shadows?: boolean;
    borders?: boolean;
    opacity?: boolean;
    sizing?: boolean;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Plugin Status Flow:
// 0 = No JSON file (no libraries saved) - Link Screen
// 1 = User went to design system file - Export Screen
// 2 = Has JSON file, none selected - Selection Screen  
// 3 = JSON file selected, ready to validate - Home Screen
const PLUGIN_STATUS = {
  NO_LIBRARIES: 0,
  EXPORT_MODE: 1,
  SELECTION_MODE: 2,
  READY: 3
} as const;

// UI Screen Sizes
const UI_SIZES = {
  EXPORT_SCREEN: { width: 380, height: 530 },
  LINK_SCREEN: { width: 380, height: 530 },
  SELECTION_SCREEN: { width: 400, height: 400 },
  HOME_SCREEN: { width: 400, height: 900 },
  EXPORT_INSTRUCTIONS_SCREEN: { width: 400, height: 500 },
  EXPORT_CONFIRMATION_SCREEN: { width: 400, height: 550 },
  VALIDATION_RESULTS_SCREEN: { width: 1100, height: 700 },
  VALIDATION_RESULTS_COLLAPSED: { width: 450, height: 350 },
  CUSTOM: (width: number, height: number) => ({ width, height })
} as const;

// ============================================================================
// GLOBAL STATE
// ============================================================================

let selectedLibraryKey: string | null = null;

// ============================================================================
// PLUGIN INITIALIZATION
// ============================================================================

// Start with fixed loader size
figma.showUI(__html__, { width: 380, height: 530 });

// Reset selectedLibraryKey on plugin start to ensure clean state
selectedLibraryKey = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Error handling utilities
function createError(message: string, context?: any): Error {
  if (context) {
    console.error(`Error: ${message}`, context);
  }
  return new Error(message);
}

function handleAsyncError(error: unknown, operation: string): string {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.error(`${operation} failed:`, error);
  figma.notify(`${operation} failed: ${errorMsg}`, { error: true });
  return errorMsg;
}

// Validation utilities
function validateRequiredParams(params: Record<string, any>, required: string[]): void {
  for (const param of required) {
    if (!params[param]) {
      throw createError(`${param} is required`);
    }
  }
}

function validateLibrarySelected(): void {
  if (!selectedLibraryKey) {
    throw createError('Please select a library first.');
  }
}

// Node utilities
async function getNodeById(nodeId: string): Promise<SceneNode> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw createError('Node not found.');
  }
  return node as SceneNode;
}

function isNodeType<T extends SceneNode>(node: SceneNode, types: string[]): node is T {
  return types.includes(node.type);
}

// Variable utilities
async function importVariableByKey(key: string): Promise<Variable> {
  try {
    return await figma.variables.importVariableByKeyAsync(key);
  } catch (error) {
    throw createError(`Failed to import variable with key "${key}"`, error);
  }
}

function findVariableInCollection(
  tokenName: string,
  variables: Record<string, any>,
  possibleKeyPatterns?: string[]
): any {
  // Try exact match first
  let tokenData = variables[tokenName];
  if (tokenData?.key) return tokenData;

  // Try common variations
  const defaultPatterns = [
    tokenName,
    `${tokenName}px`,
    `${tokenName}-token`,
    `token-${tokenName}`
  ];

  const patterns = possibleKeyPatterns || defaultPatterns;

  for (const pattern of patterns) {
    if (variables[pattern]?.key) {
      return variables[pattern];
    }
  }

  // Try finding by variable name
  for (const [key, data] of Object.entries(variables)) {
    if (data?.name && (
      data.name === tokenName ||
      data.name.endsWith(`-${tokenName}`) ||
      data.name.endsWith(`/${tokenName}`) ||
      data.name.includes(tokenName)
    )) {
      return data;
    }
  }

  return null;
}

// Collection utilities
function getVariablesFromLibrary(
  library: SavedLibrary,
  collectionNames: string[]
): Record<string, any> {
  let variables: Record<string, any> = {};

  if (!library.variables) return variables;

  // Try new structure first (organized by collection)
  for (const collectionName of collectionNames) {
    if (library.variables[collectionName]) {
      Object.assign(variables, library.variables[collectionName]);
    }
  }

  // If no variables found, try old structure
  if (Object.keys(variables).length === 0) {
    for (const [key, value] of Object.entries(library.variables)) {
      const keyLower = key.toLowerCase();
      if (collectionNames.some(name => keyLower.includes(name.toLowerCase()))) {
        variables[key] = value;
      }
    }
  }

  return variables;
}

// UI utilities
function notifySuccess(message: string): void {
  figma.notify(message);
}

function notifyError(message: string): void {
  figma.notify(message, { error: true });
}

function postMessageToUI(type: string, data: any = {}): void {
  figma.ui.postMessage({ type, ...data });
}

// Logging utilities
function logOperation(operation: string, data?: any): void {
  console.log(`🎯 ${operation}`, data || '');
}

function logSuccess(operation: string, details?: string): void {
  console.log(`✅ ${operation}${details ? `: ${details}` : ''}`);
}

function logError(operation: string, error: any): void {
  console.error(`❌ ${operation}:`, error);
}

// Message handler utilities
type MessageHandler = (msg: PluginMessage) => Promise<void> | void;

async function safeMessageHandler(handler: MessageHandler, msg: PluginMessage, handlerName: string): Promise<void> {
  try {
    await handler(msg);
  } catch (error) {
    handleAsyncError(error, `Message handler: ${handlerName}`);
  }
}

function createValidationTarget(): { targetNode: PageNode; targetName: string; selectedNodeId?: string; displayScope: 'page' | 'frame' | 'node' } {
  const selection = figma.currentPage.selection;

  // Always validate the entire page for comprehensive results
  // But track what the user wants to see based on their selection
  if (selection.length === 0) {
    return {
      targetNode: figma.currentPage,
      targetName: `entire page "${figma.currentPage.name}"`,
      displayScope: 'page'
    };
  }

  const selectedNode = selection[0];
  
  if (selectedNode.type === 'FRAME') {
    return {
      targetNode: figma.currentPage,
      targetName: `frame "${selectedNode.name}"`,
      selectedNodeId: selectedNode.id,
      displayScope: 'frame'
    };
  }

  // For any other selected node
  return {
    targetNode: figma.currentPage,
    targetName: `selected item "${selectedNode.name}"`,
    selectedNodeId: selectedNode.id,
    displayScope: 'node'
  };
}

async function selectNodeById(nodeId: string): Promise<void> {
  const node = await getNodeById(nodeId);
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
  notifySuccess(`Selected ${node.name}`);

  postMessageToUI('selection-changed', { nodeId });
}

// Enhanced error handling for token application
async function handleTokenApplication(
  msg: PluginMessage,
  tokenType: 'text-style' | 'spacing' | 'corner-radius' | 'color',
  applyFunction: (tokenName: string, nodeId: string) => Promise<void>
): Promise<void> {
  try {
    const tokenName = msg.styleName || msg.tokenName;
    validateRequiredParams({ tokenName, nodeId: msg.nodeId }, ['tokenName', 'nodeId']);

    await applyFunction(tokenName!, msg.nodeId!);

    postMessageToUI('applied', {
      ok: true,
      nodeId: msg.nodeId,
      styleName: tokenName,
      targetType: 'node'
    });
  } catch (error) {
    postMessageToUI('applied', {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      nodeId: msg.nodeId,
      styleName: msg.styleName || msg.tokenName
    });
  }
}

// Batch processing utility for multiple operations
async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  batchSize: number = 5
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));

    // Small delay between batches to prevent blocking
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}
// ============================================================================
// UI MANAGEMENT FUNCTIONS
// ============================================================================

function resizeUI(width: number, height: number): void {
  figma.ui.resize(width, height);
}

function setScreenSize(screen: keyof typeof UI_SIZES): void {
  if (screen === 'CUSTOM') return;
  const size = UI_SIZES[screen];
  resizeUI(size.width, size.height);
}

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

async function getAllSavedLibraries(): Promise<Record<string, SavedLibrary>> {
  return (await figma.clientStorage.getAsync('savedLibraries') || {}) as Record<string, SavedLibrary>;
}

async function getSavedLibrary(libraryKey: string): Promise<SavedLibrary | null> {
  return (await getAllSavedLibraries())[libraryKey] || null;
}

async function clearAllSavedLibraries(): Promise<void> {
  await figma.clientStorage.setAsync('savedLibraries', {});
  figma.notify('All saved design systems have been cleared');
}

// ============================================================================
// STATUS MANAGEMENT FUNCTIONS
// ============================================================================

async function getStatus(): Promise<number> {
  const storedStatus = await figma.clientStorage.getAsync('status') as number | null;
  const libraries = await getAllSavedLibraries();
  const libraryCount = Object.keys(libraries).length;

  console.log('Status check:', { storedStatus, libraryCount });

  // Reset stored status if no library is currently selected
  if (storedStatus != null && !selectedLibraryKey && libraryCount > 0) {
    console.log('Resetting stored status because no library is selected but libraries exist');
    await figma.clientStorage.setAsync('status', null);
    // Continue to default logic below
  } else if (storedStatus != null) {
    console.log(`Using stored status: ${storedStatus}`);
    return storedStatus;
  }

  // Default status based on available libraries (only when no stored status)
  console.log('selectedLibraryKey:', selectedLibraryKey);

  if (libraryCount === 0) {
    console.log('No stored status, no libraries - defaulting to Status 0 (Link screen)');
    return PLUGIN_STATUS.NO_LIBRARIES;
  } else if (!selectedLibraryKey) {
    console.log('No stored status, has libraries, no library selected - defaulting to Status 2 (Selection screen)');
    return PLUGIN_STATUS.SELECTION_MODE;
  } else {
    console.log('No stored status, library selected - defaulting to Status 3 (Home screen)');
    return PLUGIN_STATUS.READY;
  }
}

async function setStatus(status: number): Promise<void> {
  await figma.clientStorage.setAsync('status', status);
  console.log(`Status: ${status}`);
}

// ============================================================================
// TOKEN ANALYSIS FUNCTIONS
// ============================================================================

// Token detection patterns for different categories
const TOKEN_PATTERNS = {
  colors: ['color', 'colour', 'colors', 'colours'],
  spacing: ['spacing', 'space', 'gap', 'margin', 'padding'],
  cornerRadius: ['corner', 'radius', 'border-radius'],
  typography: ['typography', 'font-size', 'font-weight', 'line-height', 'letter-spacing'],
  shadows: ['shadow', 'blur', 'glow', 'elevation', 'effect'],
  borders: ['border', 'stroke', 'outline'],
  opacity: ['opacity', 'alpha'],
  sizing: ['size', 'width', 'height', 'dimension'],
  breakpoints: ['breakpoint', 'screen', 'viewport'],
  zIndex: ['z-index', 'layer', 'depth']
} as const;

function detectTokenTypeFromCollection(collectionName: string): keyof typeof TOKEN_PATTERNS | null {
  const name = collectionName.toLowerCase();

  for (const [tokenType, patterns] of Object.entries(TOKEN_PATTERNS)) {
    if (patterns.some(pattern => {
      if (tokenType === 'cornerRadius') {
        return name.includes('corner') || name.includes('radius') || name === 'corner radius' || name === 'border radius';
      }
      if (tokenType === 'borders') {
        return (name.includes('border') && !name.includes('radius')) || name.includes('stroke') || name.includes('outline');
      }
      return name.includes(pattern) || name === pattern;
    })) {
      return tokenType as keyof typeof TOKEN_PATTERNS;
    }
  }

  return null;
}

function detectTokenTypeFromVariable(variableName: string): keyof typeof TOKEN_PATTERNS | null {
  const name = variableName.toLowerCase();

  for (const [tokenType, patterns] of Object.entries(TOKEN_PATTERNS)) {
    if (patterns.some(pattern => {
      if (tokenType === 'borders') {
        return (name.includes('border') && !name.includes('radius')) || name.includes('stroke') || name.includes('outline');
      }
      return name.includes(pattern);
    })) {
      return tokenType as keyof typeof TOKEN_PATTERNS;
    }
  }

  return null;
}

function analyzeVariableCollection(collectionKey: string, variables: Record<string, any>) {
  const collectionName = collectionKey.toLowerCase();
  const variableCount = Object.keys(variables).length;
  const counts = {
    colors: 0, spacing: 0, cornerRadius: 0, typography: 0, shadows: 0,
    borders: 0, opacity: 0, sizing: 0, breakpoints: 0, zIndex: 0
  };

  // Try collection-level detection first
  const collectionType = detectTokenTypeFromCollection(collectionName);
  if (collectionType) {
    counts[collectionType] += variableCount;
    return counts;
  }

  // Fallback: analyze individual variables
  for (const variableName of Object.keys(variables)) {
    const variableType = detectTokenTypeFromVariable(variableName);
    if (variableType) {
      counts[variableType]++;
    }
  }

  return counts;
}

// Main token analysis function using Kova's detection rules
function analyzeLibraryTokens(lib: SavedLibrary) {
  const textStyles = Object.keys(lib.items || {}).length;
  const totals = {
    textStyles,
    colors: 0,
    spacing: 0,
    cornerRadius: 0,
    typography: 0,
    shadows: 0,
    borders: 0,
    opacity: 0,
    sizing: 0,
    breakpoints: 0,
    zIndex: 0,
    layerStyles: 0 // Note: layer styles aren't currently captured in variables
  };

  if (lib.variables) {
    for (const [collectionKey, variables] of Object.entries(lib.variables)) {
      const collectionCounts = analyzeVariableCollection(collectionKey, variables);

      // Add collection counts to totals
      Object.keys(collectionCounts).forEach(key => {
        if (key in totals) {
          totals[key as keyof typeof totals] += collectionCounts[key as keyof typeof collectionCounts];
        }
      });
    }
  }

  return totals;
}

// ============================================================================
// DESIGN SYSTEM EXPORT FUNCTIONS
// ============================================================================

function normalizeName(name: string): string {
  let n = name.replace(/\s*\/\s*/g, '/').trim();
  n = n.replace(/^Text\s*Style[s]?\//i, '');
  n = n.replace(/^Typography\//i, '');
  n = n.replace(/\/{2,}/g, '/').replace(/^\/|\/$/g, '');
  return n;
}

async function exportTextStyles(): Promise<Record<string, string>> {
  const styles = await figma.getLocalTextStylesAsync();
  const textStylesMap: Record<string, string> = {};
  const dups: Record<string, number> = {};

  for (const s of styles) {
    const keyName = normalizeName(s.name);
    if (textStylesMap[keyName]) {
      dups[keyName] = (dups[keyName] || 1) + 1;
      textStylesMap[`${keyName}#${dups[keyName]}`] = s.key;
    } else {
      textStylesMap[keyName] = s.key;
    }
  }

  return textStylesMap;
}

async function exportVariables(): Promise<Record<string, any>> {
  let variablesMap: Record<string, any> = {};

  try {
    if (figma.variables && figma.variables.getLocalVariablesAsync) {
      const variables = await figma.variables.getLocalVariablesAsync();
      console.log(`Found ${variables.length} local variables`);

      for (const variable of variables) {
        try {
          const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
          const collectionName = collection?.name || 'Unknown Collection';
          const collectionKey = collectionName.toLowerCase().replace(/\s+/g, '-');

          if (!variablesMap[collectionKey]) {
            variablesMap[collectionKey] = {};
          }

          variablesMap[collectionKey][variable.name] = {
            key: variable.key,
            id: variable.id,
            name: variable.name,
            collection: collectionName,
            collectionKey: collectionKey,
            type: variable.resolvedType,
            scopes: variable.scopes,
            values: variable.valuesByMode
          };
          console.log(`Exported variable: ${collectionKey}/${variable.name}`);
        } catch (error) {
          console.log(`Could not process variable ${variable.name}:`, error);
        }
      }
    } else {
      console.log('Variables API not available in this Figma version');
    }
  } catch (error) {
    console.log('Variables export failed:', error);
  }

  return variablesMap;
}

async function exportLibraryKeys(): Promise<void> {
  // Export text styles and variables
  const textStylesMap = await exportTextStyles();
  const variablesMap = await exportVariables();

  // Create library payload
  const libraryName = figma.root.name ?? 'Unknown Library';
  const libraryKey = figma.fileKey || `library_${Date.now()}`;

  const payload: SavedLibrary = {
    libraryName,
    libraryFileKey: figma.fileKey,
    generatedAt: new Date().toISOString(),
    type: 'design-system-export',
    version: 2,
    items: textStylesMap,
    variables: variablesMap
  };

  // Save to storage
  const allLibraries = await getAllSavedLibraries();
  allLibraries[libraryKey] = payload;
  await figma.clientStorage.setAsync('savedLibraries', allLibraries);

  // Calculate totals and notify
  const totalVariables = Object.keys(variablesMap).reduce((total: number, collectionKey: string) => {
    return total + Object.keys(variablesMap[collectionKey]).length;
  }, 0);

  const totalItems = Object.keys(textStylesMap).length + totalVariables;
  figma.notify(`Exported ${Object.keys(textStylesMap).length} text styles and ${totalVariables} variables from "${libraryName}"`);

  // Update status and notify UI
  await setStatus(PLUGIN_STATUS.SELECTION_MODE);

  figma.ui.postMessage({
    type: 'keys-exported',
    count: totalItems,
    textStylesCount: Object.keys(textStylesMap).length,
    variablesCount: totalVariables,
    libraryName: libraryName,
    fileName: `${libraryName}.json`
  });
}

// ============================================================================
// TEXT STYLE FUNCTIONS
// ============================================================================

async function importTextStyleByName(name: string, libraryKey: string): Promise<TextStyle> {
  const saved = await getSavedLibrary(libraryKey);
  if (!saved) throw new Error('No style map found for selected library.');

  const key = saved.items[name];
  if (!key) throw new Error(`Style "${name}" not found in ${saved.libraryName}.`);

  const style = await figma.importStyleByKeyAsync(key);
  if (style.type !== 'TEXT') throw new Error(`"${name}" is not a text style.`);
  return style as TextStyle;
}

function findAllTextNodesInSelection(): TextNode[] {
  const out: TextNode[] = [];
  for (const n of figma.currentPage.selection) {
    if (n.type === 'TEXT') out.push(n);
    else if ('findAll' in n) {
      out.push(...(n as ChildrenMixin).findAll((m) => m.type === 'TEXT') as TextNode[]);
    }
  }
  return out;
}

async function createLocalTextStyle(): Promise<void> {
  const existingStyles = await figma.getLocalTextStylesAsync();
  const existingStyle = existingStyles.find(style => style.name === 'Display/Large');

  if (existingStyle) {
    figma.notify('Display/Large text style already exists');
    return;
  }

  const fontOptions = [
    { family: 'Roboto', style: 'Regular' },
    { family: 'Inter', style: 'Regular' },
    { family: 'Arial', style: 'Regular' }
  ];

  for (const font of fontOptions) {
    try {
      await figma.loadFontAsync(font);

      const textStyle = figma.createTextStyle();
      textStyle.name = 'Display/Large';
      textStyle.fontName = font;
      textStyle.fontSize = 57;

      figma.notify(`Display/Large text style created with ${font.family}`);
      return;
    } catch (error) {
      continue;
    }
  }

  figma.notify('Failed to create text style: No compatible fonts available', { error: true });
}

async function applyStyleToSelection(styleName: string): Promise<void> {
  if (!selectedLibraryKey) {
    throw new Error('Please select a library first.');
  }

  try {
    const style = await importTextStyleByName(styleName, selectedLibraryKey);
    const nodes = findAllTextNodesInSelection();

    if (!nodes.length) {
      throw new Error('Select at least one text layer (or a frame with text).');
    }

    for (const node of nodes) {
      // Load the node font to avoid range assignment errors
      const font = node.fontName;
      if (font !== figma.mixed && font && typeof font === 'object') {
        try {
          await figma.loadFontAsync(font);
        } catch { }
      }
      await node.setRangeTextStyleIdAsync(0, node.characters.length, style.id);
    }

    const library = await getSavedLibrary(selectedLibraryKey);
    figma.notify(`Applied "${styleName}" from ${library?.libraryName} to ${nodes.length} text layer(s).`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    figma.notify(errorMsg, { error: true });
    throw error;
  }
}

async function applyStyleToNode(styleName: string, nodeId: string): Promise<void> {
  try {
    // Validate inputs
    validateRequiredParams({ styleName, nodeId }, ['styleName', 'nodeId']);
    validateLibrarySelected();

    // Import style and get node
    const style = await importTextStyleByName(styleName, selectedLibraryKey!);
    const node = await getNodeById(nodeId);

    if (!isNodeType<TextNode>(node, ['TEXT'])) {
      throw createError('Node is not a text node.');
    }

    const textNode = node as TextNode;

    // Load font to avoid errors
    const font = textNode.fontName;
    if (font !== figma.mixed && font && typeof font === 'object') {
      try {
        await figma.loadFontAsync(font);
      } catch {
        // Font loading failed, but continue anyway
      }
    }

    // Apply style
    await textNode.setRangeTextStyleIdAsync(0, textNode.characters.length, style.id);

    const library = await getSavedLibrary(selectedLibraryKey!);
    notifySuccess(`Applied "${styleName}" from ${library?.libraryName} to "${textNode.name}".`);
  } catch (error) {
    handleAsyncError(error, 'Apply text style');
    throw error;
  }
}

// Helper function to validate variable accessibility
async function validateVariableAccess(variable: Variable): Promise<boolean> {
  try {
    // Try to access the variable's properties to ensure it's valid
    const name = variable.name;
    const id = variable.id;
    const scopes = variable.scopes;

    // Check if the variable is accessible in the current context
    if (!name || !id || !scopes) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Variable access validation failed:', error);
    return false;
  }
}

// Helper function to import variable by key from team library
async function ensureVariableImportedByName(
  collectionMatch: (c: any) => boolean,
  variableName: string,
  type: VariableResolvedDataType = 'FLOAT'
): Promise<Variable> {
  // Check if we have team library access
  if (!figma.teamLibrary || !figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync) {
    throw new Error('Team Library API not available. Ensure your plugin has "teamlibrary" permission in manifest.json');
  }

  const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  const targetCollection = collections.find(collectionMatch);

  if (!targetCollection) {
    throw new Error('Target library collection not enabled. Please enable the design system library in the Variables panel.');
  }

  const libVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(targetCollection.key);
  const libVar = libVars.find(v => v.name === variableName && v.resolvedType === type);

  if (!libVar) {
    throw new Error(`Variable "${variableName}" not found in library collection "${targetCollection.name}".`);
  }

  return await figma.variables.importVariableByKeyAsync(libVar.key);
}

async function applySpacingTokenToNode(tokenName: string, nodeId: string): Promise<void> {
  logOperation('applySpacingTokenToNode', { tokenName, nodeId, selectedLibraryKey });

  try {
    // Validate inputs
    validateRequiredParams({ tokenName, nodeId }, ['tokenName', 'nodeId']);
    validateLibrarySelected();

    // Get library and variables
    const library = await getSavedLibrary(selectedLibraryKey!);
    if (!library) {
      throw createError('Selected library not found.');
    }

    const spacingVariables = getVariablesFromLibrary(library, ['spacing', 'space']);
    const spacingPatterns = [
      tokenName,
      `spacing-${tokenName}`,
      `space-${tokenName}`,
      `${tokenName}px`,
      `spacing/${tokenName}`,
      `space/${tokenName}`
    ];

    // Find token data
    const tokenData = findVariableInCollection(tokenName, spacingVariables, spacingPatterns);
    if (!tokenData?.key) {
      const availableTokens = Object.keys(spacingVariables).join(', ');
      throw createError(`Spacing token "${tokenName}" not found in library. Available tokens: ${availableTokens}`);
    }

    logSuccess('Found spacing token', `${tokenData.name} (key: ${tokenData.key})`);

    // Import variable
    const importedVariable = await importVariableByKey(tokenData.key);
    logSuccess('Imported variable', `${importedVariable.name} (ID: ${importedVariable.id})`);

    // Get node and apply spacing
    const node = await getNodeById(nodeId);

    if (!isNodeType<FrameNode>(node, ['FRAME', 'GROUP'])) {
      throw createError(`Cannot apply spacing to node type "${node.type}".`);
    }

    const containerNode = node as FrameNode;
    let applied = false;

    // Try auto layout gap first
    if ('layoutMode' in containerNode && containerNode.layoutMode !== 'NONE' && 'itemSpacing' in containerNode) {
      try {
        containerNode.setBoundVariable('itemSpacing', importedVariable);
        notifySuccess(`Applied spacing token "${tokenName}" as gap to "${containerNode.name}".`);
        applied = true;
      } catch (bindError) {
        logError('Failed to bind variable to itemSpacing', bindError);
      }
    }

    // Try padding as fallback
    if (!applied && 'paddingLeft' in containerNode) {
      try {
        containerNode.setBoundVariable('paddingLeft', importedVariable);
        containerNode.setBoundVariable('paddingRight', importedVariable);
        containerNode.setBoundVariable('paddingTop', importedVariable);
        containerNode.setBoundVariable('paddingBottom', importedVariable);
        notifySuccess(`Applied spacing token "${tokenName}" as padding to "${containerNode.name}".`);
        applied = true;
      } catch (bindError) {
        logError('Failed to bind variable to padding', bindError);
      }
    }

    if (!applied) {
      throw createError(`Cannot apply spacing to node "${node.name}" - no applicable spacing properties found or variable binding failed.`);
    }

  } catch (error) {
    handleAsyncError(error, 'Apply spacing token');
    throw error;
  }
}

async function applyCornerRadiusTokenToNode(tokenName: string, nodeId: string): Promise<void> {
  logOperation('applyCornerRadiusTokenToNode', { tokenName, nodeId, selectedLibraryKey });

  try {
    // Validate inputs
    validateRequiredParams({ tokenName, nodeId }, ['tokenName', 'nodeId']);
    validateLibrarySelected();

    // Get library and variables
    const library = await getSavedLibrary(selectedLibraryKey!);
    if (!library) {
      throw createError('Selected library not found.');
    }

    const cornerRadiusVariables = getVariablesFromLibrary(library, ['corner-radius', 'cornerRadius', 'radius', 'corner', 'border-radius', 'rounded']);
    const cornerPatterns = [
      tokenName,
      `radius-${tokenName}`,
      `corner-${tokenName}`,
      `${tokenName}px`,
      `radius/${tokenName}`,
      `corner/${tokenName}`
    ];

    // Find token data
    const tokenData = findVariableInCollection(tokenName, cornerRadiusVariables, cornerPatterns);
    if (!tokenData?.key) {
      const availableTokens = Object.keys(cornerRadiusVariables).join(', ');
      throw createError(`Corner radius token "${tokenName}" not found in library. Available tokens: ${availableTokens}`);
    }

    logSuccess('Found corner radius token', `${tokenData.name} (key: ${tokenData.key})`);

    // Import variable
    const importedVariable = await importVariableByKey(tokenData.key);
    logSuccess('Imported corner radius variable', `${importedVariable.name} (ID: ${importedVariable.id})`);

    // Get node and apply corner radius
    const node = await getNodeById(nodeId);

    if (!isNodeType<FrameNode | RectangleNode | EllipseNode>(node, ['FRAME', 'RECTANGLE', 'ELLIPSE'])) {
      throw createError(`Cannot apply corner radius to node type "${node.type}". Only frames, rectangles, and ellipses support corner radius.`);
    }

    const shapeNode = node as FrameNode | RectangleNode | EllipseNode;
    const corners = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'] as const;
    let cornersBound = 0;

    for (const corner of corners) {
      if (corner in shapeNode) {
        try {
          (shapeNode as any).setBoundVariable(corner, importedVariable);
          cornersBound++;
          logSuccess(`Bound ${corner} to variable`);
        } catch (cornerError) {
          logError(`Failed to bind variable to ${corner}`, cornerError);
        }
      }
    }

    if (cornersBound > 0) {
      notifySuccess(`Applied corner radius token "${tokenName}" to ${cornersBound} corners of "${shapeNode.name}".`);
    } else {
      throw createError(`Cannot apply corner radius to node "${node.name}" - no applicable corner radius properties found or variable binding failed.`);
    }

  } catch (error) {
    handleAsyncError(error, 'Apply corner radius token');
    throw error;
  }
}

async function applyCornerRadiusTokensToNode(cornerTokens: Record<string, string>, nodeId: string): Promise<void> {
  console.log('🎯 applyCornerRadiusTokensToNode called with:', { cornerTokens, nodeId, selectedLibraryKey });

  if (!selectedLibraryKey) {
    throw new Error('Please select a library first.');
  }

  try {
    const library = await getSavedLibrary(selectedLibraryKey);
    if (!library) {
      throw new Error('Selected library not found.');
    }

    // Get corner radius token data from stored library
    let cornerRadiusVariables: Record<string, any> = {};
    if (library.variables?.['corner-radius'] || library.variables?.cornerRadius) {
      cornerRadiusVariables = library.variables['corner-radius'] || library.variables.cornerRadius;
    } else if (library.variables) {
      // Handle old structure and search through all collections for corner radius-related variables
      for (const [collectionKey, variables] of Object.entries(library.variables)) {
        const collectionName = collectionKey.toLowerCase();

        // Check if this collection contains corner radius
        if (collectionName.includes('radius') || collectionName.includes('corner') ||
          collectionName.includes('border-radius') || collectionName.includes('rounded')) {
          // Add all variables from this collection
          Object.assign(cornerRadiusVariables, variables);
        } else {
          // Check individual variable names for corner radius-related terms
          for (const [varName, varData] of Object.entries(variables)) {
            const name = varName.toLowerCase();
            if (name.includes('radius') || name.includes('corner') || name.includes('rounded')) {
              cornerRadiusVariables[varName] = varData;
            }
          }
        }
      }
    }

    console.log('Available corner radius variables:', Object.keys(cornerRadiusVariables));

    // Get the node
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error('Node not found.');
    }

    // Apply corner radius based on node type
    if (node.type === 'FRAME' || node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
      const shapeNode = node as FrameNode | RectangleNode | EllipseNode;
      let appliedCount = 0;
      const appliedCorners: string[] = [];

      // Map corner names to Figma property names
      const cornerPropertyMap: Record<string, string> = {
        'topLeft': 'topLeftRadius',
        'topRight': 'topRightRadius',
        'bottomLeft': 'bottomLeftRadius',
        'bottomRight': 'bottomRightRadius'
      };

      // Apply each corner token
      for (const [corner, tokenName] of Object.entries(cornerTokens)) {
        console.log(`Applying ${corner}: ${tokenName}`);

        // Get the correct Figma property name
        const figmaProperty = cornerPropertyMap[corner];
        if (!figmaProperty) {
          console.log(`Unknown corner "${corner}", skipping`);
          continue;
        }

        // Find token data
        let tokenData = cornerRadiusVariables[tokenName];
        if (!tokenData || !tokenData.key) {
          console.log(`Token "${tokenName}" not found, skipping ${corner}`);
          continue;
        }

        try {
          // Import the variable
          const importedVariable = await figma.variables.importVariableByKeyAsync(tokenData.key);
          console.log(`✅ Successfully imported variable: "${importedVariable.name}" for ${corner}`);

          // Apply to the specific corner using the correct property name
          (shapeNode as any).setBoundVariable(figmaProperty, importedVariable);
          appliedCount++;
          appliedCorners.push(corner);
          console.log(`✅ Successfully bound ${figmaProperty} to variable`);
        } catch (error) {
          console.error(`Failed to apply ${corner}:`, error);
        }
      }

      if (appliedCount > 0) {
        figma.notify(`Applied corner radius tokens to ${appliedCount} corner${appliedCount > 1 ? 's' : ''} of "${shapeNode.name}".`);
      } else {
        throw new Error(`Cannot apply corner radius tokens to node "${node.name}" - no tokens were successfully applied.`);
      }
    } else {
      throw new Error(`Cannot apply corner radius to node type "${node.type}". Only frames, rectangles, and ellipses support corner radius.`);
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    figma.notify(errorMsg, { error: true });
    throw error;
  }
}

async function applyHardcodedCornerRadius(nodeId: string, corner: string, value: number): Promise<void> {
  console.log('🎯 applyHardcodedCornerRadius called with:', { nodeId, corner, value });

  try {
    // Get the node
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error('Node not found.');
    }

    // Apply corner radius based on node type
    if (node.type === 'FRAME' || node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
      const shapeNode = node as FrameNode | RectangleNode | EllipseNode;

      // Map corner names to Figma property names
      const cornerPropertyMap: Record<string, string> = {
        'topLeft': 'topLeftRadius',
        'topRight': 'topRightRadius',
        'bottomLeft': 'bottomLeftRadius',
        'bottomRight': 'bottomRightRadius'
      };

      // Get the correct Figma property name
      const figmaProperty = cornerPropertyMap[corner];
      if (!figmaProperty) {
        throw new Error(`Unknown corner "${corner}"`);
      }

      // Apply the hardcoded value
      (shapeNode as any)[figmaProperty] = value;
      console.log(`✅ Successfully set ${figmaProperty} to ${value} on "${shapeNode.name}"`);

      figma.notify(`Set ${corner} corner radius to ${value} on "${shapeNode.name}".`);
    } else {
      throw new Error(`Cannot apply corner radius to node type "${node.type}". Only frames, rectangles, and ellipses support corner radius.`);
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    figma.notify(errorMsg, { error: true });
    throw error;
  }
}

async function applyColorTokenToNode(tokenName: string, nodeId: string): Promise<void> {
  logOperation('applyColorTokenToNode', { tokenName, nodeId, selectedLibraryKey });

  try {
    // Validate inputs
    validateRequiredParams({ tokenName, nodeId }, ['tokenName', 'nodeId']);
    validateLibrarySelected();

    // Get library and variables
    const library = await getSavedLibrary(selectedLibraryKey!);
    if (!library) {
      throw createError('Selected library not found.');
    }

    const colorVariables = getVariablesFromLibrary(library, ['colors', 'color', 'colour', 'palette', 'theme']);
    const colorPatterns = [
      tokenName,
      `color-${tokenName}`,
      `${tokenName}-color`,
      `colors/${tokenName}`,
      `color/${tokenName}`
    ];

    // Find token data
    const tokenData = findVariableInCollection(tokenName, colorVariables, colorPatterns);
    if (!tokenData?.key) {
      const availableTokens = Object.keys(colorVariables).join(', ');
      throw createError(`Color token "${tokenName}" not found in library. Available tokens: ${availableTokens}`);
    }

    logSuccess('Found color token', `${tokenData.name} (key: ${tokenData.key})`);

    // Import variable
    const importedVariable = await importVariableByKey(tokenData.key);
    logSuccess('Imported color variable', `${importedVariable.name} (ID: ${importedVariable.id})`);

    // Get node and apply color
    const node = await getNodeById(nodeId);
    let applied = false;

    // Try to bind to fill color first
    if ('fills' in node && Array.isArray((node as any).fills) && (node as any).fills.length > 0) {
      try {
        const nodeWithFills = node as any;
        const newFills = [...nodeWithFills.fills];

        if (newFills[0] && newFills[0].type === 'SOLID') {
          const newPaint = {
            ...newFills[0],
            boundVariables: {
              color: {
                type: 'VARIABLE_ALIAS' as const,
                id: importedVariable.id
              }
            }
          };
          newFills[0] = newPaint;
          nodeWithFills.fills = newFills;
          notifySuccess(`Applied color token "${tokenName}" as fill to "${node.name}".`);
          applied = true;
        }
      } catch (fillError) {
        logError('Failed to bind variable to fill', fillError);
      }
    }

    // Try stroke color as fallback
    if (!applied && 'strokes' in node && Array.isArray((node as any).strokes) && (node as any).strokes.length > 0) {
      try {
        const nodeWithStrokes = node as any;
        const newStrokes = [...nodeWithStrokes.strokes];

        if (newStrokes[0] && newStrokes[0].type === 'SOLID') {
          const newPaint = {
            ...newStrokes[0],
            boundVariables: {
              color: {
                type: 'VARIABLE_ALIAS' as const,
                id: importedVariable.id
              }
            }
          };
          newStrokes[0] = newPaint;
          nodeWithStrokes.strokes = newStrokes;
          notifySuccess(`Applied color token "${tokenName}" as stroke to "${node.name}".`);
          applied = true;
        }
      } catch (strokeError) {
        logError('Failed to bind variable to stroke', strokeError);
      }
    }

    if (!applied) {
      throw createError(`Cannot apply color to node "${node.name}" - no applicable color properties found or variable binding failed.`);
    }

  } catch (error) {
    handleAsyncError(error, 'Apply color token');
    throw error;
  }
}

async function runValidation(target: FrameNode | PageNode, library: SavedLibrary, options: { textStyles: boolean; spacing: boolean; cornerRadius?: boolean; colors?: boolean; typography?: boolean; shadows?: boolean; borders?: boolean; opacity?: boolean; sizing?: boolean }, targetName?: string) {
  const results: any[] = [];
  const visitedNodes = new Set<string>(); // Prevent infinite recursion
  let nodeCount = 0;
  const MAX_NODES = 5000; // Prevent processing too many nodes (increased for complex designs)

  // Helper function to check if spacing property is bound to a design system variable
  function isSpacingBoundToToken(node: FrameNode, property: string): boolean {
    try {
      const boundVariables = node.boundVariables;
      if (!boundVariables) return false;

      const propertyBinding = boundVariables[property as keyof typeof boundVariables];
      return propertyBinding !== undefined && propertyBinding !== null;
    } catch (error) {
      // Only log errors, not every check
      if (nodeCount % 100 === 0) {
        console.log(`Error checking spacing binding for ${property}:`, error);
      }
      return false;
    }
  }

  // Helper function to traverse all nodes with safety checks
  function traverseNode(node: SceneNode, frameName: string): void {
    try {
      // Safety checks
      if (!node || !node.id) return;
      if (visitedNodes.has(node.id)) return; // Prevent circular references
      if (nodeCount >= MAX_NODES) return; // Prevent excessive processing

      visitedNodes.add(node.id);
      nodeCount++;

      // Log progress every 100 nodes instead of every node
      if (nodeCount % 100 === 0) {
        console.log(`Processing node ${nodeCount}: "${node.name}" (${node.type})`);
      }

      // Text style validation
      if (options.textStyles && node.type === 'TEXT') {
        const textNode = node as TextNode;

        // Check if text style is applied
        if (!textNode.textStyleId || textNode.textStyleId === '') {
          results.push({
            type: 'text-style',
            issue: 'No text style applied',
            node: {
              id: textNode.id,
              name: textNode.name,
              characters: textNode.characters.substring(0, 50) // Limit text preview
            },
            frameName: textNode.name,
            nodeType: 'TEXT'
          });
        }
      }

      // Spacing validation
      if (options.spacing && (node.type === 'FRAME' || node.type === 'GROUP')) {
        const containerNode = node as FrameNode;

        // Check padding (only if it exists and is accessible)
        try {
          if ('paddingLeft' in containerNode && containerNode.paddingLeft && containerNode.paddingLeft > 0) {
            const paddingValue = containerNode.paddingLeft;
            if (!isSpacingBoundToToken(containerNode, 'paddingLeft')) {
              results.push({
                type: 'spacing',
                issue: `Hardcoded padding (${paddingValue}px)`,
                node: {
                  id: containerNode.id,
                  name: containerNode.name
                },
                frameName: containerNode.name,
                nodeType: 'SPACING',
                value: paddingValue
              });
            }
          }
        } catch (error) {
          // Silent error handling for performance
        }

        // Check gaps in auto layout
        try {
          if ('layoutMode' in containerNode && 'itemSpacing' in containerNode &&
            containerNode.layoutMode !== 'NONE' && containerNode.itemSpacing > 0) {
            const gapValue = containerNode.itemSpacing;
            if (!isSpacingBoundToToken(containerNode, 'itemSpacing')) {
              results.push({
                type: 'spacing',
                issue: `Hardcoded gap (${gapValue}px)`,
                node: {
                  id: containerNode.id,
                  name: containerNode.name
                },
                frameName: containerNode.name,
                nodeType: 'SPACING',
                value: gapValue
              });
            }
          }
        } catch (error) {
          // Silent error handling for performance
        }
      }

      // Corner radius validation
      if (options.cornerRadius && (node.type === 'FRAME' || node.type === 'RECTANGLE' || node.type === 'ELLIPSE')) {
        const shapeNode = node as FrameNode | RectangleNode | EllipseNode;

        try {
          const corners = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'] as const;
          const cornerIssues: any[] = [];
          const cornerValues: any = {};

          for (const corner of corners) {
            if (corner in shapeNode) {
              const radiusValue = (shapeNode as any)[corner];
              const boundVariables = shapeNode.boundVariables;
              const isCornerBound = boundVariables && (boundVariables as any)[corner] !== undefined && (boundVariables as any)[corner] !== null;

              if (typeof radiusValue === 'number' && radiusValue >= 0) {
                cornerValues[corner] = {
                  value: radiusValue,
                  hasToken: isCornerBound
                };
              } else {
                cornerValues[corner] = {
                  value: null,
                  hasToken: false
                };
              }

              if (typeof radiusValue === 'number' && radiusValue > 0 && !isCornerBound) {
                cornerIssues.push({
                  corner: corner,
                  value: radiusValue
                });
              }
            }
          }

          if (cornerIssues.length > 0) {
            results.push({
              type: 'corner-radius',
              issue: `Hardcoded corner radius (${cornerIssues.length} corner${cornerIssues.length > 1 ? 's' : ''})`,
              node: {
                id: shapeNode.id,
                name: shapeNode.name
              },
              frameName: shapeNode.name,
              nodeType: 'CORNER_RADIUS',
              cornerValues: cornerValues,
              cornerCount: cornerIssues.length
            });
          }
        } catch (error) {
          // Silent error handling for performance
        }
      }

      // Color validation
      if (options.colors) {
        try {
          // Check fill colors for nodes that support fills (excluding TEXT nodes)
          if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0 && node.type !== 'TEXT') {
            const nodeWithFills = node as any;
            for (let i = 0; i < nodeWithFills.fills.length; i++) {
              const fill = nodeWithFills.fills[i];
              if (fill && fill.type === 'SOLID' && fill.visible !== false) {
                const boundVariables = nodeWithFills.boundVariables;
                const fillBoundVariable = boundVariables && boundVariables.fills && boundVariables.fills[i];

                if (!fillBoundVariable) {
                  results.push({
                    type: 'color',
                    issue: `Hardcoded fill color`,
                    node: {
                      id: node.id,
                      name: node.name
                    },
                    frameName: node.name,
                    nodeType: 'COLOR',
                    property: 'fill'
                  });
                }
              }
            }
          }

          // Check stroke colors
          if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
            const nodeWithStrokes = node as any;
            for (let i = 0; i < nodeWithStrokes.strokes.length; i++) {
              const stroke = nodeWithStrokes.strokes[i];
              if (stroke && stroke.type === 'SOLID' && stroke.visible !== false) {
                const boundVariables = nodeWithStrokes.boundVariables;
                const strokeBoundVariable = boundVariables && boundVariables.strokes && boundVariables.strokes[i];

                if (!strokeBoundVariable) {
                  results.push({
                    type: 'color',
                    issue: `Hardcoded stroke color`,
                    node: {
                      id: node.id,
                      name: node.name
                    },
                    frameName: node.name,
                    nodeType: 'COLOR',
                    property: 'stroke'
                  });
                }
              }
            }
          }

          // Check text color for text nodes
          if (node.type === 'TEXT') {
            const textNode = node as TextNode;
            const boundVariables = textNode.boundVariables;
            const textColorBound = boundVariables && boundVariables.fills;

            if (!textColorBound && textNode.fills && Array.isArray(textNode.fills) && textNode.fills.length > 0) {
              const fill = textNode.fills[0];
              if (fill && fill.type === 'SOLID' && fill.visible !== false) {
                results.push({
                  type: 'color',
                  issue: `Hardcoded fill color - not using design token`,
                  node: {
                    id: node.id,
                    name: node.name
                  },
                  frameName: node.name,
                  nodeType: 'COLOR',
                  property: 'fill'
                });
              }
            }
          }
        } catch (error) {
          // Silent error handling for performance
        }
      }

      // Recursively check children with safety checks
      if ('children' in node && node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          if (child && typeof child === 'object') {
            traverseNode(child, frameName);
          }
        }
      }

      // Progress logging handled above
    } catch (error) {
      console.log(`Error processing node ${node?.id || 'unknown'}:`, error);
      // Continue processing other nodes
    }
  }

  try {
    console.log('Starting validation...');

    // Start validation from the target (frame or page)
    const displayName = targetName || target.name;

    if (target.type === 'PAGE') {
      // For pages, iterate through all top-level children
      console.log(`Validating page with ${target.children.length} top-level nodes`);
      for (const child of target.children) {
        if (child && typeof child === 'object') {
          traverseNode(child, displayName);
        }
      }
    } else {
      // For frames, validate the frame itself
      traverseNode(target, displayName);
    }

    console.log(`Validation complete. Found ${results.length} issues after checking ${nodeCount} nodes`);

    // Debug: Log corner radius results
    const cornerRadiusResults = results.filter(r => r.type === 'corner-radius');
    console.log(`Corner radius results (${cornerRadiusResults.length}):`, cornerRadiusResults.map(r => ({
      frameName: r.frameName,
      nodeId: r.node.id,
      cornerCount: r.cornerCount,
      cornerValues: r.cornerValues
    })));

    return results;
  } catch (error) {
    console.error('Validation failed:', error);
    figma.notify('Validation failed. Please try again.', { error: true });
    return [];
  }
}



// ============================================================================
// MESSAGE HANDLER FUNCTIONS
// ============================================================================

async function handleGetVariables(msg: PluginMessage, variableType: 'spacing' | 'colors' | 'corner-radius'): Promise<void> {
  if (!selectedLibraryKey) return;

  const library = await getSavedLibrary(selectedLibraryKey);
  if (!library?.variables) {
    postMessageToUI(`${variableType}-data`, { [variableType]: {} });
    return;
  }

  const collectionMappings = {
    'spacing': ['spacing', 'space', 'gap', 'margin', 'padding'],
    'colors': ['colors', 'color', 'colour', 'palette', 'theme'],
    'corner-radius': ['corner-radius', 'cornerRadius', 'radius', 'corner', 'border-radius', 'rounded']
  };

  const variables = getVariablesFromLibrary(library, collectionMappings[variableType]);
  logSuccess(`Loading ${Object.keys(variables).length} ${variableType} variables`);

  const responseKey = variableType === 'corner-radius' ? 'cornerRadius' : variableType;
  postMessageToUI(`${variableType}-data`, { [responseKey]: variables });
}

async function handleRunValidation(msg: PluginMessage): Promise<void> {
  validateRequiredParams({ options: msg.options }, ['options']);
  validateLibrarySelected();

  const library = await getSavedLibrary(selectedLibraryKey!);
  if (!library) {
    throw createError('Selected library not found');
  }

  // Ensure options has required properties with defaults
  const validationOptions = {
    textStyles: msg.options?.textStyles ?? false,
    spacing: msg.options?.spacing ?? false,
    cornerRadius: msg.options?.cornerRadius ?? false,
    colors: msg.options?.colors ?? false,
    typography: msg.options?.typography ?? false,
    shadows: msg.options?.shadows ?? false,
    borders: msg.options?.borders ?? false,
    opacity: msg.options?.opacity ?? false,
    sizing: msg.options?.sizing ?? false
  };

  logOperation('Running validation', validationOptions);

  // Check if user wants to validate a specific node
  let targetNode: FrameNode | PageNode;
  let targetName: string;
  let selectedNodeId: string | undefined;
  let displayScope: 'page' | 'frame' | 'node';

  if (msg.targetNodeId) {
    // User selected a specific asset to validate
    try {
      const specificNode = await getNodeById(msg.targetNodeId);
      if (specificNode.type === 'FRAME') {
        targetNode = specificNode as FrameNode;
        targetName = `frame "${specificNode.name}"`;
        selectedNodeId = msg.targetNodeId;
        displayScope = 'frame';
      } else {
        // For non-frame nodes, validate the entire page but filter to this node
        targetNode = figma.currentPage;
        targetName = `selected item "${specificNode.name}"`;
        selectedNodeId = msg.targetNodeId;
        displayScope = 'node';
      }
    } catch (error) {
      // If node not found, fall back to normal validation
      const validationTarget = createValidationTarget();
      targetNode = validationTarget.targetNode;
      targetName = validationTarget.targetName;
      selectedNodeId = validationTarget.selectedNodeId;
      displayScope = validationTarget.displayScope;
    }
  } else {
    // Normal validation flow
    const validationTarget = createValidationTarget();
    targetNode = validationTarget.targetNode;
    targetName = validationTarget.targetName;
    selectedNodeId = validationTarget.selectedNodeId;
    displayScope = validationTarget.displayScope;
  }

  // Always run validation on the entire page for comprehensive results
  const validationPromise = runValidation(targetNode, library, validationOptions, targetName);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(createError('Validation timeout')), 30000)
  );

  let allValidationResults = await Promise.race([validationPromise, timeoutPromise]) as any[];
  
  // Helper function to check if a node is a descendant of the selected node
  async function isNodeDescendantOf(nodeId: string | undefined, ancestorId: string): Promise<boolean> {
    if (!nodeId) return false;
    try {
      const node = await getNodeById(nodeId);
      let current = node.parent;
      
      while (current) {
        if (current.id === ancestorId) {
          return true;
        }
        current = current.parent;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Filter results based on display scope
  let displayedResults = allValidationResults;
  
  if (displayScope === 'node' && selectedNodeId) {
    // Show issues for the selected node AND all its nested children
    const filteredResults = [];
    for (const result of allValidationResults) {
      if (result.node?.id === selectedNodeId || await isNodeDescendantOf(result.node?.id, selectedNodeId)) {
        filteredResults.push(result);
      }
    }
    displayedResults = filteredResults;
    logOperation('Filtered validation results for selected node and its children', { selectedNodeId, totalResults: allValidationResults.length, displayedResults: displayedResults.length });
  } else if (displayScope === 'frame' && selectedNodeId) {
    // Show issues for the selected frame AND all its nested children
    const filteredResults = [];
    for (const result of allValidationResults) {
      if (result.node?.id === selectedNodeId || await isNodeDescendantOf(result.node?.id, selectedNodeId)) {
        filteredResults.push(result);
      }
    }
    displayedResults = filteredResults;
    logOperation('Filtered validation results for selected frame and its children', { selectedNodeId, totalResults: allValidationResults.length, displayedResults: displayedResults.length });
  }
  // For 'page' scope, show all results (no filtering needed)

  // Resize UI and send results
  setScreenSize('VALIDATION_RESULTS_SCREEN');

  postMessageToUI('validation-results', {
    results: displayedResults,
    allResults: allValidationResults, // Store all results for future filtering
    library: library,
    targetName: targetName,
    targetType: 'page', // Always page since we always validate the full page
    displayScope: displayScope,
    selectedNodeId: selectedNodeId,
    options: validationOptions
  });

  logSuccess(`Validation completed with ${displayedResults.length} displayed results (${allValidationResults.length} total)`);
}

async function handleSelectNode(msg: PluginMessage): Promise<void> {
  if (!msg.nodeId) return;

  try {
    await selectNodeById(msg.nodeId);
  } catch (error) {
    logError('Error selecting node', error);
    notifyError('Error selecting node');
  }
}

async function handleSelectAndPositionNode(msg: PluginMessage): Promise<void> {
  if (!msg.nodeId) return;

  try {
    const node = await getNodeById(msg.nodeId);
    if (!node) {
      throw new Error('Node not found');
    }

    // Select the node
    figma.currentPage.selection = [node];

    // Position the viewport to show the node
    if (msg.position) {
      // Get the node's bounds
      const bounds = node.absoluteBoundingBox;
      if (bounds) {
        // Calculate the center point of the node
        const nodeCenterX = bounds.x + bounds.width / 2;
        const nodeCenterY = bounds.y + bounds.height / 2;

        // Get viewport dimensions
        const viewport = figma.viewport;
        const viewportWidth = viewport.bounds.width;
        const viewportHeight = viewport.bounds.height;

        // Calculate target position based on requirements
        let targetX = nodeCenterX; // Center horizontally by default
        let targetY = nodeCenterY;

        if (msg.position.horizontal === 'center') {
          // Node center should be at viewport center horizontally
          targetX = nodeCenterX;
        }

        // Position vertically at specified percentage from top
        // If vertical is 0.8, the node should be at 80% down from the top of viewport
        const viewportTop = viewport.bounds.y;
        const viewportBottom = viewport.bounds.y + viewport.bounds.height;
        targetY = viewportTop + (viewportHeight * msg.position.vertical);

        // Scroll to position the node at the target location
        figma.viewport.scrollAndZoomIntoView([node]);
        
        // Fine-tune the position by calculating the offset needed
        const currentViewport = figma.viewport.bounds;
        const currentCenterX = currentViewport.x + currentViewport.width / 2;
        const currentTargetY = currentViewport.y + (currentViewport.height * msg.position.vertical);
        
        const offsetX = nodeCenterX - currentCenterX;
        const offsetY = nodeCenterY - currentTargetY;
        
        // Apply the offset to center horizontally and position at 80% vertically
        figma.viewport.center = {
          x: figma.viewport.center.x + offsetX,
          y: figma.viewport.center.y + offsetY
        };
      }
    } else {
      // Fallback to default behavior
      figma.viewport.scrollAndZoomIntoView([node]);
    }

    console.log(`Selected and positioned node: ${node.name}`);
  } catch (error) {
    logError('Error selecting and positioning node', error);
    notifyError('Error selecting and positioning node');
  }
}



async function handleGetCurrentNodeValues(msg: PluginMessage): Promise<void> {
  if (!msg.nodeId) {
    throw new Error('Node ID is required');
  }

  try {
    const node = await getNodeById(msg.nodeId);
    const values: any = {};

    // Get spacing values
    if ('itemSpacing' in node || 'paddingLeft' in node) {
      values.spacing = {};
      
      if ('itemSpacing' in node) {
        values.spacing.itemSpacing = (node as any).itemSpacing;
      }
      
      if ('paddingLeft' in node) {
        values.spacing.paddingLeft = (node as any).paddingLeft;
        values.spacing.paddingRight = (node as any).paddingRight;
        values.spacing.paddingTop = (node as any).paddingTop;
        values.spacing.paddingBottom = (node as any).paddingBottom;
      }
    }

    // Get corner radius values
    if ('topLeftRadius' in node) {
      values.cornerRadius = {};
      const corners = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'] as const;
      
      corners.forEach(corner => {
        if (corner in node) {
          values.cornerRadius[corner] = (node as any)[corner];
        }
      });
    }

    console.log('🔄 Sending current node values:', msg.nodeId, values);

    figma.ui.postMessage({
      type: 'current-node-values-response',
      nodeId: msg.nodeId,
      values: values
    });

  } catch (error) {
    console.error('Error getting current node values:', error);
    figma.ui.postMessage({
      type: 'current-node-values-response',
      nodeId: msg.nodeId,
      values: {}
    });
  }
}

async function handleValidateIssueResolution(msg: PluginMessage): Promise<void> {
  console.log('🔍 Validating issue resolution:', msg);
  
  try {
    const nodeId = msg.nodeId;
    const issueType = msg.issueType;
    const validationId = msg.validationId;
    
    if (!nodeId || !issueType) {
      postMessageToUI('validation-response', {
        validationId,
        isFixed: false,
        reason: 'Missing node ID or issue type'
      });
      return;
    }

    // Get the node
    const node = await getNodeById(nodeId);
    let isFixed = false;
    let reason = '';

    // Validate based on issue type
    switch (issueType) {
      case 'text-style':
        // Check if text node has a text style applied
        if (node.type === 'TEXT') {
          const textNode = node as TextNode;
          if (textNode.textStyleId && textNode.textStyleId !== '') {
            isFixed = true;
          } else {
            reason = 'No text style applied to this text layer';
          }
        } else {
          reason = 'Node is not a text layer';
        }
        break;

      case 'spacing':
        // Check if node has spacing tokens bound
        if (node.type === 'FRAME') {
          const frameNode = node as FrameNode;
          const boundVariables = frameNode.boundVariables;
          
          if (boundVariables) {
            // Check for spacing-related bound variables
            const spacingProperties = ['itemSpacing', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'];
            const hasSpacingToken = spacingProperties.some(prop => 
              boundVariables[prop as keyof typeof boundVariables] !== undefined
            );
            
            if (hasSpacingToken) {
              isFixed = true;
            } else {
              reason = 'No spacing tokens applied to this frame';
            }
          } else {
            reason = 'No design tokens bound to this frame';
          }
        } else {
          reason = 'Node does not support spacing tokens';
        }
        break;

      case 'corner-radius':
        // Check if node has corner radius tokens bound
        if (node.type === 'FRAME' || node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
          const shapeNode = node as FrameNode | RectangleNode | EllipseNode;
          const boundVariables = shapeNode.boundVariables;
          
          if (boundVariables) {
            // Check for corner radius bound variables
            const cornerProperties = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
            const hasCornerToken = cornerProperties.some(prop => 
              boundVariables[prop as keyof typeof boundVariables] !== undefined
            );
            
            if (hasCornerToken) {
              isFixed = true;
            } else {
              reason = 'No corner radius tokens applied to this shape';
            }
          } else {
            reason = 'No design tokens bound to this shape';
          }
        } else {
          reason = 'Node does not support corner radius tokens';
        }
        break;

      case 'color':
        // Check if node has color tokens bound
        if ('fills' in node || 'strokes' in node) {
          const nodeWithColor = node as any;
          const boundVariables = nodeWithColor.boundVariables;
          
          if (boundVariables) {
            // Check for color-related bound variables
            const hasColorToken = boundVariables.fills !== undefined || boundVariables.strokes !== undefined;
            
            if (hasColorToken) {
              isFixed = true;
            } else {
              reason = 'No color tokens applied to this element';
            }
          } else {
            reason = 'No design tokens bound to this element';
          }
        } else {
          reason = 'Node does not support color tokens';
        }
        break;

      default:
        reason = `Unknown issue type: ${issueType}`;
    }

    // Send response back to UI
    postMessageToUI('validation-response', {
      validationId,
      isFixed,
      reason: isFixed ? 'Issue resolved with design tokens' : reason
    });

    console.log('🔍 Validation result:', { isFixed, reason });

  } catch (error) {
    console.error('🔍 Validation error:', error);
    postMessageToUI('validation-response', {
      validationId: msg.validationId,
      isFixed: false,
      reason: 'Error during validation: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

async function handleLibrarySelection(msg: PluginMessage): Promise<void> {
  selectedLibraryKey = msg.libraryKey || null;
  const library = selectedLibraryKey ? await getSavedLibrary(selectedLibraryKey) : null;

  if (selectedLibraryKey && library) {
    setScreenSize('HOME_SCREEN');
    await setStatus(PLUGIN_STATUS.READY);

    // Send UI mode first
    postMessageToUI('ui-mode', {
      mode: 'home',
      fileName: figma.root.name ?? 'Unknown Library'
    });

    // Get spacing variables for the library
    const spacingVariables = getVariablesFromLibrary(library, ['spacing', 'space']);
    const tokenCounts = analyzeLibraryTokens(library);

    // Send library information
    postMessageToUI('library-selected', {
      library: {
        name: library.libraryName,
        count: Object.keys(library.items).length,
        textStylesCount: tokenCounts.textStyles,
        variablesCount: library.variables ? Object.keys(library.variables).length : 0,
        spacingVariablesCount: tokenCounts.spacing,
        spacingVariables: spacingVariables,
        tokenCounts: tokenCounts,
        key: selectedLibraryKey
      }
    });
  } else {
    setScreenSize('SELECTION_SCREEN');
    await setStatus(PLUGIN_STATUS.SELECTION_MODE);
    postMessageToUI('ui-mode', {
      mode: 'selection',
      fileName: figma.root.name ?? 'Unknown Library'
    });
  }

  notifySuccess(`Selected library: ${library?.libraryName || 'None'}`);
}

// ============================================================================
// MAIN MESSAGE HANDLER
// ============================================================================

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'get-ui-mode') {
    console.log('UI requesting mode...');
    console.log('selectedLibraryKey:', selectedLibraryKey);

    const libraries = await getAllSavedLibraries();
    const libraryCount = Object.keys(libraries).length;
    const status = await getStatus();
    console.log('Library count:', libraryCount);
    console.log('Current status:', status);

    let mode: 'export' | 'link' | 'selection' | 'home' | 'export-instructions' = 'selection';

    // Check stored status first
    if (status === 1) {
      mode = 'export';
      console.log('→ Export screen (user went to design system)');
    } else if (libraryCount === 0) {
      mode = 'link';
      console.log('→ Link screen (no libraries)');
    } else if (selectedLibraryKey) {
      mode = 'home';
      console.log('→ Home screen (library selected)');
    } else {
      mode = 'selection';
      console.log('→ Selection screen (no library selected)');
    }

    console.log(`Sending UI mode: ${mode}`);

    // Resize based on mode
    if (mode === 'export') {
      setScreenSize('EXPORT_SCREEN');
    } else if (mode === 'link') {
      setScreenSize('LINK_SCREEN');
    } else if (mode === 'selection') {
      setScreenSize('SELECTION_SCREEN');
    } else if (mode === 'home') {
      setScreenSize('HOME_SCREEN');
    } else if (mode === 'export-instructions') {
      setScreenSize('EXPORT_INSTRUCTIONS_SCREEN');
    }

    figma.ui.postMessage({
      type: 'ui-mode',
      mode: mode,
      fileName: figma.root.name ?? 'Unknown Library'
    });
  } else if (msg.type === 'switch-mode') {
    // Resize based on mode
    if (msg.mode === 'export') {
      setScreenSize('EXPORT_SCREEN');
      await setStatus(1);
    } else if (msg.mode === 'link') {
      setScreenSize('LINK_SCREEN');
      await setStatus(0);
    } else if (msg.mode === 'selection') {
      setScreenSize('SELECTION_SCREEN');
      await setStatus(2);
    } else if (msg.mode === 'home') {
      setScreenSize('HOME_SCREEN');
      await setStatus(3);
    } else if (msg.mode === 'export-instructions') {
      setScreenSize('EXPORT_INSTRUCTIONS_SCREEN');
      await setStatus(4);
    } else if (msg.mode === 'export-confirmation') {
      setScreenSize('EXPORT_CONFIRMATION_SCREEN');
    } else if (msg.mode === 'validation-results') {
      setScreenSize('VALIDATION_RESULTS_SCREEN');
    }

    figma.ui.postMessage({
      type: 'ui-mode',
      mode: msg.mode || 'link',
      fileName: figma.root.name ?? 'Unknown Library'
    });
  } else if (msg.type === 'export-keys') {
    await exportLibraryKeys();
  } else if (msg.type === 'get-saved-libraries') {
    const libraries = await getAllSavedLibraries();

    figma.ui.postMessage({
      type: 'saved-libraries',
      libraries: Object.keys(libraries).map((key) => {
        const lib = libraries[key];
        const tokenCounts = analyzeLibraryTokens(lib);

        return {
          key,
          name: lib.libraryName,
          generatedAt: lib.generatedAt,
          count: Object.keys(lib.items).length,
          tokenCounts: tokenCounts,
          displayName: `<strong>${lib.libraryName}</strong><br>(${tokenCounts.textStyles} Text Styles, ${tokenCounts.colors} Colors, ${tokenCounts.spacing} Spacing, ${tokenCounts.cornerRadius} Corner Radius, ${tokenCounts.layerStyles} Layer Styles)`
        };
      })
    });
  } else if (msg.type === 'select-library') {
    await safeMessageHandler(handleLibrarySelection, msg, 'select-library');
  } else if (msg.type === 'create-text-style') {
    await createLocalTextStyle();
  } else if (msg.type === 'apply-text-style') {
    if (msg.nodeId) {
      await safeMessageHandler(
        (msg) => handleTokenApplication(msg, 'text-style', applyStyleToNode),
        msg,
        'apply-text-style'
      );
    } else {
      // Legacy behavior for selection
      try {
        const styleName = msg.styleName || 'Display/Large';
        await applyStyleToSelection(styleName);
        postMessageToUI('applied', {
          ok: true,
          styleName: styleName,
          targetType: 'selection'
        });
      } catch (error) {
        postMessageToUI('applied', {
          ok: false,
          error: String(error),
          styleName: msg.styleName
        });
      }
    }
  } else if (msg.type === 'apply-spacing-token') {
    await safeMessageHandler(
      (msg) => handleTokenApplication(msg, 'spacing', applySpacingTokenToNode),
      msg,
      'apply-spacing-token'
    );
  } else if (msg.type === 'apply-corner-radius-token') {
    await safeMessageHandler(
      (msg) => handleTokenApplication(msg, 'corner-radius', applyCornerRadiusTokenToNode),
      msg,
      'apply-corner-radius-token'
    );
  } else if (msg.type === 'apply-corner-radius-tokens') {
    console.log('🔧 Received apply-corner-radius-tokens message:', msg);
    try {
      const cornerTokens = msg.cornerTokens;
      console.log('Corner radius tokens:', cornerTokens);
      if (!cornerTokens || Object.keys(cornerTokens).length === 0) {
        throw new Error('Corner tokens are required.');
      }

      if (msg.nodeId) {
        // Apply multiple corner radius tokens to specific node
        await applyCornerRadiusTokensToNode(cornerTokens, msg.nodeId);
        figma.ui.postMessage({
          type: 'applied',
          ok: true,
          nodeId: msg.nodeId,
          styleName: Object.keys(cornerTokens).join(', '), // Show which corners were updated
          targetType: 'node',
          appliedCorners: cornerTokens, // Send the applied corner tokens for UI update
          isCornerRadius: true
        });
      } else {
        throw new Error('Node ID is required for corner radius tokens application.');
      }
    } catch (e: any) {
      figma.ui.postMessage({
        type: 'applied',
        ok: false,
        error: String(e),
        nodeId: msg.nodeId,
        styleName: 'corner radius tokens'
      });
    }
  } else if (msg.type === 'apply-hardcoded-corner-radius') {
    console.log('🔧 Received apply-hardcoded-corner-radius message:', msg);
    try {
      const { nodeId, corner, value } = msg;
      console.log('Applying hardcoded corner radius:', { nodeId, corner, value });

      if (!nodeId || !corner || value === undefined) {
        throw new Error('Node ID, corner, and value are required.');
      }

      // Apply hardcoded corner radius value to specific corner
      await applyHardcodedCornerRadius(nodeId, corner, value);
      figma.ui.postMessage({
        type: 'hardcoded-applied',
        ok: true,
        nodeId: nodeId,
        corner: corner,
        value: value,
        targetType: 'node'
      });
    } catch (e: any) {
      figma.ui.postMessage({
        type: 'applied',
        ok: false,
        error: String(e),
        nodeId: msg.nodeId,
        styleName: 'hardcoded corner radius'
      });
    }
  } else if (msg.type === 'apply-color-token') {
    await safeMessageHandler(
      (msg) => handleTokenApplication(msg, 'color', applyColorTokenToNode),
      msg,
      'apply-color-token'
    );
  } else if (msg.type === 'resize-ui') {
    if (msg.width && msg.height) {
      resizeUI(msg.width, msg.height);
    } else if (msg.sizeMode) {
      switch (msg.sizeMode) {
        case 'export':
          setScreenSize('EXPORT_SCREEN');
          break;
        case 'link':
          setScreenSize('LINK_SCREEN');
          break;
        case 'selection':
          setScreenSize('SELECTION_SCREEN');
          break;
        case 'home':
          setScreenSize('HOME_SCREEN');
          break;
        case 'validation-results':
          setScreenSize('VALIDATION_RESULTS_SCREEN');
          break;
        case 'validation-results-collapsed':
          setScreenSize('VALIDATION_RESULTS_COLLAPSED');
          break;
      }
    }
  } else if (msg.type === 'clear-all-libraries') {
    await clearAllSavedLibraries();
    // Reset UI state and reload libraries
    selectedLibraryKey = null;
    await setStatus(0); // No JSON files
    setScreenSize('LINK_SCREEN');
    figma.ui.postMessage({
      type: 'libraries-cleared'
    });
  } else if (msg.type === 'user-going-to-design-system') {
    // Set status to indicate user is going to design system file
    await setStatus(1);
    console.log('Status: User going to design system file');
    figma.closePlugin();
  } else if (msg.type === 'cancel-export-instructions') {
    // Reset status to 0 and close plugin
    await setStatus(0);
    console.log('Status: Cancelled export instructions - reset to 0');
    figma.closePlugin();
  } else if (msg.type === 'get-text-styles') {
    if (selectedLibraryKey) {
      const library = await getSavedLibrary(selectedLibraryKey);
      if (library) {
        console.log(`Loading ${Object.keys(library.items).length} text styles...`);

        // Get detailed information for each text style
        const detailedStyles: Record<string, any> = {};
        const styleNames = Object.keys(library.items);

        // Process styles in parallel batches for better performance
        const batchSize = 5;
        for (let i = 0; i < styleNames.length; i += batchSize) {
          const batch = styleNames.slice(i, i + batchSize);

          await Promise.all(batch.map(async (styleName) => {
            const styleKey = library.items[styleName];
            try {
              const style = await figma.importStyleByKeyAsync(styleKey);
              if (style.type === 'TEXT') {
                const textStyle = style as TextStyle;
                detailedStyles[styleName] = {
                  name: styleName,
                  key: styleKey,
                  fontSize: textStyle.fontSize,
                  fontFamily: typeof textStyle.fontName === 'object' ? textStyle.fontName.family : 'Mixed',
                  fontWeight: typeof textStyle.fontName === 'object' ? textStyle.fontName.style : 'Mixed',
                  lineHeight: textStyle.lineHeight,
                  letterSpacing: textStyle.letterSpacing,
                  textCase: textStyle.textCase,
                  textDecoration: textStyle.textDecoration
                };
              }
            } catch (error) {
              console.log(`Could not import style ${styleName}:`, error);
              // Fallback to basic info
              detailedStyles[styleName] = {
                name: styleName,
                key: styleKey,
                fontSize: 'Unknown',
                fontFamily: 'Unknown',
                fontWeight: 'Unknown'
              };
            }
          }));

          // Small delay between batches to prevent blocking
          if (i + batchSize < styleNames.length) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }

        console.log(`Loaded ${Object.keys(detailedStyles).length} text styles`);

        figma.ui.postMessage({
          type: 'text-styles-data',
          textStyles: detailedStyles
        });
      }
    }
  } else if (msg.type === 'get-spacing-variables') {
    await safeMessageHandler(() => handleGetVariables(msg, 'spacing'), msg, 'get-spacing-variables');
  } else if (msg.type === 'get-colors') {
    await safeMessageHandler(() => handleGetVariables(msg, 'colors'), msg, 'get-colors');
  } else if (msg.type === 'get-corner-radius') {
    await safeMessageHandler(() => handleGetVariables(msg, 'corner-radius'), msg, 'get-corner-radius');
  } else if (msg.type === 'run-validation') {
    await safeMessageHandler(handleRunValidation, msg, 'run-validation');
  } else if (msg.type === 'back-to-validation') {
    // Resize back to home screen
    setScreenSize('HOME_SCREEN');
    console.log('Resized UI back to home screen');
  } else if (msg.type === 'select-node') {
    await safeMessageHandler(handleSelectNode, msg, 'select-node');
  } else if (msg.type === 'select-and-position-node') {
    await safeMessageHandler(handleSelectAndPositionNode, msg, 'select-and-position-node');
  } else if (msg.type === 'validate-issue-resolution') {
    await safeMessageHandler(handleValidateIssueResolution, msg, 'validate-issue-resolution');
  } else if (msg.type === 'minimize-and-position') {
    // Minimize window and position next to relevant Figma panel
    const resultType = msg.resultType || 'text-styles';

    // Determine position based on result type
    let position: { x: number; y: number } = { x: 0, y: 0 };

    // Position at top-right corner for all issue types
    position = { x: 800, y: 0 };

    // Resize to collapsed view size using the defined constant
    setScreenSize('VALIDATION_RESULTS_COLLAPSED');

    // Enable selection tracking for collapsed view
    isSelectionTrackingEnabled = true;
    console.log('🔍 SELECTION TRACKING ENABLED (via minimize-and-position)');

    console.log(`Minimized plugin for ${resultType}`);
    figma.notify(`Plugin minimized`);

    // Notify UI that plugin is now minimized
    figma.ui.postMessage({
      type: 'plugin-minimized',
      resultType: resultType
    });
  } else if (msg.type === 'enable-selection-tracking') {
    isSelectionTrackingEnabled = true;
    console.log('🔍 SELECTION TRACKING ENABLED');
  } else if (msg.type === 'disable-selection-tracking') {
    isSelectionTrackingEnabled = false;
    console.log('🔍 SELECTION TRACKING DISABLED');
  } else if (msg.type === 'get-node-name') {
    // Get node name for out-of-scope modal
    try {
      if (!msg.nodeId) {
        throw new Error('Node ID is required');
      }
      const node = await figma.getNodeByIdAsync(msg.nodeId);
      const nodeName = node?.name || 'Unknown Asset';
      
      figma.ui.postMessage({
        type: 'node-name-response',
        nodeId: msg.nodeId,
        nodeName: nodeName
      });
    } catch (error) {
      console.error('Error getting node name:', error);
      figma.ui.postMessage({
        type: 'node-name-response',
        nodeId: msg.nodeId,
        nodeName: 'Unknown Asset'
      });
    }
  } else if (msg.type === 'get-current-node-values') {
    await safeMessageHandler(handleGetCurrentNodeValues, msg, 'get-current-node-values');
  } else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};

// Track whether selection tracking is enabled
let isSelectionTrackingEnabled = false;

// Listen for selection changes and notify UI (only when enabled)
figma.on('selectionchange', () => {
  console.log('🔍 SELECTION CHANGE DETECTED, tracking enabled:', isSelectionTrackingEnabled);
  
  if (!isSelectionTrackingEnabled) {
    console.log('🔍 Selection tracking disabled, ignoring change');
    return;
  }

  const selection = figma.currentPage.selection;
  let selectedNodeId = null;

  let selectedNodeName = null;

  if (selection.length > 0) {
    selectedNodeId = selection[0].id;
    selectedNodeName = selection[0].name;
    console.log('🔍 Selected node:', selectedNodeId, 'name:', selectedNodeName);
  } else {
    console.log('🔍 No selection');
  }

  // Send selection change to UI
  console.log('🔍 SENDING SELECTION CHANGE TO UI:', selectedNodeId, selectedNodeName);
  figma.ui.postMessage({
    type: 'selection-changed',
    nodeId: selectedNodeId,
    nodeName: selectedNodeName
  });
});

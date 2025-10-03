// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

console.log('🚀🚀🚀 CODE.TS WITH PROPER SIZING 🚀🚀🚀');
console.log('⏰ TIMESTAMP:', new Date().toISOString());

// Function to reposition UI to top center of viewport
type MoveOpts = { width: number; height: number; padding?: number };

function moveUiTopCenter({ width, padding = 16 }: MoveOpts) {
  const { bounds, zoom } = figma.viewport; // canvas-space rect
  // Convert desired window size (px) into canvas units by dividing by zoom
  const wInCanvas = width / zoom;

  const x = bounds.x + (bounds.width - wInCanvas) / 2;
  const y = bounds.y + (padding / zoom); // a little padding from the very top
  figma.ui.reposition(x, y);
}

// Size constants and collapse helpers
const SIZE_FORM = { width: 300, height: 720 }; // Form view
const SIZE_RESULTS = { width: 800, height: 720 }; // Results view  
const SIZE_COLLAPSED = { width: 220, height: 44 }; // Collapsed view
let isCollapsed = false;

async function setCollapsed(next: boolean) {
  console.log('🔄 setCollapsed called with:', next);
  isCollapsed = next;
  const size = next ? SIZE_COLLAPSED : SIZE_FORM; // Use form size when expanding
  console.log('📏 Using size:', size);
  figma.ui.resize(size.width, size.height);
  // keep it pinned at top-center after resize
  moveUiTopCenter({ width: size.width, height: size.height, padding: 16 });
  figma.ui.postMessage({ type: 'ui-state', collapsed: isCollapsed });
}

async function setFormView() {
  console.log('📋 setFormView called - resizing to:', SIZE_FORM.width, 'x', SIZE_FORM.height);
  figma.ui.resize(SIZE_FORM.width, SIZE_FORM.height);
  moveUiTopCenter({ width: SIZE_FORM.width, height: SIZE_FORM.height, padding: 16 });
  figma.ui.postMessage({ type: 'view-mode', mode: 'form' });
  console.log('✅ setFormView complete');
}

async function setResultsView() {
  console.log('📊 setResultsView called - resizing to:', SIZE_RESULTS.width, 'x', SIZE_RESULTS.height);
  figma.ui.resize(SIZE_RESULTS.width, SIZE_RESULTS.height);
  moveUiTopCenter({ width: SIZE_RESULTS.width, height: SIZE_RESULTS.height, padding: 16 });
  figma.ui.postMessage({ type: 'view-mode', mode: 'results' });
  console.log('✅ setResultsView complete');
}

// Design system management functions

// Helper function to get external libraries following the reliable pattern
async function getExternalLibraries() {
  try {
    // 1) Returns [] if user didn't enable any libraries
    const libs = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    
    // 2) Expand each collection to its variables (descriptors)
    const withVars = await Promise.all(
      libs.map(async c => ({
        collection: { key: c.key, name: c.name, libraryName: c.libraryName },
        variables: await figma.teamLibrary.getVariablesInLibraryCollectionAsync(c.key)
      }))
    );
    
    return withVars;
  } catch (error) {
    console.log('⚠️ Could not access team libraries:', error);
    return [];
  }
}

async function getAvailableLibraries() {
  console.log('🔍 Getting available libraries...');
  
  try {
    const libraries = [];
    
    // Add local styles option - check for any local styles or variables
    const localVariableCollections = await figma.variables.getLocalVariableCollectionsAsync();
    const localPaintStyles = await figma.getLocalPaintStylesAsync();
    const localTextStyles = await figma.getLocalTextStylesAsync();
    
    if (localVariableCollections.length > 0 || localPaintStyles.length > 0 || localTextStyles.length > 0) {
      libraries.push({
        id: 'local-styles',
        name: 'Local Styles & Variables',
        source: 'Local',
        type: 'local-styles'
      });
    }
    
    // Get team library variable collections using the reliable pattern
    const externalLibraries = await getExternalLibraries();
    
    // Group by library name to avoid duplicates
    const libraryGroups = new Map();
    
    for (const libData of externalLibraries) {
      const { collection, variables } = libData;
      const libraryName = collection.libraryName || 'Team Library';
      
      if (!libraryGroups.has(libraryName)) {
        libraryGroups.set(libraryName, {
          id: `library-${libraryName.toLowerCase().replace(/\s+/g, '-')}`,
          name: libraryName,
          source: 'Library',
          type: 'library-variables',
          collections: []
        });
      }
      
      libraryGroups.get(libraryName).collections.push({
        key: collection.key,
        name: collection.name,
        variableCount: variables.length
      });
    }
    
    // Add grouped libraries to the list
    for (const library of libraryGroups.values()) {
      libraries.push(library);
    }
    
    console.log(`📚 Found ${externalLibraries.length} external collections from ${libraryGroups.size} libraries`);
    
    // If no libraries found, add a fallback option
    if (libraries.length === 0) {
      libraries.push({
        id: 'current-document',
        name: 'Current Document',
        source: 'Document',
        type: 'document-styles'
      });
    }
    
    console.log('📚 Found libraries:', libraries);
    
    figma.ui.postMessage({
      type: 'libraries-response',
      libraries: libraries
    });
    
  } catch (error) {
    console.error('❌ Error getting libraries:', error);
    figma.ui.postMessage({
      type: 'libraries-response',
      libraries: [{
        id: 'current-document',
        name: 'Current Document',
        source: 'Document',
        type: 'document-styles'
      }],
      error: 'Limited design system access - using current document'
    });
  }
}

async function attachDesignSystem(libraryId: string) {
  console.log('📎 Attaching design system:', libraryId);
  
  try {
    // Store the selected library ID
    await figma.clientStorage.setAsync('selectedLibraryId', libraryId);
    
    let libraryInfo;
    
    if (libraryId === 'local-styles') {
      libraryInfo = {
        id: 'local-styles',
        name: 'Local Styles & Variables',
        source: 'Local',
        type: 'local-styles'
      };
    } else if (libraryId.startsWith('library-')) {
      // This is a grouped library - get the actual collections
      const externalLibraries = await getExternalLibraries();
      const libraryName = libraryId.replace('library-', '').replace(/-/g, ' ');
      
      // Find collections for this library
      const libraryCollections = externalLibraries.filter(
        libData => (libData.collection.libraryName || 'Team Library').toLowerCase().replace(/\s+/g, '-') === libraryName.toLowerCase().replace(/\s+/g, '-')
      );
      
      if (libraryCollections.length > 0) {
        libraryInfo = {
          id: libraryId,
          name: libraryCollections[0].collection.libraryName || 'Team Library',
          source: 'Library',
          type: 'library-variables',
          collections: libraryCollections.map(lib => ({
            key: lib.collection.key,
            name: lib.collection.name,
            variableCount: lib.variables.length
          }))
        };
      } else {
        throw new Error('Library collections not found');
      }
    } else {
      // Legacy single collection ID - try to find it directly
      const externalLibraries = await getExternalLibraries();
      const library = externalLibraries.find(lib => lib.collection.key === libraryId);
      
      if (library) {
        libraryInfo = {
          id: library.collection.key,
          name: library.collection.name,
          source: 'Library',
          type: 'library-variables',
          libraryName: library.collection.libraryName || 'Team Library'
        };
      } else {
        throw new Error('Library not found');
      }
    }
    
    console.log('✅ Design system attached:', libraryInfo);
    
    figma.ui.postMessage({
      type: 'design-system-attached',
      library: libraryInfo
    });
    
  } catch (error) {
    console.error('❌ Error attaching design system:', error);
    figma.ui.postMessage({
      type: 'design-system-error',
      error: 'Failed to attach design system: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

async function detachDesignSystem() {
  console.log('📎 Detaching design system');
  
  try {
    await figma.clientStorage.deleteAsync('selectedLibraryId');
    console.log('✅ Design system detached');
  } catch (error) {
    console.error('❌ Error detaching design system:', error);
  }
}

// Token validation functions
interface DesignToken {
  name: string;
  value: number | string;
  id: string;
}

interface DesignTokens {
  spacings: DesignToken[];
  cornerRadius: DesignToken[];
  fontSize: DesignToken[];
  fontColor: DesignToken[];
}

interface ValidationIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion: string;
  nodeId: string;
  nodeName: string;
  currentValue: number | string;
  property: string;
}

async function getDesignTokens(designSystem: any): Promise<DesignTokens> {
  console.log('🎨 Getting design tokens for:', designSystem?.name);
  
  const tokens: DesignTokens = {
    spacings: [],
    cornerRadius: [],
    fontSize: [],
    fontColor: []
  };
  
  try {
    if (designSystem?.type === 'local-styles') {
      // Get local variables
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      
      for (const collection of collections) {
        const variables = collection.variableIds.map(id => figma.variables.getVariableById(id)).filter((v): v is Variable => v !== null);
        
        for (const variable of variables) {
          if (variable.resolvedType === 'FLOAT') {
            // Could be spacing or corner radius
            const name = variable.name.toLowerCase();
            if (name.includes('spacing') || name.includes('gap') || name.includes('padding') || name.includes('margin')) {
              tokens.spacings.push({
                name: variable.name,
                value: Object.values(variable.valuesByMode)[0] as number,
                id: variable.id
              });
            } else if (name.includes('radius') || name.includes('corner') || name.includes('border-radius')) {
              tokens.cornerRadius.push({
                name: variable.name,
                value: Object.values(variable.valuesByMode)[0] as number,
                id: variable.id
              });
            } else if (name.includes('font') && name.includes('size')) {
              tokens.fontSize.push({
                name: variable.name,
                value: Object.values(variable.valuesByMode)[0] as number,
                id: variable.id
              });
            }
          } else if (variable.resolvedType === 'COLOR') {
            tokens.fontColor.push({
              name: variable.name,
              value: Object.values(variable.valuesByMode)[0] as any,
              id: variable.id
            });
          }
        }
      }
    } else if (designSystem?.type === 'library-variables') {
      // Get library variables
      const externalLibraries = await getExternalLibraries();
      
      for (const libData of externalLibraries) {
        if (designSystem.collections?.some((c: any) => c.key === libData.collection.key)) {
          for (const variableDescriptor of libData.variables) {
            const name = variableDescriptor.name.toLowerCase();
            
            // Note: We can't get actual values from library variables easily,
            // so we'll create placeholder tokens for validation
            if (name.includes('spacing') || name.includes('gap') || name.includes('padding') || name.includes('margin')) {
              tokens.spacings.push({
                name: variableDescriptor.name,
                value: 8, // Common spacing value
                id: variableDescriptor.key
              });
            } else if (name.includes('radius') || name.includes('corner') || name.includes('border-radius')) {
              tokens.cornerRadius.push({
                name: variableDescriptor.name,
                value: 4, // Common radius value
                id: variableDescriptor.key
              });
            } else if (name.includes('font') && name.includes('size')) {
              tokens.fontSize.push({
                name: variableDescriptor.name,
                value: 16, // Common font size
                id: variableDescriptor.key
              });
            }
          }
        }
      }
    }
    
    // Add some default tokens if none found
    if (tokens.spacings.length === 0) {
      tokens.spacings = [
        { name: 'spacing-xs', value: 4, id: 'default-xs' },
        { name: 'spacing-sm', value: 8, id: 'default-sm' },
        { name: 'spacing-md', value: 16, id: 'default-md' },
        { name: 'spacing-lg', value: 24, id: 'default-lg' },
        { name: 'spacing-xl', value: 32, id: 'default-xl' }
      ];
    }
    
    if (tokens.cornerRadius.length === 0) {
      tokens.cornerRadius = [
        { name: 'radius-sm', value: 4, id: 'default-radius-sm' },
        { name: 'radius-md', value: 8, id: 'default-radius-md' },
        { name: 'radius-lg', value: 12, id: 'default-radius-lg' }
      ];
    }
    
    if (tokens.fontSize.length === 0) {
      tokens.fontSize = [
        { name: 'text-sm', value: 12, id: 'default-text-sm' },
        { name: 'text-base', value: 14, id: 'default-text-base' },
        { name: 'text-lg', value: 16, id: 'default-text-lg' },
        { name: 'text-xl', value: 18, id: 'default-text-xl' }
      ];
    }
    
    console.log('🎨 Found tokens:', tokens);
    return tokens;
    
  } catch (error) {
    console.error('❌ Error getting design tokens:', error);
    return tokens;
  }
}

function findClosestToken(value: number, tokens: DesignToken[], tolerance = 2): DesignToken | null {
  if (!tokens || tokens.length === 0) return null;
  
  let closest = null;
  let minDiff = Infinity;
  
  for (const token of tokens) {
    const diff = Math.abs(value - (token.value as number));
    if (diff <= tolerance && diff < minDiff) {
      minDiff = diff;
      closest = token;
    }
  }
  
  return closest;
}

function validateNodeSpacing(node: SceneNode, tokens: DesignTokens): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Check padding
  if ('paddingTop' in node && node.paddingTop !== undefined) {
    const paddingValues = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft];
    
    for (let i = 0; i < paddingValues.length; i++) {
      const value = paddingValues[i];
      if (value > 0) {
        const closestToken = findClosestToken(value, tokens.spacings);
        if (!closestToken) {
          const sides = ['top', 'right', 'bottom', 'left'];
          issues.push({
            type: 'spacing',
            severity: 'warning',
            message: `Padding ${sides[i]} (${value}px) doesn't match any design tokens`,
            suggestion: `Consider using a spacing token like ${tokens.spacings[0]?.name} (${tokens.spacings[0]?.value}px)`,
            nodeId: node.id,
            nodeName: node.name,
            currentValue: value,
            property: `padding-${sides[i]}`
          });
        }
      }
    }
  }
  
  // Check item spacing (for auto layout)
  if ('itemSpacing' in node && node.itemSpacing !== undefined && node.itemSpacing > 0) {
    const closestToken = findClosestToken(node.itemSpacing, tokens.spacings);
    if (!closestToken) {
      issues.push({
        type: 'spacing',
        severity: 'warning',
        message: `Item spacing (${node.itemSpacing}px) doesn't match any design tokens`,
        suggestion: `Consider using a spacing token like ${tokens.spacings[0]?.name} (${tokens.spacings[0]?.value}px)`,
        nodeId: node.id,
        nodeName: node.name,
        currentValue: node.itemSpacing,
        property: 'item-spacing'
      });
    }
  }
  
  return issues;
}

function validateNodeCornerRadius(node: SceneNode, tokens: DesignTokens): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  if ('cornerRadius' in node && node.cornerRadius !== undefined && typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
    const closestToken = findClosestToken(node.cornerRadius, tokens.cornerRadius);
    if (!closestToken) {
      issues.push({
        type: 'corner-radius',
        severity: 'warning',
        message: `Corner radius (${node.cornerRadius}px) doesn't match any design tokens`,
        suggestion: `Consider using a radius token like ${tokens.cornerRadius[0]?.name} (${tokens.cornerRadius[0]?.value}px)`,
        nodeId: node.id,
        nodeName: node.name,
        currentValue: node.cornerRadius,
        property: 'corner-radius'
      });
    }
  }
  
  return issues;
}

function validateNodeFontSize(node: SceneNode, tokens: DesignTokens): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  if (node.type === 'TEXT' && 'fontSize' in node && node.fontSize !== undefined && typeof node.fontSize === 'number') {
    const closestToken = findClosestToken(node.fontSize, tokens.fontSize);
    if (!closestToken) {
      issues.push({
        type: 'font-size',
        severity: 'warning',
        message: `Font size (${node.fontSize}px) doesn't match any design tokens`,
        suggestion: `Consider using a font size token like ${tokens.fontSize[0]?.name} (${tokens.fontSize[0]?.value}px)`,
        nodeId: node.id,
        nodeName: node.name,
        currentValue: node.fontSize,
        property: 'font-size'
      });
    }
  }
  
  return issues;
}

function validateNodeFontColor(node: SceneNode, tokens: DesignTokens): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  if (node.type === 'TEXT' && 'fills' in node && node.fills && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'SOLID' && fill.color) {
        // For now, just check if it's using a variable
        if (!fill.boundVariables?.color) {
          issues.push({
            type: 'font-color',
            severity: 'info',
            message: `Text color is not using a design token`,
            suggestion: `Consider using a color token from your design system`,
            nodeId: node.id,
            nodeName: node.name,
            currentValue: `rgb(${Math.round(fill.color.r * 255)}, ${Math.round(fill.color.g * 255)}, ${Math.round(fill.color.b * 255)})`,
            property: 'font-color'
          });
        }
      }
    }
  }
  
  return issues;
}

async function runTokenValidation(options: string[], designSystem: any) {
  console.log('🔍 Starting token validation with options:', options);
  
  try {
    // Get design tokens
    const tokens = await getDesignTokens(designSystem);
    
    // Get all nodes in the current page
    const allNodes: SceneNode[] = [];
    
    function traverseNode(node: BaseNode) {
      if ('children' in node) {
        allNodes.push(node as SceneNode);
        for (const child of node.children) {
          traverseNode(child);
        }
      } else {
        allNodes.push(node as SceneNode);
      }
    }
    
    // Start from current page
    traverseNode(figma.currentPage);
    
    console.log(`🔍 Scanning ${allNodes.length} nodes for token validation issues`);
    
    const allIssues: ValidationIssue[] = [];
    
    // Validate each node based on selected options
    for (const node of allNodes) {
      if (options.includes('spacings')) {
        allIssues.push(...validateNodeSpacing(node, tokens));
      }
      
      if (options.includes('corner-radius')) {
        allIssues.push(...validateNodeCornerRadius(node, tokens));
      }
      
      if (options.includes('font-size')) {
        allIssues.push(...validateNodeFontSize(node, tokens));
      }
      
      if (options.includes('font-color')) {
        allIssues.push(...validateNodeFontColor(node, tokens));
      }
    }
    
    console.log(`🔍 Found ${allIssues.length} validation issues`);
    
    // Send results to UI
    figma.ui.postMessage({
      type: 'validation-results',
      issues: allIssues,
      summary: {
        totalIssues: allIssues.length,
        byType: {
          spacing: allIssues.filter(i => i.type === 'spacing').length,
          'corner-radius': allIssues.filter(i => i.type === 'corner-radius').length,
          'font-size': allIssues.filter(i => i.type === 'font-size').length,
          'font-color': allIssues.filter(i => i.type === 'font-color').length
        },
        bySeverity: {
          error: allIssues.filter(i => i.severity === 'error').length,
          warning: allIssues.filter(i => i.severity === 'warning').length,
          info: allIssues.filter(i => i.severity === 'info').length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error during token validation:', error);
    figma.ui.postMessage({
      type: 'validation-error',
      error: 'Failed to run validation: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

async function selectAndHighlightNode(nodeId: string) {
  console.log('🎯 Selecting and highlighting node:', nodeId);
  
  try {
    const node = figma.getNodeById(nodeId);
    if (node) {
      // Select the node (only if it's a scene node)
      if ('visible' in node) {
        figma.currentPage.selection = [node as SceneNode];
      }
      
      // Zoom to the node
      figma.viewport.scrollAndZoomIntoView([node]);
      
      console.log('✅ Node selected and highlighted:', node.name);
    } else {
      console.log('❌ Node not found:', nodeId);
    }
  } catch (error) {
    console.error('❌ Error selecting node:', error);
  }
}

// Runs this code if the plugin is run in Figma
if (figma.editorType === 'figma') {
  console.log('🔍 FIGMA EDITOR DETECTED');

  // Start with FORM size (300x720)
  console.log('🎯 Opening UI with FORM size:', SIZE_FORM.width, 'x', SIZE_FORM.height);
  figma.showUI(__html__, {
    width: SIZE_FORM.width,
    height: SIZE_FORM.height,
    themeColors: true
  });
  console.log('✅ UI OPENED WITH FORM SIZE');

  // Message handler
  figma.ui.onmessage = async (msg) => {
    console.log('BACKEND MESSAGE HANDLER CALLED');
    console.log('Backend received message:', msg.type);
    console.log('Full message object:', msg);

    if (msg.type === 'toggle-collapse') {
      console.log('Handling toggle-collapse');
      await setCollapsed(!isCollapsed);
    }
    else if (msg.type === 'collapse-ui') {
      console.log('Handling collapse-ui');
      await setCollapsed(true);
    }
    else if (msg.type === 'expand-ui') {
      console.log('Handling expand-ui');
      await setCollapsed(false);
    }
    else if (msg.type === 'show-form-view') {
      console.log('Handling show-form-view');
      await setFormView();
    }
    else if (msg.type === 'show-results-view') {
      console.log('Handling show-results-view');
      await setResultsView();
    }
    else if (msg.type === 'get-libraries') {
      console.log('Handling get-libraries');
      await getAvailableLibraries();
    }
    else if (msg.type === 'attach-design-system') {
      console.log('Handling attach-design-system:', msg.libraryId);
      await attachDesignSystem(msg.libraryId);
    }
    else if (msg.type === 'detach-design-system') {
      console.log('Handling detach-design-system');
      await detachDesignSystem();
    }
    else if (msg.type === 'run-validation') {
      console.log('Handling run-validation with options:', msg.options);
      await runTokenValidation(msg.options, msg.designSystem);
    }
    else if (msg.type === 'select-node') {
      console.log('Handling select-node:', msg.nodeId);
      await selectAndHighlightNode(msg.nodeId);
    }
    else if (msg.type === 'cancel') {
      console.log('Handling cancel');
      figma.closePlugin();
    }
    else {
      console.log('Unknown message type:', msg.type);
    }
    console.log('Message handler completed for type:', msg.type);
  };
}

// Runs this code if the plugin is run in FigJam
if (figma.editorType === 'figjam') {
  console.log('🔍 FIGJAM EDITOR DETECTED');
  figma.showUI(__html__);
}

// Runs this code if the plugin is run in Slides
if (figma.editorType === 'slides') {
  console.log('🔍 SLIDES EDITOR DETECTED');
  figma.showUI(__html__);
}
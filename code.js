// Main plugin: uses saved library keys to apply external text styles

// Start with default UI size, will be adjusted based on mode
figma.showUI(__html__, { width: 350, height: 220 });

// UI sizing functions for different states
function resizeUI(width: number, height: number): void {
  figma.ui.resize(width, height);
}

// UI sizes for different screens
const UISizes = {
  EXPORT_SCREEN: { width: 350, height: 400 },
  LINK_SCREEN: { width: 380, height: 400 },
  SELECTION_SCREEN: { width: 400, height: 400 },
  HOME_SCREEN: { width: 400, height: 800 },
  EXPORT_INSTRUCTIONS_SCREEN: { width: 400, height: 480 },
  VALIDATION_RESULTS_SCREEN: { width: 800, height: 900 },
  VALIDATION_RESULTS_COLLAPSED: { width: 800, height: 130 },
  CUSTOM: (width: number, height: number) => ({ width, height })
} as const;

function setScreenSize(screen: keyof typeof UISizes): void {
  if (screen === 'CUSTOM') return;
  const size = UISizes[screen];
  resizeUI(size.width, size.height);
}

type SavedLibrary = {
  libraryName: string;
  libraryFileKey?: string | null;
  generatedAt: string;
  type: 'design-system-export';
  version: number;
  items: Record<string, string>; // "Display/Large" -> style.key
  variables?: Record<string, any>; // Variable data
};

// Status values (sequential flow):
// 0 = No JSON file (no libraries saved) - Link Screen
// 1 = User went to design system file - Export Screen
// 2 = Has JSON file, none selected - Selection Screen  
// 3 = JSON file selected, ready to validate - Home Screen

let selectedLibraryKey: string | null = null;

// Set proper initial size based on status
(async () => {
  console.log('Initial setup - checking status');
  const status = await getStatus();
  console.log(`Initial status determined: ${status}`);

  if (status === 0) {
    setScreenSize('LINK_SCREEN');
    console.log('Set initial size: LINK_SCREEN');
  } else if (status === 1) {
    setScreenSize('SELECTION_SCREEN');
    console.log('Set initial size: SELECTION_SCREEN');
  } else if (status === 2) {
    setScreenSize('SELECTION_SCREEN');
    console.log('Set initial size: SELECTION_SCREEN');
  } else if (status === 3) {
    setScreenSize('SELECTION_SCREEN');
    console.log('Set initial size: SELECTION_SCREEN');
  } else if (status === 4) {
    setScreenSize('EXPORT_INSTRUCTIONS_SCREEN');
    console.log('Set initial size: EXPORT_INSTRUCTIONS_SCREEN');
  } else if (status === 5) {
    setScreenSize('EXPORT_SCREEN');
    console.log('Set initial size: EXPORT_SCREEN (Status 5)');
  } else {
    console.log(`Unknown status: ${status} - defaulting to LINK_SCREEN`);
    setScreenSize('LINK_SCREEN');
  }
})();

interface PluginMessage {
  type: 'get-ui-mode' | 'switch-mode' | 'export-keys' | 'get-saved-libraries' | 'select-library' | 'apply-text-style' | 'apply-spacing-token' | 'create-text-style' | 'resize-ui' | 'clear-all-libraries' | 'close-plugin' | 'user-going-to-design-system' | 'cancel-export-instructions' | 'get-text-styles' | 'get-spacing-variables' | 'run-validation' | 'back-to-validation' | 'select-node' | 'selection-changed' | 'enable-selection-tracking' | 'disable-selection-tracking';
  libraryKey?: string;
  styleName?: string;
  tokenName?: string;
  nodeId?: string;
  mode?: 'export' | 'link' | 'selection' | 'home' | 'export-instructions' | 'export-confirmation' | 'validation-results';
  width?: number;
  height?: number;
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
  };
}

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

async function getStatus(): Promise<number> {
  const storedStatus = await figma.clientStorage.getAsync('status') as number | null;
  const libraries = await getAllSavedLibraries();
  const libraryCount = Object.keys(libraries).length;

  console.log('Status check:', { storedStatus, libraryCount });

  // If we have a stored status, use it (except for special workflow states)
  if (storedStatus != null) {
    console.log(`Using stored status: ${storedStatus}`);
    return storedStatus;
  }

  // Default status based on available libraries (only when no stored status)
  if (libraryCount === 0) {
    console.log('No stored status, no libraries - defaulting to Status 0 (Link screen)');
    return 0; // No libraries available
  } else if (!selectedLibraryKey) {
    console.log('No stored status, has libraries - defaulting to Status 1 (Selection screen)');
    return 1; // Has libraries, none selected
  } else {
    console.log('No stored status, library selected - defaulting to Status 2 (Home screen)');
    return 2; // Library selected
  }
}

async function setStatus(status: number): Promise<void> {
  await figma.clientStorage.setAsync('status', status);
  console.log(`Status: ${status}`);
}



async function exportLibraryKeys(): Promise<void> {
  function normalizeName(name: string): string {
    let n = name.replace(/\s*\/\s*/g, '/').trim();
    n = n.replace(/^Text\s*Style[s]?\//i, '');
    n = n.replace(/^Typography\//i, '');
    n = n.replace(/\/{2,}/g, '/').replace(/^\/|\/$/g, '');
    return n;
  }

  // Export text styles
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

  // Export local variables organized by collection
  let variablesMap: Record<string, any> = {};

  try {
    // Get local variables using the async API
    if (figma.variables && figma.variables.getLocalVariablesAsync) {
      const variables = await figma.variables.getLocalVariablesAsync();
      console.log(`Found ${variables.length} local variables`);

      for (const variable of variables) {
        try {
          const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
          const collectionName = collection?.name || 'Unknown Collection';
          const collectionKey = collectionName.toLowerCase().replace(/\s+/g, '-');

          // Initialize collection if it doesn't exist
          if (!variablesMap[collectionKey]) {
            variablesMap[collectionKey] = {};
          }

          // Add variable to its collection
          variablesMap[collectionKey][variable.name] = {
            id: variable.id,
            key: variable.key,
            name: variable.name,
            collection: collectionName,
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

  // Save to the libraries collection using the file name as key
  const allLibraries = await getAllSavedLibraries();
  allLibraries[libraryKey] = payload;
  await figma.clientStorage.setAsync('savedLibraries', allLibraries);

  // Count total variables across all collections
  const totalVariables = Object.keys(variablesMap).reduce((total: number, collectionKey: string) => {
    return total + Object.keys(variablesMap[collectionKey]).length;
  }, 0);

  const totalItems = Object.keys(textStylesMap).length + totalVariables;
  figma.notify(`Exported ${Object.keys(textStylesMap).length} text styles and ${totalVariables} variables from "${libraryName}"`);

  // Update status to indicate export is complete
  await setStatus(2); // Has JSON files, none selected yet

  figma.ui.postMessage({
    type: 'keys-exported',
    count: totalItems,
    textStylesCount: Object.keys(textStylesMap).length,
    variablesCount: totalVariables,
    libraryName: libraryName,
    fileName: `${libraryName}.json`
  });
}

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
  if (!selectedLibraryKey) {
    throw new Error('Please select a library first.');
  }

  try {
    const style = await importTextStyleByName(styleName, selectedLibraryKey);
    const node = await figma.getNodeByIdAsync(nodeId);

    if (!node || node.type !== 'TEXT') {
      throw new Error('Node not found or is not a text node.');
    }

    const textNode = node as TextNode;

    // Load the node font to avoid range assignment errors
    const font = textNode.fontName;
    if (font !== figma.mixed && font && typeof font === 'object') {
      try {
        await figma.loadFontAsync(font);
      } catch { }
    }

    await textNode.setRangeTextStyleIdAsync(0, textNode.characters.length, style.id);

    const library = await getSavedLibrary(selectedLibraryKey);
    figma.notify(`Applied "${styleName}" from ${library?.libraryName} to "${textNode.name}".`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    figma.notify(errorMsg, { error: true });
    throw error;
  }
}

async function applySpacingTokenToNode(tokenName: string, nodeId: string): Promise<void> {
  if (!selectedLibraryKey) {
    throw new Error('Please select a library first.');
  }

  try {
    const library = await getSavedLibrary(selectedLibraryKey);
    if (!library) {
      throw new Error('Selected library not found.');
    }

    // Get spacing token value
    let spacingVariables: Record<string, any> = {};
    if (library.variables?.spacing) {
      spacingVariables = library.variables.spacing;
    } else if (library.variables) {
      // Handle old structure
      for (const key in library.variables) {
        if (key.toLowerCase().startsWith('spacing/')) {
          const variableName = key.replace(/^spacing\//i, '');
          spacingVariables[variableName] = library.variables[key];
        }
      }
    }

    const tokenData = spacingVariables[tokenName];
    if (!tokenData || !tokenData.id) {
      throw new Error(`Spacing token "${tokenName}" not found in library.`);
    }

    // Get the variable by ID to bind it to the node
    const variable = await figma.variables.getVariableByIdAsync(tokenData.id);
    if (!variable) {
      throw new Error(`Variable with ID "${tokenData.id}" not found. The variable may have been deleted.`);
    }

    // Get the node and apply the spacing
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error('Node not found.');
    }

    // Apply spacing based on node type and the original issue
    if (node.type === 'FRAME' || node.type === 'GROUP') {
      const containerNode = node as FrameNode;
      let applied = false;

      // Priority 1: If it has auto layout with existing gap, apply to itemSpacing (gap)
      if ('layoutMode' in containerNode && containerNode.layoutMode !== 'NONE' &&
        'itemSpacing' in containerNode && containerNode.itemSpacing > 0) {
        containerNode.setBoundVariable('itemSpacing', variable);
        figma.notify(`Applied spacing token "${tokenName}" as gap to "${containerNode.name}".`);
        applied = true;
      }
      // Priority 2: If it has padding, apply to padding
      else if ('paddingLeft' in containerNode && containerNode.paddingLeft !== undefined) {
        containerNode.setBoundVariable('paddingLeft', variable);
        containerNode.setBoundVariable('paddingRight', variable);
        containerNode.setBoundVariable('paddingTop', variable);
        containerNode.setBoundVariable('paddingBottom', variable);
        figma.notify(`Applied spacing token "${tokenName}" as padding to "${containerNode.name}".`);
        applied = true;
      }
      // Priority 3: If it has auto layout but no existing gap, apply to itemSpacing
      else if ('layoutMode' in containerNode && containerNode.layoutMode !== 'NONE' && 'itemSpacing' in containerNode) {
        containerNode.setBoundVariable('itemSpacing', variable);
        figma.notify(`Applied spacing token "${tokenName}" as gap to "${containerNode.name}".`);
        applied = true;
      }

      if (!applied) {
        throw new Error(`Cannot apply spacing to node "${node.name}" - no applicable spacing properties found.`);
      }
    } else {
      throw new Error(`Cannot apply spacing to node type "${node.type}".`);
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    figma.notify(errorMsg, { error: true });
    throw error;
  }
}

async function runValidation(target: FrameNode | PageNode, library: SavedLibrary, options: { textStyles: boolean; spacing: boolean }, targetName?: string) {
  const results: any[] = [];
  const visitedNodes = new Set<string>(); // Prevent infinite recursion
  let nodeCount = 0;
  const MAX_NODES = 1000; // Prevent processing too many nodes

  // Helper function to check if spacing property is bound to a design system variable
  function isSpacingBoundToToken(node: FrameNode, property: string): boolean {
    try {
      // Check if the property has a bound variable
      const boundVariables = node.boundVariables;
      console.log(`Checking ${property} on node "${node.name}":`, {
        hasBoundVariables: !!boundVariables,
        boundVariables: boundVariables,
        propertyValue: (node as any)[property]
      });

      if (!boundVariables) {
        console.log(`No boundVariables found for node "${node.name}"`);
        return false;
      }

      const propertyBinding = boundVariables[property as keyof typeof boundVariables];
      const isBound = propertyBinding !== undefined && propertyBinding !== null;
      console.log(`Property ${property} binding result:`, { propertyBinding, isBound });

      return isBound;
    } catch (error) {
      console.log(`Error checking spacing binding for ${property}:`, error);
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

      console.log(`Processing node: "${node.name}" (${node.type})`);

      // Log spacing-related properties for FRAME and GROUP nodes
      if (node.type === 'FRAME' || node.type === 'GROUP') {
        const containerNode = node as FrameNode;
        console.log(`Container node "${node.name}" properties:`, {
          type: node.type,
          hasLayoutMode: 'layoutMode' in containerNode,
          layoutMode: (containerNode as any).layoutMode,
          hasItemSpacing: 'itemSpacing' in containerNode,
          itemSpacing: (containerNode as any).itemSpacing,
          hasPaddingLeft: 'paddingLeft' in containerNode,
          paddingLeft: (containerNode as any).paddingLeft
        });
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
        console.log(`Checking spacing for node: "${containerNode.name}" (${containerNode.type})`);

        // Check padding (only if it exists and is accessible)
        try {
          if ('paddingLeft' in containerNode && containerNode.paddingLeft && containerNode.paddingLeft > 0) {
            const paddingValue = containerNode.paddingLeft;
            console.log(`Found padding: ${paddingValue}px on "${containerNode.name}"`);
            if (!isSpacingBoundToToken(containerNode, 'paddingLeft')) {
              console.log(`Adding padding issue for "${containerNode.name}"`);
              results.push({
                type: 'spacing',
                issue: `Hardcoded padding (${paddingValue}px) - not using design token`,
                node: {
                  id: containerNode.id,
                  name: containerNode.name
                },
                frameName: containerNode.name, // Use the actual container name instead of page name
                nodeType: 'SPACING',
                value: paddingValue
              });
            } else {
              console.log(`Padding is properly bound to token for "${containerNode.name}"`);
            }
          }
        } catch (error) {
          console.log(`Error checking padding for "${containerNode.name}":`, error);
        }

        // Check gaps in auto layout
        try {
          if ('layoutMode' in containerNode && 'itemSpacing' in containerNode &&
            containerNode.layoutMode !== 'NONE' && containerNode.itemSpacing > 0) {
            const gapValue = containerNode.itemSpacing;
            console.log(`Found gap: ${gapValue}px on "${containerNode.name}"`);
            if (!isSpacingBoundToToken(containerNode, 'itemSpacing')) {
              console.log(`Adding gap issue for "${containerNode.name}"`);
              results.push({
                type: 'spacing',
                issue: `Hardcoded gap (${gapValue}px) - not using design token`,
                node: {
                  id: containerNode.id,
                  name: containerNode.name
                },
                frameName: containerNode.name, // Use the actual container name instead of page name
                nodeType: 'SPACING',
                value: gapValue
              });
            } else {
              console.log(`Gap is properly bound to token for "${containerNode.name}"`);
            }
          }
        } catch (error) {
          console.log(`Error checking gap for "${containerNode.name}":`, error);
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

      // Log progress every 100 nodes
      if (nodeCount % 100 === 0) {
        console.log(`Processed ${nodeCount} nodes, found ${results.length} issues so far`);
      }
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
    return results;
  } catch (error) {
    console.error('Validation failed:', error);
    figma.notify('Validation failed. Please try again.', { error: true });
    return [];
  }
}

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'get-ui-mode') {
    console.log('UI requesting mode...');
    const status = await getStatus();
    console.log(`Final status for UI: ${status}`);
    let mode: 'export' | 'link' | 'selection' | 'home' | 'export-instructions' = 'link';

    if (status === 0) {
      mode = 'link';
      setScreenSize('LINK_SCREEN');
      console.log('🔗 Screen: Link (Status 0)');
    } else if (status === 1) {
      mode = 'export';
      setScreenSize('EXPORT_SCREEN');
      console.log('� Screen: Eexport (Status 1)');
    } else if (status === 2) {
      mode = 'selection';
      setScreenSize('SELECTION_SCREEN');
      console.log('Screen: Selection (Status 2 - has JSON files, none selected)');
    } else if (status === 3) {
      mode = 'selection';
      setScreenSize('SELECTION_SCREEN');
      console.log('Screen: Selection (Status 3 - library was selected, showing selection screen)');
    }

    console.log(`Sending UI mode: ${mode}`);
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
        return {
          key,
          name: lib.libraryName,
          generatedAt: lib.generatedAt,
          count: Object.keys(lib.items).length
        };
      })
    });
  } else if (msg.type === 'select-library') {
    selectedLibraryKey = msg.libraryKey || null;
    const library = selectedLibraryKey ? await getSavedLibrary(selectedLibraryKey) : null;

    // Switch to home screen when library is selected
    if (selectedLibraryKey && library) {
      setScreenSize('HOME_SCREEN');
      await setStatus(3);

      // Send UI mode first
      figma.ui.postMessage({
        type: 'ui-mode',
        mode: 'home',
        fileName: figma.root.name ?? 'Unknown Library'
      });

      // Calculate spacing variables count specifically
      console.log('Library variables structure:', library.variables);

      let spacingVariables: Record<string, any> = {};
      let spacingVariablesCount = 0;

      if (library.variables) {
        // Check if using new structure (organized by collection)
        if (library.variables.spacing) {
          spacingVariables = library.variables.spacing;
          spacingVariablesCount = Object.keys(spacingVariables).length;
          console.log(`Found ${spacingVariablesCount} spacing variables (new format):`, spacingVariables);
        } else {
          // Handle old structure (flat with collection names in keys)
          const oldFormatSpacing: Record<string, any> = {};
          for (const key in library.variables) {
            if (key.toLowerCase().startsWith('spacing/')) {
              const variableName = key.replace(/^spacing\//i, '');
              oldFormatSpacing[variableName] = library.variables[key];
            }
          }
          spacingVariables = oldFormatSpacing;
          spacingVariablesCount = Object.keys(spacingVariables).length;
          console.log(`Found ${spacingVariablesCount} spacing variables (old format):`, spacingVariables);
        }
      }

      // Then send library information
      figma.ui.postMessage({
        type: 'library-selected',
        library: {
          name: library.libraryName,
          count: Object.keys(library.items).length,
          textStylesCount: Object.keys(library.items).length,
          variablesCount: library.variables ? Object.keys(library.variables).length : 0,
          spacingVariablesCount: spacingVariablesCount,
          spacingVariables: spacingVariables,
          key: selectedLibraryKey
        }
      });
    } else {
      setScreenSize('SELECTION_SCREEN');
      await setStatus(2);
      figma.ui.postMessage({
        type: 'ui-mode',
        mode: 'selection',
        fileName: figma.root.name ?? 'Unknown Library'
      });
    }

    figma.notify(`Selected library: ${library?.libraryName || 'None'}`);
  } else if (msg.type === 'create-text-style') {
    await createLocalTextStyle();
  } else if (msg.type === 'apply-text-style') {
    try {
      const styleName = msg.styleName || 'Display/Large';
      if (msg.nodeId) {
        // Apply style to specific node
        await applyStyleToNode(styleName, msg.nodeId);
        figma.ui.postMessage({
          type: 'applied',
          ok: true,
          nodeId: msg.nodeId,
          styleName: styleName,
          targetType: 'node'
        });
      } else {
        // Apply style to current selection (legacy behavior)
        await applyStyleToSelection(styleName);
        figma.ui.postMessage({
          type: 'applied',
          ok: true,
          styleName: styleName,
          targetType: 'selection'
        });
      }
    } catch (e: any) {
      figma.ui.postMessage({
        type: 'applied',
        ok: false,
        error: String(e),
        nodeId: msg.nodeId,
        styleName: msg.styleName
      });
    }
  } else if (msg.type === 'apply-spacing-token') {
    try {
      const tokenName = msg.tokenName;
      if (!tokenName) {
        throw new Error('Token name is required.');
      }

      if (msg.nodeId) {
        // Apply spacing token to specific node
        await applySpacingTokenToNode(tokenName, msg.nodeId);
        figma.ui.postMessage({
          type: 'applied',
          ok: true,
          nodeId: msg.nodeId,
          styleName: tokenName, // Use tokenName as styleName for consistency with UI
          targetType: 'node'
        });
      } else {
        throw new Error('Node ID is required for spacing token application.');
      }
    } catch (e: any) {
      figma.ui.postMessage({
        type: 'applied',
        ok: false,
        error: String(e),
        nodeId: msg.nodeId,
        styleName: msg.tokenName
      });
    }
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
    if (selectedLibraryKey) {
      const library = await getSavedLibrary(selectedLibraryKey);
      if (library && library.variables) {
        let spacingVariables: Record<string, any> = {};

        // Check if using new structure (organized by collection)
        if (library.variables.spacing) {
          spacingVariables = library.variables.spacing;
        } else {
          // Handle old structure (flat with collection names in keys)
          for (const key in library.variables) {
            if (key.toLowerCase().startsWith('spacing/')) {
              const variableName = key.replace(/^spacing\//i, '');
              spacingVariables[variableName] = library.variables[key];
            }
          }
        }

        console.log(`Loading ${Object.keys(spacingVariables).length} spacing variables...`);

        figma.ui.postMessage({
          type: 'spacing-variables-data',
          spacingVariables: spacingVariables
        });
      } else {
        console.log('No spacing variables found in selected library');
        figma.ui.postMessage({
          type: 'spacing-variables-data',
          spacingVariables: {}
        });
      }
    }
  } else if (msg.type === 'run-validation') {
    try {
      if (!selectedLibraryKey || !msg.options) {
        figma.notify('Please select a library and validation options first', { error: true });
        return;
      }

      const library = await getSavedLibrary(selectedLibraryKey);
      if (!library) {
        figma.notify('Selected library not found', { error: true });
        return;
      }

      console.log('Running validation with options:', msg.options);

      // Get the current selection or use the entire page
      const selection = figma.currentPage.selection;
      let targetNode: FrameNode | PageNode;
      let targetName: string;

      if (selection.length === 0) {
        // No selection - validate the entire current page
        targetNode = figma.currentPage;
        targetName = `entire page "${figma.currentPage.name}"`;
        console.log(`No selection found, validating entire page: ${figma.currentPage.name}`);
        figma.notify(`Validating entire page: ${figma.currentPage.name}`);
      } else {
        const selectedNode = selection[0];
        if (selectedNode.type === 'FRAME') {
          // Frame selected - validate the frame
          targetNode = selectedNode as FrameNode;
          targetName = `frame "${selectedNode.name}"`;
          console.log(`Validating selected frame: ${selectedNode.name}`);
        } else {
          // Other node type selected - validate the entire page
          targetNode = figma.currentPage;
          targetName = `entire page "${figma.currentPage.name}" (non-frame selected)`;
          console.log(`Non-frame selected, validating entire page: ${figma.currentPage.name}`);
          figma.notify(`Non-frame selected, validating entire page: ${figma.currentPage.name}`);
        }
      }

      // Run validation with timeout
      const validationPromise = runValidation(targetNode, library, msg.options, targetName);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Validation timeout')), 30000)
      );

      const validationResults = await Promise.race([validationPromise, timeoutPromise]);

      // Resize UI for validation results
      setScreenSize('VALIDATION_RESULTS_SCREEN');
      console.log('Resized UI for validation results');

      // Send results to UI
      figma.ui.postMessage({
        type: 'validation-results',
        results: validationResults,
        library: library,
        targetName: targetName,
        targetType: targetNode.type === 'PAGE' ? 'page' : 'frame'
      });

      console.log('Validation completed successfully');
    } catch (error) {
      console.error('Validation error:', error);
      figma.notify('Validation failed. Please try again.', { error: true });

      // Send error to UI
      figma.ui.postMessage({
        type: 'validation-error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else if (msg.type === 'back-to-validation') {
    // Resize back to home screen
    setScreenSize('HOME_SCREEN');
    console.log('Resized UI back to home screen');
  } else if (msg.type === 'select-node') {
    if (msg.nodeId) {
      try {
        const node = await figma.getNodeByIdAsync(msg.nodeId);
        if (node) {
          figma.currentPage.selection = [node as SceneNode];
          figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
          figma.notify(`Selected ${node.name}`);
        } else {
          figma.notify('Node not found', { error: true });
        }
      } catch (error) {
        console.error('Error selecting node:', error);
        figma.notify('Error selecting node', { error: true });
      }
    }
  } else if (msg.type === 'enable-selection-tracking') {
    isSelectionTrackingEnabled = true;
    console.log('Selection tracking enabled');
  } else if (msg.type === 'disable-selection-tracking') {
    isSelectionTrackingEnabled = false;
    console.log('Selection tracking disabled');
  } else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};

// Track whether selection tracking is enabled
let isSelectionTrackingEnabled = false;

// Listen for selection changes and notify UI (only when enabled)
figma.on('selectionchange', () => {
  if (!isSelectionTrackingEnabled) return;

  const selection = figma.currentPage.selection;
  let selectedNodeId = null;

  if (selection.length > 0) {
    selectedNodeId = selection[0].id;
  }

  // Send selection change to UI
  figma.ui.postMessage({
    type: 'selection-changed',
    nodeId: selectedNodeId
  });
});

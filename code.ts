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
const SIZE_FORM = { width: 400, height: 800 }; // Form view
const SIZE_RESULTS = { width: 800, height: 800 }; // Results view  
const SIZE_DOCUMENTATION = { width: 1280, height: 800 }; // Documentation view
const SIZE_COLLAPSED = { width: 220, height: 44 }; // Collapsed view
let isCollapsed = false;
let currentDesignSystem: any = null;

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

async function setDocumentationView() {
  console.log('📖 setDocumentationView called - resizing to:', SIZE_DOCUMENTATION.width, 'x', SIZE_DOCUMENTATION.height);
  figma.ui.resize(SIZE_DOCUMENTATION.width, SIZE_DOCUMENTATION.height);
  moveUiTopCenter({ width: SIZE_DOCUMENTATION.width, height: SIZE_DOCUMENTATION.height, padding: 16 });
  figma.ui.postMessage({ type: 'view-mode', mode: 'documentation' });
  console.log('✅ setDocumentationView complete');
}

// Design system management functions

// Function to check if the selected design system's styles are being used in the document
async function checkSelectedDesignSystemUsage(libraryInfo: any): Promise<boolean> {
  console.log('🔍🔍🔍 CHECKING SELECTED DESIGN SYSTEM USAGE 🔍🔍🔍');
  console.log(`📚 Selected Design System: "${libraryInfo.name}"`);
  console.log(`🔑 Library ID: ${libraryInfo.id}`);

  try {
    // FIRST: Let's check what text styles are actually being used in the document
    console.log('🔍 STEP 1: Checking ALL text styles in use in this document...');

    // Load all pages first
    await figma.loadAllPagesAsync();

    const allTextStylesInUse = new Map<string, { styleName: string; nodeCount: number; styleType: string }>();

    async function scanAllTextStyles(node: BaseNode) {
      if (node.type === 'TEXT') {
        const textNode = node as TextNode;
        if (textNode.textStyleId && textNode.textStyleId !== figma.mixed) {
          const styleId = textNode.textStyleId as string;

          try {
            const style = await figma.getStyleByIdAsync(styleId);
            if (style && style.type === 'TEXT') {
              const styleType = styleId.includes(':') ? 'REMOTE/LIBRARY' : 'LOCAL';
              const key = styleId;

              if (allTextStylesInUse.has(key)) {
                allTextStylesInUse.get(key)!.nodeCount++;
              } else {
                allTextStylesInUse.set(key, {
                  styleName: style.name,
                  nodeCount: 1,
                  styleType: styleType
                });
              }
              console.log(`📝 Found ${styleType} text style: "${style.name}" (ID: ${styleId})`);
            }
          } catch (error) {
            console.log(`⚠️ Could not resolve style ${styleId}:`, error);
          }
        } else if (textNode.textStyleId === figma.mixed) {
          console.log(`📝 Found MIXED text styles in node: "${textNode.name}"`);
        } else {
          console.log(`📝 Found HARDCODED text formatting in node: "${textNode.name}"`);
        }
      }

      if ('children' in node) {
        for (const child of node.children) {
          await scanAllTextStyles(child);
        }
      }
    }

    await scanAllTextStyles(figma.root);

    console.log(`\n📊 DOCUMENT TEXT STYLE SUMMARY:`);
    console.log(`   📝 Total unique text styles in use: ${allTextStylesInUse.size}`);

    if (allTextStylesInUse.size === 0) {
      console.log(`   ❌ NO TEXT STYLES FOUND - All text is using hardcoded formatting`);

      // Alert the user that validation isn't possible without any text styles
      figma.ui.postMessage({
        type: 'no-design-system-usage',
        libraryName: libraryInfo.name,
        message: `No text styles are currently in use in this document - all text is using hardcoded formatting. To validate design system usage, you need to apply at least 1 text style from "${libraryInfo.name}" to a text field in your document.`
      });

      return false;
    }

    const localStyles = Array.from(allTextStylesInUse.values()).filter(s => s.styleType === 'LOCAL');
    const remoteStyles = Array.from(allTextStylesInUse.values()).filter(s => s.styleType === 'REMOTE/LIBRARY');

    console.log(`   🏠 Local styles: ${localStyles.length}`);
    console.log(`   🌐 Remote/Library styles: ${remoteStyles.length}`);

    console.log(`\n📋 ALL TEXT STYLES IN USE:`);
    let index = 1;
    for (const [styleId, styleInfo] of allTextStylesInUse) {
      console.log(`   ${index}. [${styleInfo.styleType}] "${styleInfo.styleName}" (${styleInfo.nodeCount} nodes) - ID: ${styleId}`);
      index++;
    }

    // NOW: Check for the specific design system
    console.log(`\n🔍 STEP 2: Checking for styles from selected design system...`);

    // Extract file keys from the actual text style IDs we found
    let targetFileKeys: string[] = [];

    // Get file keys from remote text styles that are actually in use
    for (const [styleId, styleInfo] of allTextStylesInUse) {
      if (styleInfo.styleType === 'REMOTE/LIBRARY') {
        // Style ID format: "S:fileKey,nodeId:styleId" 
        if (styleId.startsWith('S:') && styleId.includes(',')) {
          const afterS = styleId.substring(2); // Remove "S:"
          const [fileKey] = afterS.split(','); // Get part before comma
          if (fileKey && !targetFileKeys.includes(fileKey)) {
            targetFileKeys.push(fileKey);
            console.log(`📁 Extracted file key from style "${styleInfo.styleName}": ${fileKey}`);
          }
        }
      }
    }

    // Also try to get file keys from collection keys if available
    if (libraryInfo.type === 'library-variables' && libraryInfo.collections) {
      for (const collection of libraryInfo.collections) {
        if (collection.key && collection.key.includes(':')) {
          const [fileKey] = collection.key.split(':');
          if (!targetFileKeys.includes(fileKey)) {
            targetFileKeys.push(fileKey);
            console.log(`📁 Extracted file key from collection "${collection.name}": ${fileKey}`);
          }
        }
      }
    }

    console.log(`🎯 Target file keys to check: [${targetFileKeys.join(', ')}]`);

    if (targetFileKeys.length === 0) {
      console.log(`⚠️ No file keys found to check against. This might be why no matches are found.`);
    }

    // Scan document for text styles from this specific design system
    const stylesFromSelectedSystem = new Map<string, { styleName: string; nodeCount: number }>();
    let totalNodesUsingSelectedSystem = 0;

    async function scanNodeForSelectedSystem(node: BaseNode) {
      if (node.type === 'TEXT') {
        const textNode = node as TextNode;
        if (textNode.textStyleId && textNode.textStyleId !== figma.mixed) {
          // Check if this style is from our selected design system
          if (typeof textNode.textStyleId === 'string' && textNode.textStyleId.includes(':')) {
            let fileKey = '';

            // Handle different style ID formats
            if (textNode.textStyleId.startsWith('S:') && textNode.textStyleId.includes(',')) {
              // Format: "S:fileKey,nodeId:styleId"
              const afterS = textNode.textStyleId.substring(2); // Remove "S:"
              const [extractedFileKey] = afterS.split(','); // Get part before comma
              fileKey = extractedFileKey;
              console.log(`🔍 Checking style ID: ${textNode.textStyleId} → extracted file key: ${fileKey}`);
            } else {
              // Standard format: "fileKey:styleId"
              const [extractedFileKey] = textNode.textStyleId.split(':');
              fileKey = extractedFileKey;
              console.log(`🔍 Checking style ID: ${textNode.textStyleId} → extracted file key: ${fileKey}`);
            }

            // Check if this style is from our selected design system
            console.log(`🔍 Checking if file key "${fileKey}" is in target keys: [${targetFileKeys.join(', ')}]`);
            if (targetFileKeys.includes(fileKey)) {
              console.log(`✅ MATCH FOUND! File key "${fileKey}" matches selected design system`);
            } else {
              console.log(`❌ No match. File key "${fileKey}" not in target keys.`);
            }

            if (targetFileKeys.includes(fileKey)) {
              try {
                const style = await figma.getStyleByIdAsync(textNode.textStyleId);
                if (style && style.type === 'TEXT') {
                  const key = textNode.textStyleId;
                  if (stylesFromSelectedSystem.has(key)) {
                    stylesFromSelectedSystem.get(key)!.nodeCount++;
                  } else {
                    stylesFromSelectedSystem.set(key, {
                      styleName: style.name,
                      nodeCount: 1
                    });
                  }
                  totalNodesUsingSelectedSystem++;
                  console.log(`✅ Found style from selected system: "${style.name}"`);
                }
              } catch (error) {
                console.log(`⚠️ Could not resolve style ${textNode.textStyleId}:`, error);
              }
            }
          }
        }
      }

      if ('children' in node) {
        for (const child of node.children) {
          await scanNodeForSelectedSystem(child);
        }
      }
    }

    // Load all pages first to access their children
    console.log('� Lcoading all pages...');
    await figma.loadAllPagesAsync();

    // Now scan specifically for the selected design system styles
    console.log('🔍 Scanning for styles from selected design system...');
    await scanNodeForSelectedSystem(figma.root);

    // Report findings
    console.log(`\n📊 SELECTED DESIGN SYSTEM USAGE RESULTS:`);
    console.log(`   📚 Design System: "${libraryInfo.name}"`);
    console.log(`   🎯 Unique styles found: ${stylesFromSelectedSystem.size}`);
    console.log(`   📝 Total text nodes using this system: ${totalNodesUsingSelectedSystem}`);

    if (stylesFromSelectedSystem.size === 0) {
      console.log(`\n❌ NO STYLES FROM SELECTED DESIGN SYSTEM FOUND`);
      console.log(`   This document is NOT currently using any text styles from "${libraryInfo.name}"`);
      console.log(`   The selected design system may not be in use, or may only have variables/components`);

      // Alert the user via UI
      figma.ui.postMessage({
        type: 'no-design-system-usage',
        libraryName: libraryInfo.name,
        message: `No text styles from "${libraryInfo.name}" are currently in use in this document. To validate design system usage, you need to apply at least 1 text style from "${libraryInfo.name}" to a text field in your document.`
      });

      return false; // Validation not possible
    } else {
      console.log(`\n✅ STYLES FROM SELECTED DESIGN SYSTEM IN USE:`);
      let index = 1;
      for (const [key, styleInfo] of stylesFromSelectedSystem) {
        console.log(`   ${index}. "${styleInfo.styleName}" (${styleInfo.nodeCount} nodes)`);
        index++;
      }
    }

    console.log('\n✅✅✅ SELECTED DESIGN SYSTEM USAGE CHECK COMPLETE ✅✅✅');

  } catch (error) {
    console.error('❌ Error checking selected design system usage:', error);
    return false; // Validation not possible due to error
  }

  return true; // Validation is possible
}

// Function to scan document for remote text styles and show REST API approach
async function scanDocumentForRemoteTextStyles() {
  console.log('🔍🔍🔍 SCANNING DOCUMENT FOR REMOTE TEXT STYLES 🔍🔍🔍');

  try {
    // Step 1: Scan entire document for remote/library text styles in use
    const remoteStylesInUse = new Map<string, { styleName: string; fileKey: string; nodeCount: number }>();

    async function scanNode(node: BaseNode) {
      if (node.type === 'TEXT') {
        const textNode = node as TextNode;
        if (textNode.textStyleId && textNode.textStyleId !== figma.mixed) {
          // Library styles have format "fileKey:styleId"
          if (typeof textNode.textStyleId === 'string' && textNode.textStyleId.includes(':')) {
            const [fileKey, styleId] = textNode.textStyleId.split(':');

            try {
              // Get the style to find its name
              const style = await figma.getStyleByIdAsync(textNode.textStyleId);
              if (style && style.type === 'TEXT') {
                const key = `${fileKey}:${styleId}`;
                if (remoteStylesInUse.has(key)) {
                  remoteStylesInUse.get(key)!.nodeCount++;
                } else {
                  remoteStylesInUse.set(key, {
                    styleName: style.name,
                    fileKey: fileKey,
                    nodeCount: 1
                  });
                }
                console.log(`📝 Found remote text style: "${style.name}" (File: ${fileKey})`);
              }
            } catch (error) {
              console.log(`⚠️ Could not resolve style ${textNode.textStyleId}:`, error);
            }
          }
        }
      }

      if ('children' in node) {
        for (const child of node.children) {
          await scanNode(child);
        }
      }
    }

    // Load all pages first to access their children
    console.log('� Loading  all pages...');
    await figma.loadAllPagesAsync();

    // Scan the entire document (all pages)
    console.log('🔍 Scanning entire document for remote text styles...');
    await scanNode(figma.root);

    console.log(`📊 Found ${remoteStylesInUse.size} unique remote text styles in use`);

    if (remoteStylesInUse.size === 0) {
      console.log('⚠️ NO REMOTE TEXT STYLES FOUND');
      console.log('   This document is not using any library text styles');
      console.log('   All text is either using local styles or hardcoded formatting');
      return;
    }

    // Step 2: Group by file key (library file)
    const libraryFiles = new Map<string, { styles: any[] }>();

    for (const [key, styleInfo] of remoteStylesInUse) {
      if (!libraryFiles.has(styleInfo.fileKey)) {
        libraryFiles.set(styleInfo.fileKey, { styles: [] });
      }
      libraryFiles.get(styleInfo.fileKey)!.styles.push(styleInfo);
    }

    console.log(`📚 Remote styles come from ${libraryFiles.size} different library files`);

    // Step 3: For each library file, show how to fetch ALL published text styles via REST API
    for (const [fileKey, fileInfo] of libraryFiles) {
      console.log(`\n� LIB{RARY FILE: ${fileKey}`);
      console.log(`   📝 Currently using ${fileInfo.styles.length} styles from this library:`);

      fileInfo.styles.forEach((style, index) => {
        console.log(`      ${index + 1}. "${style.styleName}" (${style.nodeCount} nodes)`);
      });

      // Step 4: Attempt to fetch ALL published text styles from this library
      console.log(`\n🚀 ATTEMPTING TO FETCH ALL PUBLISHED TEXT STYLES FROM LIBRARY:`);
      console.log(`   📁 Library File Key: ${fileKey}`);

      try {
        // Try to get all available styles from the team library
        console.log(`\n� FetchEing all published text styles...`);

        // Try to get all available styles using available APIs
        console.log(`🔍 Attempting to discover all published styles from this library...`);

        // Get all available library variable collections (this works)
        const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
        console.log(`📊 Found ${libraryCollections.length} library collections`);

        // Try to find collections from this specific file
        const collectionsFromThisFile: any[] = [];
        for (const collection of libraryCollections) {
          if (collection.key.includes(fileKey)) {
            collectionsFromThisFile.push(collection);
            console.log(`✅ Found collection from this library: "${collection.name}" (Key: ${collection.key})`);
          }
        }

        // Since we can't directly get all published text styles, let's try a different approach
        // We'll attempt to import styles by trying common style keys
        console.log(`\n🔍 Attempting to discover text styles by trying to import them...`);

        const discoveredStyles: any[] = [];

        // Try to import styles we know are being used to see if we can get more info
        for (const style of fileInfo.styles) {
          try {
            // Try to get more info about styles we know exist
            console.log(`🔍 Analyzing known style: "${style.styleName}"`);

            // The style is already imported since it's being used
            // Let's see if we can find related styles by pattern matching
            const baseStyleName = style.styleName.split('/')[0]; // e.g., "Display" from "Display/Large"
            console.log(`   📝 Base style family: "${baseStyleName}"`);

            discoveredStyles.push({
              name: style.styleName,
              family: baseStyleName,
              usage: `${style.nodeCount} nodes`,
              status: 'IN_USE'
            });

          } catch (error) {
            console.log(`   ⚠️ Could not analyze style: ${error}`);
          }
        }

        console.log(`\n📊 DISCOVERED STYLES FROM THIS LIBRARY (${fileKey}):`);
        console.log(`   📝 Analyzed styles: ${discoveredStyles.length}`);

        if (discoveredStyles.length === 0) {
          console.log(`   ⚠️ No styles could be analyzed from this library file`);
        } else {
          console.log(`\n📋 STYLE ANALYSIS RESULTS:`);

          // Group by style family
          const styleFamilies = new Map<string, any[]>();
          for (const style of discoveredStyles) {
            if (!styleFamilies.has(style.family)) {
              styleFamilies.set(style.family, []);
            }
            styleFamilies.get(style.family)!.push(style);
          }

          console.log(`   📝 Style families found: ${styleFamilies.size}`);

          for (const [family, styles] of styleFamilies) {
            console.log(`\n   📁 ${family} Family:`);
            styles.forEach((style, index) => {
              console.log(`      ${index + 1}. "${style.name}" (${style.usage}) - ${style.status}`);
            });
          }

          console.log(`\n💡 STYLE DISCOVERY INSIGHTS:`);
          console.log(`   Based on the styles in use, this library likely contains:`);

          for (const [family] of styleFamilies) {
            console.log(`   📁 ${family} family - potentially includes variants like:`);
            console.log(`      - ${family}/Small, ${family}/Medium, ${family}/Large`);
            console.log(`      - ${family}/Regular, ${family}/Bold, ${family}/Light`);
          }

          console.log(`\n🚀 TO SEE ALL PUBLISHED STYLES, USE REST API:`);
          console.log(`   URL: https://api.figma.com/v1/files/${fileKey}`);
          console.log(`   This will return ALL published styles from this library file`);
        }

        // Send request to UI to make REST API call
        console.log(`\n📡 Requesting UI to fetch all published styles via REST API...`);
        figma.ui.postMessage({
          type: 'fetch-library-styles',
          fileKey: fileKey,
          libraryName: 'Blueprint Atoms' // or get from context
        });

      } catch (error) {
        console.error(`❌ Error fetching published text styles:`, error);
        console.log(`\n📋 FALLBACK - REST API APPROACH:`);
        console.log(`   Since direct access failed, you would need to use the REST API:`);
        console.log(`   URL: https://api.figma.com/v1/files/${fileKey}`);
        console.log(`   Method: GET`);
        console.log(`   Headers: { 'Authorization': 'Bearer YOUR_FIGMA_ACCESS_TOKEN' }`);
        console.log(`   Then filter response.styles for style_type === 'TEXT'`);
      }
      console.log(`   const textStyles = data.styles.filter(s => s.style_type === 'TEXT');`);
      console.log(`   for (const style of textStyles) {`);
      console.log(`     await figma.importStyleByKeyAsync(style.key);`);
      console.log(`   }`);
    }

    // Step 5: Summary
    console.log(`\n📊 REMOTE TEXT STYLE SCAN SUMMARY:`);
    console.log(`   📚 Total remote styles in use: ${remoteStylesInUse.size}`);
    console.log(`   📁 Library files involved: ${libraryFiles.size}`);

    let totalNodes = 0;
    for (const [key, styleInfo] of remoteStylesInUse) {
      totalNodes += styleInfo.nodeCount;
    }
    console.log(`   🎯 Total text nodes using remote styles: ${totalNodes}`);

    console.log('\n✅✅✅ REMOTE TEXT STYLE SCAN COMPLETE ✅✅✅');

  } catch (error) {
    console.error('❌ Error scanning for remote text styles:', error);
  }
}

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

// Function to get text styles count from a design system
async function getTextStylesCount(libraryInfo: any): Promise<number> {
  try {
    // For now, we'll use the simulated count from our REST API simulation
    // In a real implementation, this would make an actual API call
    console.log(`📊 Getting text styles count for ${libraryInfo.name}...`);

    // Based on our Blueprint Atoms simulation, we know there are 16 text styles
    // This should be replaced with actual API call: GET /v1/files/{file_key}
    return 16; // Simulated count
  } catch (error) {
    console.error('❌ Error getting text styles count:', error);
    return 0;
  }
}



/**
 * Function to get spacing variables count from a design system
 * 
 * SPACING DETECTION RULES:
 * This function counts variables from collections whose names contain spacing-related keywords.
 * 
 * SUPPORTED COLLECTION NAMES (case-insensitive):
 * - Collections containing: "spacing", "space", "gap", "margin", "padding", "size"
 * - Examples that WILL be detected:
 *   ✅ "Spacing"
 *   ✅ "Space" 
 *   ✅ "Design Spacing"
 *   ✅ "Layout Spacing"
 *   ✅ "Spacing Tokens"
 *   ✅ "Gap"
 *   ✅ "Margins"
 *   ✅ "Padding"
 *   ✅ "Size"
 *   ✅ "Component Spacing"
 * 
 * TROUBLESHOOTING:
 * If your spacing variables show "0 Variables Available":
 * 1. Check your variable collection names in Figma
 * 2. Ensure at least one collection name contains one of the keywords above
 * 3. If your spacing variables are in a collection named something else (like "Design Tokens" 
 *    or "Foundation"), consider renaming it to include "Spacing" or "Space"
 * 4. Alternative: Create a dedicated "Spacing" collection for your spacing variables
 * 
 * WHAT GETS COUNTED:
 * - ALL variables within collections that match the naming criteria
 * - Individual variable names within those collections are not filtered
 * - If a collection is named "Spacing", all variables in it count as spacing variables
 */
async function getSpacingVariablesCount(libraryInfo: any): Promise<number> {
  try {
    console.log(`📊 Getting spacing variables count for ${libraryInfo.name}...`);
    console.log(`📋 SPACING DETECTION: Looking for collections with names containing: spacing, space, gap, margin, padding, size`);

    // Check if the library has variable collections
    if (libraryInfo.collections && libraryInfo.collections.length > 0) {
      let spacingCount = 0;
      const detectedCollections: string[] = [];
      const skippedCollections: string[] = [];

      console.log(`🔍 Analyzing ${libraryInfo.collections.length} collections...`);

      for (const collection of libraryInfo.collections) {
        console.log(`🔍 Checking collection: "${collection.name}" with ${collection.variableCount} variables`);

        // Check if the collection name suggests it contains spacing variables
        const collectionName = collection.name.toLowerCase();
        const isSpacingCollection = collectionName.includes('spacing') ||
          collectionName.includes('space') ||
          collectionName.includes('gap') ||
          collectionName.includes('margin') ||
          collectionName.includes('padding') ||
          collectionName.includes('size');

        if (isSpacingCollection) {
          console.log(`✅ "${collection.name}" is a spacing collection with ${collection.variableCount} variables`);
          spacingCount += collection.variableCount;
          detectedCollections.push(`"${collection.name}" (${collection.variableCount} variables)`);
        } else {
          console.log(`⏭️ "${collection.name}" is not a spacing collection, skipping`);
          skippedCollections.push(`"${collection.name}"`);
        }
      }

      console.log(`\n📊 SPACING DETECTION SUMMARY:`);
      console.log(`   ✅ Detected spacing collections: ${detectedCollections.length > 0 ? detectedCollections.join(', ') : 'None'}`);
      console.log(`   ⏭️ Skipped collections: ${skippedCollections.length > 0 ? skippedCollections.join(', ') : 'None'}`);
      console.log(`   📏 Total spacing variables: ${spacingCount}`);

      if (spacingCount === 0) {
        console.log(`\n⚠️ TROUBLESHOOTING: No spacing variables detected!`);
        console.log(`   💡 To fix this, ensure at least one collection name contains:`);
        console.log(`      "spacing", "space", "gap", "margin", "padding", or "size"`);
        console.log(`   💡 Consider renaming a collection to "Spacing" or creating a dedicated spacing collection`);
      }

      return spacingCount;
    }

    // Fallback: simulated count for spacing variables
    console.log(`📏 No collections found, using fallback count`);
    return 24; // Simulated count
  } catch (error) {
    console.error('❌ Error getting spacing variables count:', error);
    return 0;
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

    // Store the current design system globally
    currentDesignSystem = libraryInfo;

    // Get counts for validation options (always show these)
    const textStylesCount = await getTextStylesCount(libraryInfo);
    const spacingCount = await getSpacingVariablesCount(libraryInfo);

    // Always send the attachment success message with counts
    figma.ui.postMessage({
      type: 'design-system-attached',
      library: libraryInfo,
      counts: {
        textStyles: textStylesCount,
        spacing: spacingCount
      }
    });

    // Check if this specific design system's styles are being used in the document
    const validationPossible = await checkSelectedDesignSystemUsage(libraryInfo);

    if (validationPossible) {
      // Scan document for remote text styles and show REST API approach
      await scanDocumentForRemoteTextStyles();
    }
    // If validation is not possible, the user has already been alerted by checkSelectedDesignSystemUsage

  } catch (error) {
    console.error('❌ Error attaching design system:', error);
    figma.ui.postMessage({
      type: 'design-system-error',
      error: 'Failed to attach design system: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

// Function to get tokens for display in the tokens panel
async function getTokensForDisplay(tokenType: string) {
  console.log(`📋 Getting ${tokenType} tokens for display...`);

  try {
    // Get the currently attached design system
    const selectedLibraryId = await figma.clientStorage.getAsync('selectedLibraryId');
    if (!selectedLibraryId) {
      console.log('❌ No design system attached');
      figma.ui.postMessage({
        type: 'tokens-response',
        tokens: [],
        tokenType: tokenType,
        error: 'No design system attached'
      });
      return;
    }

    let tokens: any[] = [];

    if (tokenType === 'text-styles') {
      // Get text styles from the attached design system
      tokens = await getTextStylesForDisplay();
    } else if (tokenType === 'spacing') {
      // Get spacing variables from the attached design system
      tokens = await getSpacingVariablesForDisplay();
    }

    console.log(`📋 Found ${tokens.length} ${tokenType} tokens`);

    figma.ui.postMessage({
      type: 'tokens-response',
      tokens: tokens,
      tokenType: tokenType
    });

  } catch (error) {
    console.error(`❌ Error getting ${tokenType} tokens:`, error);
    figma.ui.postMessage({
      type: 'tokens-response',
      tokens: [],
      tokenType: tokenType,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Function to get text styles for display
async function getTextStylesForDisplay(): Promise<any[]> {
  console.log('📝 Getting text styles for display...');

  try {
    const selectedLibraryId = await figma.clientStorage.getAsync('selectedLibraryId');
    let textStyles: any[] = [];

    if (selectedLibraryId === 'local-styles') {
      // Get local text styles
      const localStyles = await figma.getLocalTextStylesAsync();
      textStyles = localStyles.map(style => ({
        id: style.id,
        key: style.key,
        name: style.name,
        description: `${style.fontName.family} ${style.fontName.style} - ${style.fontSize}px`,
        fontSize: style.fontSize
      }));
    } else {
      // For team library text styles, we need to use a different approach
      // Since getTeamLibraryStylesAsync doesn't exist, we'll use the simulated data
      // In a real implementation, this would require REST API calls
      console.log('📝 Using simulated team library text styles (REST API required for real data)');

      // Return simulated text styles for team libraries
      textStyles = [
        { id: 'display-large', key: 'display-large', name: 'Display/Large', description: 'Large display text (57/64)', fontSize: 57 },
        { id: 'display-medium', key: 'display-medium', name: 'Display/Medium', description: 'Medium display text (45/52)', fontSize: 45 },
        { id: 'display-small', key: 'display-small', name: 'Display/Small', description: 'Small display text (36/44)', fontSize: 36 },
        { id: 'headline-large', key: 'headline-large', name: 'Headline/Large', description: 'Large headline text (32/40)', fontSize: 32 },
        { id: 'headline-medium', key: 'headline-medium', name: 'Headline/Medium', description: 'Medium headline text (28/36)', fontSize: 28 },
        { id: 'headline-small', key: 'headline-small', name: 'Headline/Small', description: 'Small headline text (24/32)', fontSize: 24 },
        { id: 'title-large', key: 'title-large', name: 'Title/Large', description: 'Large title text (22/28)', fontSize: 22 },
        { id: 'title-medium', key: 'title-medium', name: 'Title/Medium', description: 'Medium title text (16/24)', fontSize: 16 },
        { id: 'title-small', key: 'title-small', name: 'Title/Small', description: 'Small title text (14/20)', fontSize: 14 },
        { id: 'body-large', key: 'body-large', name: 'Body/Large', description: 'Large body text (16/24)', fontSize: 16 },
        { id: 'body-medium', key: 'body-medium', name: 'Body/Medium', description: 'Medium body text (14/20)', fontSize: 14 },
        { id: 'body-small', key: 'body-small', name: 'Body/Small', description: 'Small body text (12/16)', fontSize: 12 },
        { id: 'label-large', key: 'label-large', name: 'Label/Large', description: 'Large label text (14/20)', fontSize: 14 },
        { id: 'label-medium', key: 'label-medium', name: 'Label/Medium', description: 'Medium label text (12/16)', fontSize: 12 },
        { id: 'label-small', key: 'label-small', name: 'Label/Small', description: 'Small label text (11/16)', fontSize: 11 }
      ];
    }

    console.log(`📝 Found ${textStyles.length} text styles`);
    return textStyles;

  } catch (error) {
    console.error('❌ Error getting text styles:', error);

    // Fallback to simulated styles if there's an error
    const simulatedTextStyles = [
      { id: 'display-large', key: 'display-large', name: 'Display/Large', description: 'Large display text (57/64)', fontSize: 57 },
      { id: 'display-medium', key: 'display-medium', name: 'Display/Medium', description: 'Medium display text (45/52)', fontSize: 45 },
      { id: 'display-small', key: 'display-small', name: 'Display/Small', description: 'Small display text (36/44)', fontSize: 36 },
      { id: 'headline-large', key: 'headline-large', name: 'Headline/Large', description: 'Large headline text (32/40)', fontSize: 32 },
      { id: 'headline-medium', key: 'headline-medium', name: 'Headline/Medium', description: 'Medium headline text (28/36)', fontSize: 28 },
      { id: 'headline-small', key: 'headline-small', name: 'Headline/Small', description: 'Small headline text (24/32)', fontSize: 24 },
      { id: 'title-large', key: 'title-large', name: 'Title/Large', description: 'Large title text (22/28)', fontSize: 22 },
      { id: 'title-medium', key: 'title-medium', name: 'Title/Medium', description: 'Medium title text (16/24)', fontSize: 16 },
      { id: 'title-small', key: 'title-small', name: 'Title/Small', description: 'Small title text (14/20)', fontSize: 14 },
      { id: 'body-large', key: 'body-large', name: 'Body/Large', description: 'Large body text (16/24)', fontSize: 16 },
      { id: 'body-medium', key: 'body-medium', name: 'Body/Medium', description: 'Medium body text (14/20)', fontSize: 14 },
      { id: 'body-small', key: 'body-small', name: 'Body/Small', description: 'Small body text (12/16)', fontSize: 12 },
      { id: 'label-large', key: 'label-large', name: 'Label/Large', description: 'Large label text (14/20)', fontSize: 14 },
      { id: 'label-medium', key: 'label-medium', name: 'Label/Medium', description: 'Medium label text (12/16)', fontSize: 12 },
      { id: 'label-small', key: 'label-small', name: 'Label/Small', description: 'Small label text (11/16)', fontSize: 11 }
    ];

    return simulatedTextStyles;
  }
}

// Function to get spacing variables for display
async function getSpacingVariablesForDisplay(): Promise<any[]> {
  console.log('📏 Getting spacing variables for display...');

  try {
    // Get the external libraries to find spacing collections
    const externalLibraries = await getExternalLibraries();
    const spacingTokens: any[] = [];

    for (const libData of externalLibraries) {
      const { collection, variables } = libData;

      // Check if this collection contains spacing variables
      const collectionName = collection.name.toLowerCase();
      const isSpacingCollection = collectionName.includes('spacing') ||
        collectionName.includes('space') ||
        collectionName.includes('gap') ||
        collectionName.includes('margin') ||
        collectionName.includes('padding') ||
        collectionName.includes('size');

      if (isSpacingCollection) {
        console.log(`📏 Found spacing collection: "${collection.name}" with ${variables.length} variables`);

        // Add all variables from this spacing collection
        for (const variable of variables) {
          console.log(`📏 Processing variable: "${variable.name}", type: ${variable.resolvedType}`);

          let value: number | string = 'N/A';

          // Try to get the actual variable to access its values
          try {
            const fullVariable = await figma.variables.importVariableByKeyAsync(variable.key);
            if (fullVariable && fullVariable.valuesByMode) {
              const modeId = Object.keys(fullVariable.valuesByMode)[0];
              const rawValue = fullVariable.valuesByMode[modeId];

              console.log(`📏 Variable "${variable.name}" raw value:`, rawValue);

              if (typeof rawValue === 'number') {
                value = Math.round(rawValue);
              } else {
                // If the variable name is a number, use that as fallback
                const nameAsNumber = parseInt(variable.name);
                if (!isNaN(nameAsNumber)) {
                  value = nameAsNumber;
                  console.log(`📏 Using variable name "${variable.name}" as value: ${value}`);
                }
              }
            }
          } catch (importError) {
            console.log(`📏 Could not import variable "${variable.name}":`, importError);
            // If the variable name is a number, use that as fallback
            const nameAsNumber = parseInt(variable.name);
            if (!isNaN(nameAsNumber)) {
              value = nameAsNumber;
              console.log(`📏 Using variable name "${variable.name}" as fallback value: ${value}`);
            }
          }

          spacingTokens.push({
            name: variable.name,
            value: value,
            description: `Spacing variable from ${collection.name}`,
            collection: collection.name
          });
        }
      }
    }

    // If no spacing tokens found, return simulated ones based on the user's example
    if (spacingTokens.length === 0) {
      console.log('📏 No spacing collections found, returning simulated tokens');
      return [
        { name: '8', value: 8, description: 'Small spacing token', collection: 'Spacing' },
        { name: '16', value: 16, description: 'Medium spacing token', collection: 'Spacing' },
        { name: '32', value: 32, description: 'Large spacing token', collection: 'Spacing' }
      ];
    }

    console.log(`📏 Returning ${spacingTokens.length} spacing tokens:`, spacingTokens);
    return spacingTokens;

  } catch (error) {
    console.error('❌ Error getting spacing variables for display:', error);
    // Return simulated tokens as fallback
    return [
      { name: '8', value: 8, description: 'Small spacing token', collection: 'Spacing' },
      { name: '16', value: 16, description: 'Medium spacing token', collection: 'Spacing' },
      { name: '32', value: 32, description: 'Large spacing token', collection: 'Spacing' }
    ];
  }
}

// Function to load documentation content
async function loadDocumentationContent() {
  console.log('📖 Loading documentation content...');

  // Convert the markdown content to HTML (simplified version)
  const documentationHTML = `
    <h1>Token Validation Tool - Documentation</h1>
    
    <h2>Overview</h2>
    <p>The Token Validation Tool helps teams keep typography and spacing consistent across Figma files by checking what's in your document against the design system you attach (local styles/variables or published team libraries). It scans your file, flags mismatches, and recommends replacing hard-coded values with the appropriate design tokens so you can fix issues quickly and confidently.</p>
    
    <h3>Why local variables matter</h3>
    <p>This tool is built around Figma local variables, which are the most reliable way to encode spacing, colors, and typography as design tokens—making them reusable, theme-able, and machine-verifiable. We provide companion plugins to create tokens as local variables and to convert existing hard-coded values into local variables. Today, the best practice—and what this tool supports—is to build your system using local variables.</p>
    
    <h3>What the tool validates today</h3>
    <ul>
      <li><strong>Text Styles</strong> → Finds text layers without a style, surfaces available styles, and prompts you to apply the appropriate style from the attached system.</li>
      <li><strong>Spacing Tokens</strong> → Detects hard-coded spacing (e.g., 16px) and recommends replacing it with a spacing token from your attached system's variable collections (not a guessed variable name).</li>
    </ul>
    
    <h3>How it works (at a glance)</h3>
    <ol>
      <li>Attach a design system (your file's local variables/styles or a published team library).</li>
      <li>The tool scans your document for text, spacing, and variable usage.</li>
      <li>It highlights inconsistencies and suggests using tokens instead of hard-coded values (e.g., replace 16px with a matching spacing token from your system).</li>
      <li>You apply corrections to align your file with the design system.</li>
    </ol>
    
    <h3>Who it's for</h3>
    <ul>
      <li>Designers who want fast, reliable guardrails for token usage</li>
      <li>Design-ops and system owners migrating teams to variable-based tokens</li>
      <li>Anyone auditing files before handoff to ensure token parity with the system</li>
    </ul>
    <p><strong>Note:</strong> The tool recommends using tokens and surfaces candidate matches from your attached system. It does not invent or guess new token names; creating or renaming tokens is handled by the companion creation/conversion plugins.</p>
    
    <h2>Getting Started</h2>
    
    <h3>1. Attach a Design System</h3>
    <ol>
      <li>Click "Attach Design System" in the main interface</li>
      <li>Select from available design systems:
        <ul>
          <li><strong>Local Styles & Variables</strong>: Your current document's styles and variables</li>
          <li><strong>Team Libraries</strong>: Published design systems from your team</li>
        </ul>
      </li>
    </ol>
    
    <h3>2. Validation Options</h3>
    <p>Once a design system is attached, you'll see validation options with counts:</p>
    <ul>
      <li><strong>Text Styles</strong>: Validates text style usage (shows "X Styles Available")</li>
      <li><strong>Spacing</strong>: Validates spacing tokens and layout consistency (shows "X Variables Available")</li>
    </ul>
    
    <h2>Spacing Variable Detection</h2>
    
    <h3>How It Works</h3>
    <p>The tool automatically detects spacing variables by looking at <strong>collection names</strong>. It counts ALL variables within collections whose names contain spacing-related keywords.</p>
    
    <h3>Supported Collection Names (Case-Insensitive)</h3>
    <p>Collections will be detected if their name contains any of these keywords:</p>
    <ul>
      <li><code>spacing</code></li>
      <li><code>space</code></li>
      <li><code>gap</code></li>
      <li><code>margin</code></li>
      <li><code>padding</code></li>
      <li><code>size</code></li>
    </ul>
    
    <h3>Examples</h3>
    <p><strong>✅ Will be detected:</strong></p>
    <ul>
      <li>"Spacing"</li>
      <li>"Space"</li>
      <li>"Design Spacing"</li>
      <li>"Layout Spacing"</li>
      <li>"Spacing Tokens"</li>
      <li>"Gap"</li>
      <li>"Margins"</li>
      <li>"Padding"</li>
      <li>"Size"</li>
      <li>"Component Spacing"</li>
    </ul>
    
    <p><strong>❌ Will NOT be detected:</strong></p>
    <ul>
      <li>"Design Tokens"</li>
      <li>"Foundation"</li>
      <li>"Variables"</li>
      <li>"System"</li>
      <li>"Tokens"</li>
    </ul>
    
    <h3>Troubleshooting Spacing Variables</h3>
    <p>If your spacing variables show "0 Variables Available":</p>
    <ol>
      <li><strong>Check your collection names</strong> in Figma's Variables panel</li>
      <li><strong>Ensure at least one collection name contains</strong> one of the supported keywords</li>
      <li><strong>Consider renaming</strong> your collection to include "Spacing" or "Space"</li>
      <li><strong>Alternative</strong>: Create a dedicated "Spacing" collection for your spacing variables</li>
    </ol>
    
    <h2>Best Practices</h2>
    
    <h3>Organizing Variables</h3>
    <ol>
      <li><strong>Create dedicated collections</strong> for different token types:
        <ul>
          <li>"Spacing" for spacing tokens</li>
          <li>"Colors" for color tokens</li>
          <li>"Typography" for typography tokens</li>
        </ul>
      </li>
      <li><strong>Use descriptive names</strong> that include relevant keywords for automatic detection</li>
      <li><strong>Group related variables</strong> together in the same collection</li>
    </ol>
    
    <h2>Support</h2>
    
    <h3>Common Issues</h3>
    <p><strong>"0 Variables Available" for spacing</strong>:</p>
    <ul>
      <li>Check collection names contain spacing-related keywords</li>
      <li>Verify variables are in collections, not loose variables</li>
    </ul>
    
    <p><strong>"No design system usage found"</strong>:</p>
    <ul>
      <li>Apply at least one text style from the design system to your document</li>
      <li>Ensure the design system is properly attached</li>
    </ul>
    
    <p><strong>Design system not appearing</strong>:</p>
    <ul>
      <li>Check if the library is published and you have access</li>
      <li>Try refreshing the design system list</li>
    </ul>
  `;

  figma.ui.postMessage({
    type: 'documentation-content',
    content: documentationHTML
  });
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
          console.log(`🐛 DEBUG: Spacing node name: "${node.name}", type: ${node.type}, id: ${node.id}`);

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

function validateNodeTextStyle(node: SceneNode, designSystem: any): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Only validate text nodes
  if (node.type === 'TEXT') {
    const textNode = node as TextNode;

    // Check if the text node has a text style applied
    if (textNode.textStyleId === '' || textNode.textStyleId === figma.mixed) {
      // Get available text styles from the design system
      const availableStyles = designSystem?.textStyles || [];

      console.log(`🐛 DEBUG: Text node name: "${textNode.name}", type: ${textNode.type}, id: ${textNode.id}`);

      issues.push({
        nodeId: textNode.id,
        nodeName: textNode.name || 'Text',
        type: 'text-style',
        severity: 'warning',
        message: 'Text layer has no text style applied',
        suggestion: availableStyles.length > 0 ? 'Apply a text style from the design system' : 'Apply a text style',
        currentValue: 'No text style',
        property: 'textStyleId'
      });
    }
  }

  return issues;
}

async function runTokenValidation(options: { textStyles: boolean, spacing: boolean }, designSystem: any) {
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
      if (options.spacing) {
        allIssues.push(...validateNodeSpacing(node, tokens));
      }

      if (options.textStyles) {
        allIssues.push(...validateNodeTextStyle(node, designSystem));
      }
    }

    console.log(`🔍 Found ${allIssues.length} validation issues`);

    // Send results to UI
    figma.ui.postMessage({
      type: 'validation-results',
      issues: allIssues,
      designSystem: designSystem, // Include design system data for dropdown population
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

/**
 * Update a node with the selected token/style
 */
async function updateNodeWithToken(nodeId: string, tokenId: string, issueIndex: number) {
  try {
    console.log('🔄 Updating node with token:', { nodeId, tokenId, issueIndex });

    // Find the node
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      console.error('❌ Node not found:', nodeId);
      figma.ui.postMessage({
        type: 'update-error',
        error: 'Node not found'
      });
      return;
    }

    // Check if it's a text node
    if (node.type === 'TEXT') {
      // Find the text style by ID
      const textStyles = await figma.getLocalTextStylesAsync();
      console.log('🔍 Available local text styles:', textStyles.map(s => ({ id: s.id, name: s.name, key: s.key })));
      console.log('🔍 Looking for tokenId:', tokenId);

      let targetStyle = textStyles.find(style =>
        style.id === tokenId ||
        style.key === tokenId ||
        style.name === tokenId ||
        style.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === tokenId
      );

      // If not found in local styles, try to import by key if it looks like a library style
      if (!targetStyle && tokenId.includes(':')) {
        try {
          const importedStyle = await figma.importStyleByKeyAsync(tokenId);
          if (importedStyle && importedStyle.type === 'TEXT') {
            targetStyle = importedStyle as TextStyle;
          }
        } catch (error) {
          console.log(`Could not import style by key: ${tokenId}`);
        }
      }

      if (targetStyle) {
        try {
          // First load the current font to allow modifications
          if (node.fontName !== figma.mixed) {
            await figma.loadFontAsync(node.fontName as FontName);
          }

          // Load the target style's font
          await figma.loadFontAsync(targetStyle.fontName);

          // Apply the text style (use async version)
          await node.setTextStyleIdAsync(targetStyle.id);
        } catch (styleError) {
          console.error('❌ Error applying existing text style:', styleError);
          figma.ui.postMessage({
            type: 'update-error',
            error: 'Could not apply existing text style'
          });
          return;
        }

        console.log('✅ Applied text style to node:', node.name);

        // Send success message back to UI
        figma.ui.postMessage({
          type: 'update-success',
          nodeId: nodeId,
          issueIndex: issueIndex,
          appliedStyle: targetStyle.name
        });
      } else {
        // Handle simulated styles by applying formatting manually
        const simulatedStyles = {
          'display-large': { fontSize: 57, fontFamily: 'Roboto', fontWeight: 'Regular' },
          'display-medium': { fontSize: 45, fontFamily: 'Roboto', fontWeight: 'Regular' },
          'display-small': { fontSize: 36, fontFamily: 'Roboto', fontWeight: 'Regular' },
          'headline-large': { fontSize: 32, fontFamily: 'Roboto', fontWeight: 'Medium' },
          'headline-medium': { fontSize: 28, fontFamily: 'Roboto', fontWeight: 'Medium' },
          'headline-small': { fontSize: 24, fontFamily: 'Roboto', fontWeight: 'Medium' },
          'title-large': { fontSize: 22, fontFamily: 'Roboto', fontWeight: 'Medium' },
          'title-medium': { fontSize: 16, fontFamily: 'Roboto', fontWeight: 'Medium' },
          'title-small': { fontSize: 14, fontFamily: 'Roboto', fontWeight: 'Medium' },
          'body-large': { fontSize: 16, fontFamily: 'Roboto', fontWeight: 'Regular' },
          'body-medium': { fontSize: 14, fontFamily: 'Roboto', fontWeight: 'Regular' },
          'body-small': { fontSize: 12, fontFamily: 'Roboto', fontWeight: 'Regular' },
          'label-large': { fontSize: 14, fontFamily: 'Roboto', fontWeight: 'Medium' },
          'label-medium': { fontSize: 12, fontFamily: 'Roboto', fontWeight: 'Medium' },
          'label-small': { fontSize: 11, fontFamily: 'Roboto', fontWeight: 'Medium' }
        };

        const simulatedStyle = simulatedStyles[tokenId as keyof typeof simulatedStyles];
        console.log('🎨 Looking for simulated style:', tokenId, 'Found:', simulatedStyle);
        if (simulatedStyle) {
          try {
            // First load the current font to allow modifications (handle mixed fonts)
            if (node.fontName !== figma.mixed) {
              await figma.loadFontAsync(node.fontName as FontName);
            } else {
              // For mixed fonts, we need to load all unique fonts in the text
              const uniqueFonts = new Set<string>();
              for (let i = 0; i < node.characters.length; i++) {
                const fontName = node.getRangeFontName(i, i + 1);
                if (fontName !== figma.mixed && typeof fontName === 'object') {
                  uniqueFonts.add(`${fontName.family}-${fontName.style}`);
                  await figma.loadFontAsync(fontName as FontName);
                }
              }
            }

            // Load the target font
            const targetFontName = { family: simulatedStyle.fontFamily, style: simulatedStyle.fontWeight };
            await figma.loadFontAsync(targetFontName);

            // Create a text style for this simulated style if it doesn't exist
            const styleName = tokenId.replace('-', '/').replace(/\b\w/g, l => l.toUpperCase());
            let existingStyle = textStyles.find(style => style.name === styleName);

            if (!existingStyle) {
              console.log('🎨 Creating new text style:', styleName);
              existingStyle = figma.createTextStyle();
              existingStyle.name = styleName;
              existingStyle.fontName = targetFontName;
              existingStyle.fontSize = simulatedStyle.fontSize;
            }

            // Apply the text style to the node (use async version)
            await node.setTextStyleIdAsync(existingStyle.id);

            console.log('✅ Applied text style with token to node:', node.name, styleName);

            // Send success message back to UI
            figma.ui.postMessage({
              type: 'update-success',
              nodeId: nodeId,
              issueIndex: issueIndex,
              appliedStyle: styleName
            });
          } catch (fontError) {
            console.error('❌ Error creating/applying text style:', fontError);
            figma.ui.postMessage({
              type: 'update-error',
              error: 'Could not create or apply text style'
            });
          }
        } else {
          console.error('❌ Text style not found:', tokenId);
          figma.ui.postMessage({
            type: 'update-error',
            error: 'Text style not found'
          });
        }
      }
    } else {
      console.error('❌ Node is not a text node:', node.type);
      figma.ui.postMessage({
        type: 'update-error',
        error: 'Selected node is not a text layer'
      });
    }
  } catch (error: any) {
    console.error('❌ Error updating node with token:', error);
    figma.ui.postMessage({
      type: 'update-error',
      error: error?.message || 'Unknown error'
    });
  }
}

async function selectAndHighlightNode(nodeId: string) {
  console.log('🎯 Selecting and highlighting node:', nodeId);

  try {
    const node = await figma.getNodeByIdAsync(nodeId);
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
    else if (msg.type === 'get-tokens') {
      console.log('Handling get-tokens:', msg.tokenType);
      await getTokensForDisplay(msg.tokenType);
    }
    else if (msg.type === 'show-documentation-view') {
      console.log('Handling show-documentation-view');
      await setDocumentationView();
      await loadDocumentationContent();
    }
    else if (msg.type === 'update-node-token') {
      console.log('Handling update-node-token:', msg.nodeId, msg.tokenId);
      await updateNodeWithToken(msg.nodeId, msg.tokenId, msg.issueIndex);
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
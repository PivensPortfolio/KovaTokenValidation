"use strict";
// Main plugin: uses saved library keys to apply external text styles
// Start with fixed UI size
figma.showUI(__html__, { width: 400, height: 900 });
// UI sizing functions for different states
function resizeUI(width, height) {
    figma.ui.resize(width, height);
}
// UI sizes for different screens
const UISizes = {
    EXPORT_SCREEN: { width: 350, height: 400 },
    LINK_SCREEN: { width: 380, height: 400 },
    SELECTION_SCREEN: { width: 400, height: 400 },
    HOME_SCREEN: { width: 400, height: 900 },
    EXPORT_INSTRUCTIONS_SCREEN: { width: 400, height: 480 },
    VALIDATION_RESULTS_SCREEN: { width: 1100, height: 900 },
    VALIDATION_RESULTS_COLLAPSED: { width: 1100, height: 180 },
    CUSTOM: (width, height) => ({ width, height })
};
function setScreenSize(screen) {
    if (screen === 'CUSTOM')
        return;
    const size = UISizes[screen];
    resizeUI(size.width, size.height);
}
// Status values (sequential flow):
// 0 = No JSON file (no libraries saved) - Link Screen
// 1 = User went to design system file - Export Screen
// 2 = Has JSON file, none selected - Selection Screen  
// 3 = JSON file selected, ready to validate - Home Screen
let selectedLibraryKey = null;
// Reset selectedLibraryKey on plugin start to ensure clean state
selectedLibraryKey = null;
// Simple initial setup - always start with selection screen
setScreenSize('SELECTION_SCREEN');
async function getAllSavedLibraries() {
    return (await figma.clientStorage.getAsync('savedLibraries') || {});
}
async function getSavedLibrary(libraryKey) {
    return (await getAllSavedLibraries())[libraryKey] || null;
}
async function clearAllSavedLibraries() {
    await figma.clientStorage.setAsync('savedLibraries', {});
    figma.notify('All saved design systems have been cleared');
}
async function getStatus() {
    const storedStatus = await figma.clientStorage.getAsync('status');
    const libraries = await getAllSavedLibraries();
    const libraryCount = Object.keys(libraries).length;
    console.log('Status check:', { storedStatus, libraryCount });
    // Reset stored status if no library is currently selected
    if (storedStatus != null && !selectedLibraryKey && libraryCount > 0) {
        console.log('Resetting stored status because no library is selected but libraries exist');
        await figma.clientStorage.setAsync('status', null);
        // Continue to default logic below
    }
    else if (storedStatus != null) {
        console.log(`Using stored status: ${storedStatus}`);
        return storedStatus;
    }
    // Default status based on available libraries (only when no stored status)
    console.log('selectedLibraryKey:', selectedLibraryKey);
    if (libraryCount === 0) {
        console.log('No stored status, no libraries - defaulting to Status 0 (Link screen)');
        return 0; // No libraries available
    }
    else if (!selectedLibraryKey) {
        console.log('No stored status, has libraries, no library selected - defaulting to Status 2 (Selection screen)');
        return 2; // Has libraries, none selected - should show selection screen
    }
    else {
        console.log('No stored status, library selected - defaulting to Status 3 (Home screen)');
        return 3; // Library selected - should show home screen
    }
}
async function setStatus(status) {
    await figma.clientStorage.setAsync('status', status);
    console.log(`Status: ${status}`);
}
// Function to analyze and categorize variables using Kova's detection rules
function analyzeLibraryTokens(lib) {
    const textStyles = Object.keys(lib.items || {}).length;
    let colors = 0;
    let spacing = 0;
    let cornerRadius = 0;
    let typography = 0;
    let shadows = 0;
    let borders = 0;
    let opacity = 0;
    let sizing = 0;
    let breakpoints = 0;
    let zIndex = 0;
    let layerStyles = 0; // Note: layer styles aren't currently captured in variables
    if (lib.variables) {
        for (const [collectionKey, variables] of Object.entries(lib.variables)) {
            const collectionName = collectionKey.toLowerCase();
            const variableCount = Object.keys(variables).length;
            // Use Kova's precise detection rules for collection names
            if (
            // Colors: Contains "color", "colour", or exact match "colors"/"colours"
            collectionName.includes('color') ||
                collectionName.includes('colour') ||
                collectionName === 'colors' ||
                collectionName === 'colours') {
                colors += variableCount;
            }
            else if (
            // Spacing: Contains "spacing", "space", "gap", "margin", "padding"
            collectionName.includes('spacing') ||
                collectionName.includes('space') ||
                collectionName.includes('gap') ||
                collectionName.includes('margin') ||
                collectionName.includes('padding')) {
                spacing += variableCount;
            }
            else if (
            // Corner Radius: Contains "corner", "radius", "border", or exact matches
            collectionName.includes('corner') ||
                collectionName.includes('radius') ||
                collectionName.includes('border') ||
                collectionName === 'corner radius' ||
                collectionName === 'border radius') {
                cornerRadius += variableCount;
            }
            else if (
            // Typography: Only very specific typography terms (much more restrictive)
            collectionName.includes('typography') ||
                collectionName.includes('font-size') ||
                collectionName.includes('font-weight') ||
                collectionName.includes('line-height') ||
                collectionName.includes('letter-spacing')) {
                typography += variableCount;
            }
            else if (
            // Shadows/Effects: Contains "shadow", "blur", "glow", "elevation"
            collectionName.includes('shadow') ||
                collectionName.includes('blur') ||
                collectionName.includes('glow') ||
                collectionName.includes('elevation') ||
                collectionName.includes('effect')) {
                shadows += variableCount;
            }
            else if (
            // Borders: Only border-specific terms (not corner radius)
            (collectionName.includes('border') && !collectionName.includes('radius')) ||
                collectionName.includes('stroke') ||
                collectionName.includes('outline')) {
                borders += variableCount;
            }
            else if (
            // Opacity: Contains "opacity" or "alpha"
            collectionName.includes('opacity') ||
                collectionName.includes('alpha')) {
                opacity += variableCount;
            }
            else if (
            // Sizing: Contains "size", "width", "height", "dimension"
            collectionName.includes('size') ||
                collectionName.includes('width') ||
                collectionName.includes('height') ||
                collectionName.includes('dimension')) {
                sizing += variableCount;
            }
            else if (
            // Breakpoints: Contains "breakpoint", "screen", "viewport"
            collectionName.includes('breakpoint') ||
                collectionName.includes('screen') ||
                collectionName.includes('viewport')) {
                breakpoints += variableCount;
            }
            else if (
            // Z-Index: Contains "z-index", "layer", "depth"
            collectionName.includes('z-index') ||
                collectionName.includes('layer') ||
                collectionName.includes('depth')) {
                zIndex += variableCount;
            }
            else {
                // Fallback: Check individual variable names with same precise rules
                for (const variableName of Object.keys(variables)) {
                    const varName = variableName.toLowerCase();
                    if (varName.includes('color') || varName.includes('colour')) {
                        colors++;
                    }
                    else if (varName.includes('spacing') ||
                        varName.includes('space') ||
                        varName.includes('gap') ||
                        varName.includes('margin') ||
                        varName.includes('padding')) {
                        spacing++;
                    }
                    else if (varName.includes('radius') ||
                        varName.includes('corner')) {
                        cornerRadius++;
                    }
                    else if (varName.includes('font-size') ||
                        varName.includes('font-weight') ||
                        varName.includes('line-height') ||
                        varName.includes('letter-spacing') ||
                        varName.includes('typography')) {
                        typography++;
                    }
                    else if (varName.includes('shadow') ||
                        varName.includes('blur') ||
                        varName.includes('glow') ||
                        varName.includes('elevation')) {
                        shadows++;
                    }
                    else if ((varName.includes('border') && !varName.includes('radius')) ||
                        varName.includes('stroke') ||
                        varName.includes('outline')) {
                        borders++;
                    }
                    else if (varName.includes('opacity') || varName.includes('alpha')) {
                        opacity++;
                    }
                    else if (varName.includes('size') ||
                        varName.includes('width') ||
                        varName.includes('height')) {
                        sizing++;
                    }
                    else if (varName.includes('breakpoint') ||
                        varName.includes('screen')) {
                        breakpoints++;
                    }
                    else if (varName.includes('z-index') || varName.includes('layer')) {
                        zIndex++;
                    }
                }
            }
        }
    }
    return {
        textStyles,
        colors,
        spacing,
        cornerRadius,
        typography,
        shadows,
        borders,
        opacity,
        sizing,
        breakpoints,
        zIndex,
        layerStyles
    };
}
async function exportLibraryKeys() {
    var _a;
    function normalizeName(name) {
        let n = name.replace(/\s*\/\s*/g, '/').trim();
        n = n.replace(/^Text\s*Style[s]?\//i, '');
        n = n.replace(/^Typography\//i, '');
        n = n.replace(/\/{2,}/g, '/').replace(/^\/|\/$/g, '');
        return n;
    }
    // Export text styles
    const styles = await figma.getLocalTextStylesAsync();
    const textStylesMap = {};
    const dups = {};
    for (const s of styles) {
        const keyName = normalizeName(s.name);
        if (textStylesMap[keyName]) {
            dups[keyName] = (dups[keyName] || 1) + 1;
            textStylesMap[`${keyName}#${dups[keyName]}`] = s.key;
        }
        else {
            textStylesMap[keyName] = s.key;
        }
    }
    // Export local variables organized by collection
    let variablesMap = {};
    try {
        // Get local variables using the async API
        if (figma.variables && figma.variables.getLocalVariablesAsync) {
            const variables = await figma.variables.getLocalVariablesAsync();
            console.log(`Found ${variables.length} local variables`);
            for (const variable of variables) {
                try {
                    const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
                    const collectionName = (collection === null || collection === void 0 ? void 0 : collection.name) || 'Unknown Collection';
                    const collectionKey = collectionName.toLowerCase().replace(/\s+/g, '-');
                    // Initialize collection if it doesn't exist
                    if (!variablesMap[collectionKey]) {
                        variablesMap[collectionKey] = {};
                    }
                    // Add variable to its collection - prioritize key over id for library compatibility
                    variablesMap[collectionKey][variable.name] = {
                        key: variable.key, // Key is stable across publishes and required for importVariableByKeyAsync
                        id: variable.id, // Keep ID for backward compatibility
                        name: variable.name,
                        collection: collectionName,
                        collectionKey: collectionKey,
                        type: variable.resolvedType,
                        scopes: variable.scopes,
                        values: variable.valuesByMode
                    };
                    console.log(`Exported variable: ${collectionKey}/${variable.name}`);
                }
                catch (error) {
                    console.log(`Could not process variable ${variable.name}:`, error);
                }
            }
        }
        else {
            console.log('Variables API not available in this Figma version');
        }
    }
    catch (error) {
        console.log('Variables export failed:', error);
    }
    const libraryName = (_a = figma.root.name) !== null && _a !== void 0 ? _a : 'Unknown Library';
    const libraryKey = figma.fileKey || `library_${Date.now()}`;
    const payload = {
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
    const totalVariables = Object.keys(variablesMap).reduce((total, collectionKey) => {
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
async function importTextStyleByName(name, libraryKey) {
    const saved = await getSavedLibrary(libraryKey);
    if (!saved)
        throw new Error('No style map found for selected library.');
    const key = saved.items[name];
    if (!key)
        throw new Error(`Style "${name}" not found in ${saved.libraryName}.`);
    const style = await figma.importStyleByKeyAsync(key);
    if (style.type !== 'TEXT')
        throw new Error(`"${name}" is not a text style.`);
    return style;
}
function findAllTextNodesInSelection() {
    const out = [];
    for (const n of figma.currentPage.selection) {
        if (n.type === 'TEXT')
            out.push(n);
        else if ('findAll' in n) {
            out.push(...n.findAll((m) => m.type === 'TEXT'));
        }
    }
    return out;
}
async function createLocalTextStyle() {
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
        }
        catch (error) {
            continue;
        }
    }
    figma.notify('Failed to create text style: No compatible fonts available', { error: true });
}
async function applyStyleToSelection(styleName) {
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
                }
                catch (_a) { }
            }
            await node.setRangeTextStyleIdAsync(0, node.characters.length, style.id);
        }
        const library = await getSavedLibrary(selectedLibraryKey);
        figma.notify(`Applied "${styleName}" from ${library === null || library === void 0 ? void 0 : library.libraryName} to ${nodes.length} text layer(s).`);
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        figma.notify(errorMsg, { error: true });
        throw error;
    }
}
async function applyStyleToNode(styleName, nodeId) {
    if (!selectedLibraryKey) {
        throw new Error('Please select a library first.');
    }
    try {
        const style = await importTextStyleByName(styleName, selectedLibraryKey);
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node || node.type !== 'TEXT') {
            throw new Error('Node not found or is not a text node.');
        }
        const textNode = node;
        // Load the node font to avoid range assignment errors
        const font = textNode.fontName;
        if (font !== figma.mixed && font && typeof font === 'object') {
            try {
                await figma.loadFontAsync(font);
            }
            catch (_a) { }
        }
        await textNode.setRangeTextStyleIdAsync(0, textNode.characters.length, style.id);
        const library = await getSavedLibrary(selectedLibraryKey);
        figma.notify(`Applied "${styleName}" from ${library === null || library === void 0 ? void 0 : library.libraryName} to "${textNode.name}".`);
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        figma.notify(errorMsg, { error: true });
        throw error;
    }
}
// Helper function to validate variable accessibility
async function validateVariableAccess(variable) {
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
    }
    catch (error) {
        console.error('Variable access validation failed:', error);
        return false;
    }
}
// Helper function to import variable by key from team library
async function ensureVariableImportedByName(collectionMatch, variableName, type = 'FLOAT') {
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
async function applySpacingTokenToNode(tokenName, nodeId) {
    var _a;
    console.log('🎯 applySpacingTokenToNode called with:', { tokenName, nodeId, selectedLibraryKey });
    if (!selectedLibraryKey) {
        throw new Error('Please select a library first.');
    }
    try {
        const library = await getSavedLibrary(selectedLibraryKey);
        if (!library) {
            throw new Error('Selected library not found.');
        }
        // Get spacing token data from stored library
        let spacingVariables = {};
        if ((_a = library.variables) === null || _a === void 0 ? void 0 : _a.spacing) {
            spacingVariables = library.variables.spacing;
        }
        else if (library.variables) {
            // Handle old structure
            for (const key in library.variables) {
                if (key.toLowerCase().includes('spacing') || key.toLowerCase().includes('space')) {
                    const variableName = key.replace(/^spacing\//i, '').replace(/^space\//i, '');
                    spacingVariables[variableName] = library.variables[key];
                }
            }
        }
        console.log(`Looking for spacing token: "${tokenName}"`);
        console.log('Available spacing variables:', Object.keys(spacingVariables));
        let tokenData = spacingVariables[tokenName];
        // Try common variations if not found
        if (!tokenData || !tokenData.key) {
            const possibleKeys = [
                tokenName,
                `spacing-${tokenName}`,
                `space-${tokenName}`,
                `${tokenName}px`,
                `spacing/${tokenName}`,
                `space/${tokenName}`
            ];
            for (const key of possibleKeys) {
                if (spacingVariables[key] && spacingVariables[key].key) {
                    console.log(`Found spacing token with key: "${key}"`);
                    tokenData = spacingVariables[key];
                    break;
                }
            }
            // Try finding by variable name
            if (!tokenData || !tokenData.key) {
                for (const [key, data] of Object.entries(spacingVariables)) {
                    if (data && data.name && (data.name === tokenName ||
                        data.name.endsWith(`-${tokenName}`) ||
                        data.name.endsWith(`/${tokenName}`) ||
                        data.name.includes(tokenName))) {
                        console.log(`Found spacing token by name match: "${key}" -> "${data.name}"`);
                        tokenData = data;
                        break;
                    }
                }
            }
        }
        if (!tokenData || !tokenData.key) {
            const availableTokens = Object.keys(spacingVariables).join(', ');
            throw new Error(`Spacing token "${tokenName}" not found in library. Available tokens: ${availableTokens}`);
        }
        console.log(`Found tokenData:`, { name: tokenData.name, key: tokenData.key, collection: tokenData.collection });
        // Import the variable using the proper Team Library API
        let importedVariable;
        try {
            // Try to import by key directly if we have it
            if (tokenData.key) {
                console.log(`🔄 Importing variable by key: ${tokenData.key}`);
                importedVariable = await figma.variables.importVariableByKeyAsync(tokenData.key);
                console.log(`✅ Successfully imported variable: "${importedVariable.name}" (ID: ${importedVariable.id})`);
            }
            else {
                // Fallback: use the helper function to find and import by name
                console.log(`🔄 Importing variable by name using Team Library API: ${tokenData.name}`);
                importedVariable = await ensureVariableImportedByName(c => c.name.toLowerCase().includes('spacing') || c.name.toLowerCase().includes('space'), tokenData.name, 'FLOAT');
                console.log(`✅ Successfully imported variable via Team Library: "${importedVariable.name}" (ID: ${importedVariable.id})`);
            }
        }
        catch (importError) {
            console.error('❌ Failed to import variable:', importError);
            throw new Error(`Cannot import spacing token "${tokenName}". Please ensure the design system library is enabled in the Variables panel. Error: ${importError}`);
        }
        // Get the node and apply the spacing
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node) {
            throw new Error('Node not found.');
        }
        // Apply spacing based on node type
        if (node.type === 'FRAME' || node.type === 'GROUP') {
            const containerNode = node;
            let applied = false;
            // Priority 1: Auto layout gap (itemSpacing)
            if ('layoutMode' in containerNode && containerNode.layoutMode !== 'NONE' && 'itemSpacing' in containerNode) {
                try {
                    console.log(`🔗 Binding variable to itemSpacing`);
                    containerNode.setBoundVariable('itemSpacing', importedVariable);
                    figma.notify(`Applied spacing token "${tokenName}" as gap to "${containerNode.name}".`);
                    applied = true;
                }
                catch (bindError) {
                    console.error('Failed to bind variable to itemSpacing:', bindError);
                    // Continue to try padding
                }
            }
            // Priority 2: Padding (if gap binding failed or not applicable)
            if (!applied && 'paddingLeft' in containerNode) {
                try {
                    console.log(`🔗 Binding variable to padding`);
                    containerNode.setBoundVariable('paddingLeft', importedVariable);
                    containerNode.setBoundVariable('paddingRight', importedVariable);
                    containerNode.setBoundVariable('paddingTop', importedVariable);
                    containerNode.setBoundVariable('paddingBottom', importedVariable);
                    figma.notify(`Applied spacing token "${tokenName}" as padding to "${containerNode.name}".`);
                    applied = true;
                }
                catch (bindError) {
                    console.error('Failed to bind variable to padding:', bindError);
                }
            }
            if (!applied) {
                throw new Error(`Cannot apply spacing to node "${node.name}" - no applicable spacing properties found or variable binding failed.`);
            }
        }
        else {
            throw new Error(`Cannot apply spacing to node type "${node.type}".`);
        }
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        figma.notify(errorMsg, { error: true });
        throw error;
    }
}
async function runValidation(target, library, options, targetName) {
    const results = [];
    const visitedNodes = new Set(); // Prevent infinite recursion
    let nodeCount = 0;
    const MAX_NODES = 1000; // Prevent processing too many nodes
    // Helper function to check if spacing property is bound to a design system variable
    function isSpacingBoundToToken(node, property) {
        try {
            // Check if the property has a bound variable
            const boundVariables = node.boundVariables;
            console.log(`Checking ${property} on node "${node.name}":`, {
                hasBoundVariables: !!boundVariables,
                boundVariables: boundVariables,
                propertyValue: node[property]
            });
            if (!boundVariables) {
                console.log(`No boundVariables found for node "${node.name}"`);
                return false;
            }
            const propertyBinding = boundVariables[property];
            const isBound = propertyBinding !== undefined && propertyBinding !== null;
            console.log(`Property ${property} binding result:`, { propertyBinding, isBound });
            return isBound;
        }
        catch (error) {
            console.log(`Error checking spacing binding for ${property}:`, error);
            return false;
        }
    }
    // Helper function to traverse all nodes with safety checks
    function traverseNode(node, frameName) {
        try {
            // Safety checks
            if (!node || !node.id)
                return;
            if (visitedNodes.has(node.id))
                return; // Prevent circular references
            if (nodeCount >= MAX_NODES)
                return; // Prevent excessive processing
            visitedNodes.add(node.id);
            nodeCount++;
            console.log(`Processing node: "${node.name}" (${node.type})`);
            // Log spacing-related properties for FRAME and GROUP nodes
            if (node.type === 'FRAME' || node.type === 'GROUP') {
                const containerNode = node;
                console.log(`Container node "${node.name}" properties:`, {
                    type: node.type,
                    hasLayoutMode: 'layoutMode' in containerNode,
                    layoutMode: containerNode.layoutMode,
                    hasItemSpacing: 'itemSpacing' in containerNode,
                    itemSpacing: containerNode.itemSpacing,
                    hasPaddingLeft: 'paddingLeft' in containerNode,
                    paddingLeft: containerNode.paddingLeft
                });
            }
            // Text style validation
            if (options.textStyles && node.type === 'TEXT') {
                const textNode = node;
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
                const containerNode = node;
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
                        }
                        else {
                            console.log(`Padding is properly bound to token for "${containerNode.name}"`);
                        }
                    }
                }
                catch (error) {
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
                        }
                        else {
                            console.log(`Gap is properly bound to token for "${containerNode.name}"`);
                        }
                    }
                }
                catch (error) {
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
        }
        catch (error) {
            console.log(`Error processing node ${(node === null || node === void 0 ? void 0 : node.id) || 'unknown'}:`, error);
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
        }
        else {
            // For frames, validate the frame itself
            traverseNode(target, displayName);
        }
        console.log(`Validation complete. Found ${results.length} issues after checking ${nodeCount} nodes`);
        return results;
    }
    catch (error) {
        console.error('Validation failed:', error);
        figma.notify('Validation failed. Please try again.', { error: true });
        return [];
    }
}
figma.ui.onmessage = async (msg) => {
    var _a, _b, _c, _d;
    if (msg.type === 'get-ui-mode') {
        console.log('UI requesting mode...');
        console.log('selectedLibraryKey:', selectedLibraryKey);
        const libraries = await getAllSavedLibraries();
        const libraryCount = Object.keys(libraries).length;
        const status = await getStatus();
        console.log('Library count:', libraryCount);
        console.log('Current status:', status);
        let mode = 'selection';
        // Check stored status first
        if (status === 1) {
            mode = 'export';
            console.log('→ Export screen (user went to design system)');
        }
        else if (libraryCount === 0) {
            mode = 'link';
            console.log('→ Link screen (no libraries)');
        }
        else if (selectedLibraryKey) {
            mode = 'home';
            console.log('→ Home screen (library selected)');
        }
        else {
            mode = 'selection';
            console.log('→ Selection screen (no library selected)');
        }
        console.log(`Sending UI mode: ${mode}`);
        figma.ui.postMessage({
            type: 'ui-mode',
            mode: mode,
            fileName: (_a = figma.root.name) !== null && _a !== void 0 ? _a : 'Unknown Library'
        });
    }
    else if (msg.type === 'switch-mode') {
        // Resize based on mode
        if (msg.mode === 'export') {
            setScreenSize('EXPORT_SCREEN');
            await setStatus(1);
        }
        else if (msg.mode === 'link') {
            setScreenSize('LINK_SCREEN');
            await setStatus(0);
        }
        else if (msg.mode === 'selection') {
            setScreenSize('SELECTION_SCREEN');
            await setStatus(2);
        }
        else if (msg.mode === 'home') {
            setScreenSize('HOME_SCREEN');
            await setStatus(3);
        }
        else if (msg.mode === 'export-instructions') {
            setScreenSize('EXPORT_INSTRUCTIONS_SCREEN');
            await setStatus(4);
        }
        else if (msg.mode === 'validation-results') {
            setScreenSize('VALIDATION_RESULTS_SCREEN');
        }
        figma.ui.postMessage({
            type: 'ui-mode',
            mode: msg.mode || 'link',
            fileName: (_b = figma.root.name) !== null && _b !== void 0 ? _b : 'Unknown Library'
        });
    }
    else if (msg.type === 'export-keys') {
        await exportLibraryKeys();
    }
    else if (msg.type === 'get-saved-libraries') {
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
                    displayName: `${lib.libraryName} (${tokenCounts.textStyles} Text Styles, ${tokenCounts.colors} Colors, ${tokenCounts.spacing} Spacing, ${tokenCounts.cornerRadius} Corner Radius, ${tokenCounts.layerStyles} Layer Styles)`
                };
            })
        });
    }
    else if (msg.type === 'select-library') {
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
                fileName: (_c = figma.root.name) !== null && _c !== void 0 ? _c : 'Unknown Library'
            });
            // Calculate spacing variables count specifically
            console.log('Library variables structure:', library.variables);
            let spacingVariables = {};
            let spacingVariablesCount = 0;
            if (library.variables) {
                // Check if using new structure (organized by collection)
                if (library.variables.spacing) {
                    spacingVariables = library.variables.spacing;
                    spacingVariablesCount = Object.keys(spacingVariables).length;
                    console.log(`Found ${spacingVariablesCount} spacing variables (new format):`, spacingVariables);
                    // Log all variable IDs for debugging
                    console.log('📋 ALL SPACING VARIABLE IDs FROM JSON:');
                    for (const [name, data] of Object.entries(spacingVariables)) {
                        console.log(`  ${name}: ID="${data.id}", Key="${data.key}", Name="${data.name}"`);
                    }
                }
                else {
                    // Handle old structure (flat with collection names in keys)
                    const oldFormatSpacing = {};
                    for (const key in library.variables) {
                        if (key.toLowerCase().startsWith('spacing/')) {
                            const variableName = key.replace(/^spacing\//i, '');
                            oldFormatSpacing[variableName] = library.variables[key];
                        }
                    }
                    spacingVariables = oldFormatSpacing;
                    spacingVariablesCount = Object.keys(spacingVariables).length;
                    console.log(`Found ${spacingVariablesCount} spacing variables (old format):`, spacingVariables);
                    // Log all variable IDs for debugging
                    console.log('📋 ALL SPACING VARIABLE IDs FROM JSON (OLD FORMAT):');
                    for (const [name, data] of Object.entries(spacingVariables)) {
                        console.log(`  ${name}: ID="${data.id}", Key="${data.key}", Name="${data.name}"`);
                    }
                }
            }
            // Analyze library tokens for dynamic validation options
            const tokenCounts = analyzeLibraryTokens(library);
            // Then send library information
            figma.ui.postMessage({
                type: 'library-selected',
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
        }
        else {
            setScreenSize('SELECTION_SCREEN');
            await setStatus(2);
            figma.ui.postMessage({
                type: 'ui-mode',
                mode: 'selection',
                fileName: (_d = figma.root.name) !== null && _d !== void 0 ? _d : 'Unknown Library'
            });
        }
        figma.notify(`Selected library: ${(library === null || library === void 0 ? void 0 : library.libraryName) || 'None'}`);
    }
    else if (msg.type === 'create-text-style') {
        await createLocalTextStyle();
    }
    else if (msg.type === 'apply-text-style') {
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
            }
            else {
                // Apply style to current selection (legacy behavior)
                await applyStyleToSelection(styleName);
                figma.ui.postMessage({
                    type: 'applied',
                    ok: true,
                    styleName: styleName,
                    targetType: 'selection'
                });
            }
        }
        catch (e) {
            figma.ui.postMessage({
                type: 'applied',
                ok: false,
                error: String(e),
                nodeId: msg.nodeId,
                styleName: msg.styleName
            });
        }
    }
    else if (msg.type === 'apply-spacing-token') {
        console.log('🔧 Received apply-spacing-token message:', msg);
        try {
            const tokenName = msg.tokenName;
            console.log('Token name:', tokenName);
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
            }
            else {
                throw new Error('Node ID is required for spacing token application.');
            }
        }
        catch (e) {
            figma.ui.postMessage({
                type: 'applied',
                ok: false,
                error: String(e),
                nodeId: msg.nodeId,
                styleName: msg.tokenName
            });
        }
    }
    else if (msg.type === 'resize-ui') {
        if (msg.width && msg.height) {
            resizeUI(msg.width, msg.height);
        }
        else if (msg.sizeMode) {
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
    }
    else if (msg.type === 'clear-all-libraries') {
        await clearAllSavedLibraries();
        // Reset UI state and reload libraries
        selectedLibraryKey = null;
        await setStatus(0); // No JSON files
        setScreenSize('LINK_SCREEN');
        figma.ui.postMessage({
            type: 'libraries-cleared'
        });
    }
    else if (msg.type === 'user-going-to-design-system') {
        // Set status to indicate user is going to design system file
        await setStatus(1);
        console.log('Status: User going to design system file');
        figma.closePlugin();
    }
    else if (msg.type === 'cancel-export-instructions') {
        // Reset status to 0 and close plugin
        await setStatus(0);
        console.log('Status: Cancelled export instructions - reset to 0');
        figma.closePlugin();
    }
    else if (msg.type === 'get-text-styles') {
        if (selectedLibraryKey) {
            const library = await getSavedLibrary(selectedLibraryKey);
            if (library) {
                console.log(`Loading ${Object.keys(library.items).length} text styles...`);
                // Get detailed information for each text style
                const detailedStyles = {};
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
                                const textStyle = style;
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
                        }
                        catch (error) {
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
    }
    else if (msg.type === 'get-spacing-variables') {
        if (selectedLibraryKey) {
            const library = await getSavedLibrary(selectedLibraryKey);
            if (library && library.variables) {
                let spacingVariables = {};
                // Check if using new structure (organized by collection)
                if (library.variables.spacing) {
                    spacingVariables = library.variables.spacing;
                }
                else {
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
            }
            else {
                console.log('No spacing variables found in selected library');
                figma.ui.postMessage({
                    type: 'spacing-variables-data',
                    spacingVariables: {}
                });
            }
        }
    }
    else if (msg.type === 'get-colors') {
        if (selectedLibraryKey) {
            const library = await getSavedLibrary(selectedLibraryKey);
            if (library && library.variables) {
                let colorVariables = {};
                // Check if using new structure (organized by collection)
                if (library.variables.colors) {
                    colorVariables = library.variables.colors;
                }
                else {
                    // Handle old structure and search through all collections for color-related variables
                    for (const [collectionKey, variables] of Object.entries(library.variables)) {
                        const collectionName = collectionKey.toLowerCase();
                        // Check if this collection contains colors
                        if (collectionName.includes('color') || collectionName.includes('colour') ||
                            collectionName.includes('palette') || collectionName.includes('theme')) {
                            // Add all variables from this collection
                            Object.assign(colorVariables, variables);
                        }
                        else {
                            // Check individual variable names for color-related terms
                            for (const [varName, varData] of Object.entries(variables)) {
                                const name = varName.toLowerCase();
                                if (name.includes('color') || name.includes('colour')) {
                                    colorVariables[varName] = varData;
                                }
                            }
                        }
                    }
                }
                console.log(`Loading ${Object.keys(colorVariables).length} color variables...`);
                figma.ui.postMessage({
                    type: 'colors-data',
                    colors: colorVariables
                });
            }
            else {
                console.log('No color variables found in selected library');
                figma.ui.postMessage({
                    type: 'colors-data',
                    colors: {}
                });
            }
        }
    }
    else if (msg.type === 'get-corner-radius') {
        if (selectedLibraryKey) {
            const library = await getSavedLibrary(selectedLibraryKey);
            if (library && library.variables) {
                let cornerRadiusVariables = {};
                // Check if using new structure (organized by collection)
                if (library.variables['corner-radius'] || library.variables.cornerRadius) {
                    cornerRadiusVariables = library.variables['corner-radius'] || library.variables.cornerRadius;
                }
                else {
                    // Handle old structure and search through all collections for corner radius-related variables
                    for (const [collectionKey, variables] of Object.entries(library.variables)) {
                        const collectionName = collectionKey.toLowerCase();
                        // Check if this collection contains corner radius
                        if (collectionName.includes('radius') || collectionName.includes('corner') ||
                            collectionName.includes('border-radius') || collectionName.includes('rounded')) {
                            // Add all variables from this collection
                            Object.assign(cornerRadiusVariables, variables);
                        }
                        else {
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
                console.log(`Loading ${Object.keys(cornerRadiusVariables).length} corner radius variables...`);
                figma.ui.postMessage({
                    type: 'corner-radius-data',
                    cornerRadius: cornerRadiusVariables
                });
            }
            else {
                console.log('No corner radius variables found in selected library');
                figma.ui.postMessage({
                    type: 'corner-radius-data',
                    cornerRadius: {}
                });
            }
        }
    }
    else if (msg.type === 'run-validation') {
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
            let targetNode;
            let targetName;
            if (selection.length === 0) {
                // No selection - validate the entire current page
                targetNode = figma.currentPage;
                targetName = `entire page "${figma.currentPage.name}"`;
                console.log(`No selection found, validating entire page: ${figma.currentPage.name}`);
                figma.notify(`Validating entire page: ${figma.currentPage.name}`);
            }
            else {
                const selectedNode = selection[0];
                if (selectedNode.type === 'FRAME') {
                    // Frame selected - validate the frame
                    targetNode = selectedNode;
                    targetName = `frame "${selectedNode.name}"`;
                    console.log(`Validating selected frame: ${selectedNode.name}`);
                }
                else {
                    // Other node type selected - validate the entire page
                    targetNode = figma.currentPage;
                    targetName = `entire page "${figma.currentPage.name}" (non-frame selected)`;
                    console.log(`Non-frame selected, validating entire page: ${figma.currentPage.name}`);
                    figma.notify(`Non-frame selected, validating entire page: ${figma.currentPage.name}`);
                }
            }
            // Run validation with timeout
            const validationPromise = runValidation(targetNode, library, msg.options, targetName);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Validation timeout')), 30000));
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
                targetType: targetNode.type === 'PAGE' ? 'page' : 'frame',
                options: msg.options
            });
            console.log('Validation completed successfully');
        }
        catch (error) {
            console.error('Validation error:', error);
            figma.notify('Validation failed. Please try again.', { error: true });
            // Send error to UI
            figma.ui.postMessage({
                type: 'validation-error',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    else if (msg.type === 'back-to-validation') {
        // Resize back to home screen
        setScreenSize('HOME_SCREEN');
        console.log('Resized UI back to home screen');
    }
    else if (msg.type === 'select-node') {
        if (msg.nodeId) {
            try {
                const node = await figma.getNodeByIdAsync(msg.nodeId);
                if (node) {
                    figma.currentPage.selection = [node];
                    figma.viewport.scrollAndZoomIntoView([node]);
                    figma.notify(`Selected ${node.name}`);
                }
                else {
                    figma.notify('Node not found', { error: true });
                }
            }
            catch (error) {
                console.error('Error selecting node:', error);
                figma.notify('Error selecting node', { error: true });
            }
        }
    }
    else if (msg.type === 'enable-selection-tracking') {
        isSelectionTrackingEnabled = true;
        console.log('Selection tracking enabled');
    }
    else if (msg.type === 'disable-selection-tracking') {
        isSelectionTrackingEnabled = false;
        console.log('Selection tracking disabled');
    }
    else if (msg.type === 'close-plugin') {
        figma.closePlugin();
    }
};
// Track whether selection tracking is enabled
let isSelectionTrackingEnabled = false;
// Listen for selection changes and notify UI (only when enabled)
figma.on('selectionchange', () => {
    if (!isSelectionTrackingEnabled)
        return;
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

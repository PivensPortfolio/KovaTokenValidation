"use strict";
// Main plugin: uses saved library keys to apply external text styles
// Start with fixed loader size
figma.showUI(__html__, { width: 380, height: 530 });
// UI sizing functions for different states
function resizeUI(width, height) {
    figma.ui.resize(width, height);
}
// UI sizes for different screens
const UISizes = {
    EXPORT_SCREEN: { width: 380, height: 530 },
    LINK_SCREEN: { width: 380, height: 530 },
    SELECTION_SCREEN: { width: 400, height: 400 },
    HOME_SCREEN: { width: 400, height: 900 },
    EXPORT_INSTRUCTIONS_SCREEN: { width: 400, height: 500 },
    EXPORT_CONFIRMATION_SCREEN: { width: 400, height: 550 },
    VALIDATION_RESULTS_SCREEN: { width: 1100, height: 700 },
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
async function applyCornerRadiusTokenToNode(tokenName, nodeId) {
    var _a, _b;
    console.log('🎯 applyCornerRadiusTokenToNode called with:', { tokenName, nodeId, selectedLibraryKey });
    if (!selectedLibraryKey) {
        throw new Error('Please select a library first.');
    }
    try {
        const library = await getSavedLibrary(selectedLibraryKey);
        if (!library) {
            throw new Error('Selected library not found.');
        }
        // Get corner radius token data from stored library
        let cornerRadiusVariables = {};
        if (((_a = library.variables) === null || _a === void 0 ? void 0 : _a['corner-radius']) || ((_b = library.variables) === null || _b === void 0 ? void 0 : _b.cornerRadius)) {
            cornerRadiusVariables = library.variables['corner-radius'] || library.variables.cornerRadius;
        }
        else if (library.variables) {
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
        console.log(`Looking for corner radius token: "${tokenName}"`);
        console.log('Available corner radius variables:', Object.keys(cornerRadiusVariables));
        let tokenData = cornerRadiusVariables[tokenName];
        // Try common variations if not found
        if (!tokenData || !tokenData.key) {
            const possibleKeys = [
                tokenName,
                `radius-${tokenName}`,
                `corner-${tokenName}`,
                `${tokenName}px`,
                `radius/${tokenName}`,
                `corner/${tokenName}`
            ];
            for (const key of possibleKeys) {
                if (cornerRadiusVariables[key] && cornerRadiusVariables[key].key) {
                    console.log(`Found corner radius token with key: "${key}"`);
                    tokenData = cornerRadiusVariables[key];
                    break;
                }
            }
            // Try finding by variable name
            if (!tokenData || !tokenData.key) {
                for (const [key, data] of Object.entries(cornerRadiusVariables)) {
                    if (data && data.name && (data.name === tokenName ||
                        data.name.endsWith(`-${tokenName}`) ||
                        data.name.endsWith(`/${tokenName}`) ||
                        data.name.includes(tokenName))) {
                        console.log(`Found corner radius token by name match: "${key}" -> "${data.name}"`);
                        tokenData = data;
                        break;
                    }
                }
            }
        }
        if (!tokenData || !tokenData.key) {
            const availableTokens = Object.keys(cornerRadiusVariables).join(', ');
            throw new Error(`Corner radius token "${tokenName}" not found in library. Available tokens: ${availableTokens}`);
        }
        console.log(`Found tokenData:`, { name: tokenData.name, key: tokenData.key, collection: tokenData.collection });
        // Import the variable using the proper Team Library API
        let importedVariable;
        try {
            // Try to import by key directly if we have it
            if (tokenData.key) {
                console.log(`🔄 Importing corner radius variable by key: ${tokenData.key}`);
                importedVariable = await figma.variables.importVariableByKeyAsync(tokenData.key);
                console.log(`✅ Successfully imported corner radius variable: "${importedVariable.name}" (ID: ${importedVariable.id})`);
            }
            else {
                // Fallback: use the helper function to find and import by name
                console.log(`🔄 Importing corner radius variable by name using Team Library API: ${tokenData.name}`);
                importedVariable = await ensureVariableImportedByName(c => c.name.toLowerCase().includes('radius') || c.name.toLowerCase().includes('corner'), tokenData.name, 'FLOAT');
                console.log(`✅ Successfully imported corner radius variable via Team Library: "${importedVariable.name}" (ID: ${importedVariable.id})`);
            }
        }
        catch (importError) {
            console.error('❌ Failed to import corner radius variable:', importError);
            throw new Error(`Cannot import corner radius token "${tokenName}". Please ensure the design system library is enabled in the Variables panel. Error: ${importError}`);
        }
        // Get the node and apply the corner radius
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node) {
            throw new Error('Node not found.');
        }
        // Apply corner radius based on node type
        if (node.type === 'FRAME' || node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
            const shapeNode = node;
            let applied = false;
            try {
                // Try individual corner properties (this is the correct approach for Figma API)
                const corners = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
                let cornersBound = 0;
                for (const corner of corners) {
                    if (corner in shapeNode) {
                        try {
                            shapeNode.setBoundVariable(corner, importedVariable);
                            cornersBound++;
                            console.log(`✅ Successfully bound ${corner} to variable`);
                        }
                        catch (cornerError) {
                            console.error(`Failed to bind variable to ${corner}:`, cornerError);
                        }
                    }
                }
                if (cornersBound > 0) {
                    figma.notify(`Applied corner radius token "${tokenName}" to ${cornersBound} corners of "${shapeNode.name}".`);
                    applied = true;
                }
                else {
                    console.log('No corner radius properties found or bindable on this node');
                }
            }
            catch (bindError) {
                console.error('Failed to bind corner radius variable:', bindError);
            }
            if (!applied) {
                throw new Error(`Cannot apply corner radius to node "${node.name}" - no applicable corner radius properties found or variable binding failed.`);
            }
        }
        else {
            throw new Error(`Cannot apply corner radius to node type "${node.type}". Only frames, rectangles, and ellipses support corner radius.`);
        }
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        figma.notify(errorMsg, { error: true });
        throw error;
    }
}
async function applyCornerRadiusTokensToNode(cornerTokens, nodeId) {
    var _a, _b;
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
        let cornerRadiusVariables = {};
        if (((_a = library.variables) === null || _a === void 0 ? void 0 : _a['corner-radius']) || ((_b = library.variables) === null || _b === void 0 ? void 0 : _b.cornerRadius)) {
            cornerRadiusVariables = library.variables['corner-radius'] || library.variables.cornerRadius;
        }
        else if (library.variables) {
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
        console.log('Available corner radius variables:', Object.keys(cornerRadiusVariables));
        // Get the node
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node) {
            throw new Error('Node not found.');
        }
        // Apply corner radius based on node type
        if (node.type === 'FRAME' || node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
            const shapeNode = node;
            let appliedCount = 0;
            const appliedCorners = [];
            // Map corner names to Figma property names
            const cornerPropertyMap = {
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
                    shapeNode.setBoundVariable(figmaProperty, importedVariable);
                    appliedCount++;
                    appliedCorners.push(corner);
                    console.log(`✅ Successfully bound ${figmaProperty} to variable`);
                }
                catch (error) {
                    console.error(`Failed to apply ${corner}:`, error);
                }
            }
            if (appliedCount > 0) {
                figma.notify(`Applied corner radius tokens to ${appliedCount} corner${appliedCount > 1 ? 's' : ''} of "${shapeNode.name}".`);
            }
            else {
                throw new Error(`Cannot apply corner radius tokens to node "${node.name}" - no tokens were successfully applied.`);
            }
        }
        else {
            throw new Error(`Cannot apply corner radius to node type "${node.type}". Only frames, rectangles, and ellipses support corner radius.`);
        }
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        figma.notify(errorMsg, { error: true });
        throw error;
    }
}
async function applyHardcodedCornerRadius(nodeId, corner, value) {
    console.log('🎯 applyHardcodedCornerRadius called with:', { nodeId, corner, value });
    try {
        // Get the node
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node) {
            throw new Error('Node not found.');
        }
        // Apply corner radius based on node type
        if (node.type === 'FRAME' || node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
            const shapeNode = node;
            // Map corner names to Figma property names
            const cornerPropertyMap = {
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
            shapeNode[figmaProperty] = value;
            console.log(`✅ Successfully set ${figmaProperty} to ${value} on "${shapeNode.name}"`);
            figma.notify(`Set ${corner} corner radius to ${value} on "${shapeNode.name}".`);
        }
        else {
            throw new Error(`Cannot apply corner radius to node type "${node.type}". Only frames, rectangles, and ellipses support corner radius.`);
        }
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        figma.notify(errorMsg, { error: true });
        throw error;
    }
}
async function applyColorTokenToNode(tokenName, nodeId) {
    var _a, _b;
    console.log('🎯 applyColorTokenToNode called with:', { tokenName, nodeId, selectedLibraryKey });
    if (!selectedLibraryKey) {
        throw new Error('Please select a library first.');
    }
    try {
        const library = await getSavedLibrary(selectedLibraryKey);
        if (!library) {
            throw new Error('Selected library not found.');
        }
        // Get color token data from stored library
        let colorVariables = {};
        if (((_a = library.variables) === null || _a === void 0 ? void 0 : _a.colors) || ((_b = library.variables) === null || _b === void 0 ? void 0 : _b.color)) {
            colorVariables = library.variables.colors || library.variables.color;
        }
        else if (library.variables) {
            // Handle old structure and search through all collections for color-related variables
            for (const [collectionKey, variables] of Object.entries(library.variables)) {
                const collectionName = collectionKey.toLowerCase();
                // Check if this collection contains colors
                if (collectionName.includes('color') || collectionName.includes('colour') ||
                    collectionName === 'colors' || collectionName === 'colours') {
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
        console.log(`Looking for color token: "${tokenName}"`);
        console.log('Available color variables:', Object.keys(colorVariables));
        let tokenData = colorVariables[tokenName];
        // Try common variations if not found
        if (!tokenData || !tokenData.key) {
            const possibleKeys = [
                tokenName,
                `color-${tokenName}`,
                `${tokenName}-color`,
                `colors/${tokenName}`,
                `color/${tokenName}`
            ];
            for (const key of possibleKeys) {
                if (colorVariables[key] && colorVariables[key].key) {
                    console.log(`Found color token with key: "${key}"`);
                    tokenData = colorVariables[key];
                    break;
                }
            }
            // Try finding by variable name
            if (!tokenData || !tokenData.key) {
                for (const [key, data] of Object.entries(colorVariables)) {
                    if (data && data.name && (data.name === tokenName ||
                        data.name.endsWith(`-${tokenName}`) ||
                        data.name.endsWith(`/${tokenName}`) ||
                        data.name.includes(tokenName))) {
                        console.log(`Found color token by name match: "${key}" -> "${data.name}"`);
                        tokenData = data;
                        break;
                    }
                }
            }
        }
        if (!tokenData || !tokenData.key) {
            const availableTokens = Object.keys(colorVariables).join(', ');
            throw new Error(`Color token "${tokenName}" not found in library. Available tokens: ${availableTokens}`);
        }
        console.log(`Found tokenData:`, { name: tokenData.name, key: tokenData.key, collection: tokenData.collection });
        // Import the variable using the proper Team Library API
        let importedVariable;
        try {
            // Try to import by key directly if we have it
            if (tokenData.key) {
                console.log(`🔄 Importing color variable by key: ${tokenData.key}`);
                importedVariable = await figma.variables.importVariableByKeyAsync(tokenData.key);
                console.log(`✅ Successfully imported color variable: "${importedVariable.name}" (ID: ${importedVariable.id})`);
            }
            else {
                // Fallback: use the helper function to find and import by name
                console.log(`🔄 Importing color variable by name using Team Library API: ${tokenData.name}`);
                importedVariable = await ensureVariableImportedByName(c => c.name.toLowerCase().includes('color') || c.name.toLowerCase().includes('colour'), tokenData.name, 'COLOR');
                console.log(`✅ Successfully imported color variable via Team Library: "${importedVariable.name}" (ID: ${importedVariable.id})`);
            }
        }
        catch (importError) {
            console.error('❌ Failed to import color variable:', importError);
            throw new Error(`Cannot import color token "${tokenName}". Please ensure the design system library is enabled in the Variables panel. Error: ${importError}`);
        }
        // Get the node and apply the color
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node) {
            throw new Error('Node not found.');
        }
        // Apply color based on node type and properties
        let applied = false;
        try {
            // Try to bind to fill color (most common)
            if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
                const nodeWithFills = node;
                console.log(`🔗 Binding variable to fill color`);
                // Clone the fills array and bind variable to the first paint
                const newFills = [...nodeWithFills.fills];
                if (newFills[0] && newFills[0].type === 'SOLID') {
                    // Create a new paint with the variable bound using proper VariableAlias structure
                    const newPaint = Object.assign(Object.assign({}, newFills[0]), { boundVariables: {
                            color: {
                                type: 'VARIABLE_ALIAS',
                                id: importedVariable.id
                            }
                        } });
                    newFills[0] = newPaint;
                    nodeWithFills.fills = newFills;
                    figma.notify(`Applied color token "${tokenName}" as fill to "${node.name}".`);
                    applied = true;
                }
            }
        }
        catch (fillError) {
            console.error('Failed to bind variable to fill:', fillError);
            // Fallback: try stroke color
            try {
                if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
                    const nodeWithStrokes = node;
                    console.log(`🔗 Binding variable to stroke color`);
                    // Clone the strokes array and bind variable to the first paint
                    const newStrokes = [...nodeWithStrokes.strokes];
                    if (newStrokes[0] && newStrokes[0].type === 'SOLID') {
                        // Create a new paint with the variable bound using proper VariableAlias structure
                        const newPaint = Object.assign(Object.assign({}, newStrokes[0]), { boundVariables: {
                                color: {
                                    type: 'VARIABLE_ALIAS',
                                    id: importedVariable.id
                                }
                            } });
                        newStrokes[0] = newPaint;
                        nodeWithStrokes.strokes = newStrokes;
                        figma.notify(`Applied color token "${tokenName}" as stroke to "${node.name}".`);
                        applied = true;
                    }
                }
            }
            catch (strokeError) {
                console.error('Failed to bind variable to stroke:', strokeError);
            }
        }
        if (!applied) {
            throw new Error(`Cannot apply color to node "${node.name}" - no applicable color properties found or variable binding failed.`);
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
                                issue: `Hardcoded padding (${paddingValue}px)`,
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
                                issue: `Hardcoded gap (${gapValue}px)`,
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
            // Corner radius validation
            if (options.cornerRadius && (node.type === 'FRAME' || node.type === 'RECTANGLE' || node.type === 'ELLIPSE')) {
                const shapeNode = node;
                console.log(`Checking corner radius for node: "${shapeNode.name}" (${shapeNode.type})`);
                try {
                    // Check all individual corner radius properties
                    const corners = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
                    const cornerIssues = [];
                    const cornerValues = {};
                    for (const corner of corners) {
                        if (corner in shapeNode) {
                            const radiusValue = shapeNode[corner];
                            const boundVariables = shapeNode.boundVariables;
                            const isCornerBound = boundVariables && boundVariables[corner] !== undefined && boundVariables[corner] !== null;
                            // Always include the corner value and token status in cornerValues (for UI display)
                            if (typeof radiusValue === 'number' && radiusValue >= 0) {
                                cornerValues[corner] = {
                                    value: radiusValue,
                                    hasToken: isCornerBound // Only true if actually bound to a token
                                };
                            }
                            else {
                                cornerValues[corner] = {
                                    value: null,
                                    hasToken: false
                                };
                            }
                            // Only add to issues if it has a value but is not bound to a token
                            if (typeof radiusValue === 'number' && radiusValue > 0 && !isCornerBound) {
                                console.log(`Found unbound corner radius: ${corner} = ${radiusValue}px on "${shapeNode.name}"`);
                                cornerIssues.push({
                                    corner: corner,
                                    value: radiusValue
                                });
                            }
                        }
                    }
                    // If we found corner radius issues, create a single consolidated result
                    if (cornerIssues.length > 0) {
                        console.log(`Adding consolidated corner radius issue for "${shapeNode.name}" (ID: ${shapeNode.id}) with ${cornerIssues.length} corners`);
                        console.log(`Corner issues:`, cornerIssues);
                        console.log(`All corner values:`, cornerValues);
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
                }
                catch (error) {
                    console.log(`Error checking corner radius for "${shapeNode.name}":`, error);
                }
            }
            // Color validation
            if (options.colors) {
                console.log(`Checking colors for node: "${node.name}" (${node.type})`);
                try {
                    // Check fill colors for nodes that support fills (excluding TEXT nodes - they're handled separately)
                    if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0 && node.type !== 'TEXT') {
                        const nodeWithFills = node;
                        for (let i = 0; i < nodeWithFills.fills.length; i++) {
                            const fill = nodeWithFills.fills[i];
                            if (fill && fill.type === 'SOLID' && fill.visible !== false) {
                                // Check if this fill is bound to a variable
                                const boundVariables = nodeWithFills.boundVariables;
                                const fillBoundVariable = boundVariables && boundVariables.fills && boundVariables.fills[i];
                                if (!fillBoundVariable) {
                                    console.log(`Adding fill color issue for "${node.name}"`);
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
                                else {
                                    console.log(`Fill color is properly bound to token for "${node.name}"`);
                                }
                            }
                        }
                    }
                    // Check stroke colors for nodes that support strokes
                    if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
                        const nodeWithStrokes = node;
                        for (let i = 0; i < nodeWithStrokes.strokes.length; i++) {
                            const stroke = nodeWithStrokes.strokes[i];
                            if (stroke && stroke.type === 'SOLID' && stroke.visible !== false) {
                                // Check if this stroke is bound to a variable
                                const boundVariables = nodeWithStrokes.boundVariables;
                                const strokeBoundVariable = boundVariables && boundVariables.strokes && boundVariables.strokes[i];
                                if (!strokeBoundVariable) {
                                    console.log(`Adding stroke color issue for "${node.name}"`);
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
                                else {
                                    console.log(`Stroke color is properly bound to token for "${node.name}"`);
                                }
                            }
                        }
                    }
                    // Check text color for text nodes
                    if (node.type === 'TEXT') {
                        const textNode = node;
                        // Check if text color is bound to a variable
                        const boundVariables = textNode.boundVariables;
                        const textColorBound = boundVariables && boundVariables.fills;
                        if (!textColorBound && textNode.fills && Array.isArray(textNode.fills) && textNode.fills.length > 0) {
                            const fill = textNode.fills[0];
                            if (fill && fill.type === 'SOLID' && fill.visible !== false) {
                                console.log(`Adding text color issue for "${node.name}"`);
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
                        else if (textColorBound) {
                            console.log(`Text color is properly bound to token for "${node.name}"`);
                        }
                    }
                }
                catch (error) {
                    console.log(`Error checking colors for "${node.name}":`, error);
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
        // Debug: Log corner radius results
        const cornerRadiusResults = results.filter(r => r.type === 'corner-radius');
        console.log(`Corner radius results (${cornerRadiusResults.length}):`, cornerRadiusResults.map(r => ({
            frameName: r.frameName,
            nodeId: r.node.id,
            cornerCount: r.cornerCount,
            cornerValues: r.cornerValues
        })));
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
        // Resize based on mode
        if (mode === 'export') {
            setScreenSize('EXPORT_SCREEN');
        }
        else if (mode === 'link') {
            setScreenSize('LINK_SCREEN');
        }
        else if (mode === 'selection') {
            setScreenSize('SELECTION_SCREEN');
        }
        else if (mode === 'home') {
            setScreenSize('HOME_SCREEN');
        }
        else if (mode === 'export-instructions') {
            setScreenSize('EXPORT_INSTRUCTIONS_SCREEN');
        }
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
        else if (msg.mode === 'export-confirmation') {
            setScreenSize('EXPORT_CONFIRMATION_SCREEN');
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
                    displayName: `<strong>${lib.libraryName}</strong><br>(${tokenCounts.textStyles} Text Styles, ${tokenCounts.colors} Colors, ${tokenCounts.spacing} Spacing, ${tokenCounts.cornerRadius} Corner Radius, ${tokenCounts.layerStyles} Layer Styles)`
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
    else if (msg.type === 'apply-corner-radius-token') {
        console.log('🔧 Received apply-corner-radius-token message:', msg);
        try {
            const tokenName = msg.tokenName;
            console.log('Corner radius token name:', tokenName);
            if (!tokenName) {
                throw new Error('Token name is required.');
            }
            if (msg.nodeId) {
                // Apply corner radius token to specific node
                await applyCornerRadiusTokenToNode(tokenName, msg.nodeId);
                figma.ui.postMessage({
                    type: 'applied',
                    ok: true,
                    nodeId: msg.nodeId,
                    styleName: tokenName, // Use tokenName as styleName for consistency with UI
                    targetType: 'node'
                });
            }
            else {
                throw new Error('Node ID is required for corner radius token application.');
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
    else if (msg.type === 'apply-corner-radius-tokens') {
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
            }
            else {
                throw new Error('Node ID is required for corner radius tokens application.');
            }
        }
        catch (e) {
            figma.ui.postMessage({
                type: 'applied',
                ok: false,
                error: String(e),
                nodeId: msg.nodeId,
                styleName: 'corner radius tokens'
            });
        }
    }
    else if (msg.type === 'apply-hardcoded-corner-radius') {
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
        }
        catch (e) {
            figma.ui.postMessage({
                type: 'applied',
                ok: false,
                error: String(e),
                nodeId: msg.nodeId,
                styleName: 'hardcoded corner radius'
            });
        }
    }
    else if (msg.type === 'apply-color-token') {
        console.log('🔧 Received apply-color-token message:', msg);
        try {
            const tokenName = msg.tokenName;
            console.log('Color token name:', tokenName);
            if (!tokenName) {
                throw new Error('Token name is required.');
            }
            if (msg.nodeId) {
                // Apply color token to specific node
                await applyColorTokenToNode(tokenName, msg.nodeId);
                figma.ui.postMessage({
                    type: 'applied',
                    ok: true,
                    nodeId: msg.nodeId,
                    styleName: tokenName, // Use tokenName as styleName for consistency with UI
                    targetType: 'node'
                });
            }
            else {
                throw new Error('Node ID is required for color token application.');
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

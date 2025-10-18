// Utility script to extract design tokens from Figma client storage
// This can be run in the Figma plugin console or added to the plugin code

async function extractDesignTokens() {
    try {
        // Get all saved libraries from Figma client storage
        const savedLibraries = await figma.clientStorage.getAsync('savedLibraries') || {};

        console.log('=== SAVED DESIGN SYSTEMS ===');
        console.log(`Found ${Object.keys(savedLibraries).length} design systems:`);

        // Iterate through each saved library
        for (const [libraryKey, library] of Object.entries(savedLibraries)) {
            console.log(`\n--- ${library.libraryName} ---`);
            console.log(`Library Key: ${libraryKey}`);
            console.log(`Generated: ${library.generatedAt}`);
            console.log(`Version: ${library.version}`);

            // Count text styles
            const textStyleCount = Object.keys(library.items || {}).length;
            console.log(`Text Styles: ${textStyleCount}`);

            // Count variables by collection
            let totalVariables = 0;
            const variablesByCollection = {};

            if (library.variables) {
                for (const [collectionKey, variables] of Object.entries(library.variables)) {
                    const count = Object.keys(variables).length;
                    variablesByCollection[collectionKey] = count;
                    totalVariables += count;
                }
            }

            console.log(`Total Variables: ${totalVariables}`);
            console.log('Variables by Collection:', variablesByCollection);

            // Check if this is the Redprint Atoms library
            if (library.libraryName.includes('Redprint') || textStyleCount === 15) {
                console.log('\n🎯 REDPRINT ATOMS DATA FOUND!');
                console.log('Full JSON structure:');
                console.log(JSON.stringify(library, null, 2));

                // Export to a downloadable format
                return {
                    libraryName: library.libraryName,
                    textStyles: library.items,
                    variables: library.variables,
                    metadata: {
                        generatedAt: library.generatedAt,
                        version: library.version,
                        textStyleCount: textStyleCount,
                        totalVariables: totalVariables,
                        variablesByCollection: variablesByCollection
                    }
                };
            }
        }

        // If no Redprint found, return all libraries
        return savedLibraries;

    } catch (error) {
        console.error('Error extracting design tokens:', error);
        return null;
    }
}

// Function to save extracted data as JSON file (for use in plugin)
async function saveTokensAsJSON() {
    const tokens = await extractDesignTokens();
    if (tokens) {
        // In a real plugin, you could use figma.ui.postMessage to send this to the UI
        // and then download it as a file
        console.log('Extracted tokens ready for export:', tokens);
        return tokens;
    }
}

// Export functions for use in plugin
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractDesignTokens, saveTokensAsJSON };
}
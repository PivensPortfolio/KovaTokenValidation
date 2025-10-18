# Variable Binding Fix - Team Library Integration

## Problem
The plugin was failing to bind library variables because it was trying to use stored variable IDs directly. Library variables are not part of the document graph until imported, so `getVariableByIdAsync()` fails and `setBoundVariable()` throws errors.

## Solution
Implemented the proper Team Library API workflow:

### 1. Added Team Library Permission
- Updated `manifest.json` to include `"permissions": ["teamlibrary"]`
- This enables access to `figma.teamLibrary.*` APIs

### 2. Refactored Variable Import Logic
- Created `ensureVariableImportedByName()` helper function
- Uses `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()` to find enabled libraries
- Uses `figma.teamLibrary.getVariablesInLibraryCollectionAsync()` to query library variables
- Uses `figma.variables.importVariableByKeyAsync()` to import variables by key

### 3. Updated Export Function
- Modified variable export to prioritize `variable.key` over `variable.id`
- Keys are stable across library publishes, IDs are file-scoped
- Added `collectionKey` for better organization

### 4. Improved Error Handling
- Clear error messages when library not enabled
- Fallback strategies for finding variables by name variations
- Proper validation of variable types and scopes

## Key Changes

### Before (Broken)
```typescript
// This fails because library variable IDs don't exist in current file
containerNode.setBoundVariable('itemSpacing', { type: 'VARIABLE_ALIAS', id: tokenData.id });
```

### After (Working)
```typescript
// Import variable by key first, then bind
const importedVariable = await figma.variables.importVariableByKeyAsync(tokenData.key);
containerNode.setBoundVariable('itemSpacing', importedVariable);
```

## Requirements for Users
1. **Library must be enabled**: Users need to enable the design system library in the Variables panel
2. **Plugin permission**: The plugin now requires team library access
3. **Re-export needed**: Existing exported libraries should be re-exported to get variable keys

## Benefits
- ✅ Reliable variable binding across files
- ✅ Works with published team libraries
- ✅ Proper error messages guide users
- ✅ Follows Figma's recommended patterns
- ✅ Future-proof with stable keys

## Testing
The plugin now properly handles the complete workflow:
1. Find library collection by name/criteria
2. Query variables in that collection
3. Import variable by key into current file
4. Bind imported variable to node properties

This eliminates the "variable not found" errors and enables consistent design token application across team files.
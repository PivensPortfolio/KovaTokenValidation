---
inclusion: always
---

# Figma Variable Binding Architecture

This document explains how the Figma plugin handles library variable binding using the Team Library API. Reference this when debugging or extending variable functionality.

## Core Problem & Solution

**Problem**: Library variables cannot be bound directly by ID because they don't exist in the current file's document graph until imported.

**Solution**: Use Team Library API to import variables by key, then bind the imported reference.

## Required Setup

### 1. Manifest Permissions
```json
{
  "permissions": ["teamlibrary"]
}
```

### 2. Variable Export Structure
Variables are exported with stable keys:
```typescript
variablesMap[collectionKey][variable.name] = {
  key: variable.key,        // CRITICAL: Stable across publishes
  id: variable.id,          // File-scoped, for backward compatibility
  name: variable.name,
  collection: collectionName,
  collectionKey: collectionKey,
  type: variable.resolvedType,
  scopes: variable.scopes,
  values: variable.valuesByMode
};
```

## Working Implementation

### Variable Lookup Strategy
The plugin uses a multi-approach strategy to find variables:

```typescript
// Approach 1: Try local variable by ID (same file)
if (tokenData.id) {
  const localVariable = await figma.variables.getVariableByIdAsync(tokenData.id);
  if (localVariable) return localVariable;
}

// Approach 2: Try local variable by name (same file fallback)
const allLocalVariables = await figma.variables.getLocalVariablesAsync();
const matchingVariable = allLocalVariables.find(v => v.name === tokenName);
if (matchingVariable) return matchingVariable;

// Approach 3: Import by key (cross-file via Team Library)
return await figma.variables.importVariableByKeyAsync(tokenData.key);
```

### Import Function
```typescript
async function ensureVariableImportedByName(
  collectionMatch: (c: any) => boolean,
  variableName: string,
  type: VariableResolvedDataType = 'FLOAT'
): Promise<Variable> {
  const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  const targetCollection = collections.find(collectionMatch);
  
  if (!targetCollection) {
    throw new Error('Target library collection not enabled');
  }

  const libVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(targetCollection.key);
  const libVar = libVars.find(v => v.name === variableName && v.resolvedType === type);
  
  if (!libVar) {
    throw new Error(`Variable "${variableName}" not found in library`);
  }

  return await figma.variables.importVariableByKeyAsync(libVar.key);
}
```

### Binding Workflow
```typescript
// 1. Import variable by key
const importedVariable = await figma.variables.importVariableByKeyAsync(tokenData.key);

// 2. Bind to node property
containerNode.setBoundVariable('itemSpacing', importedVariable);
```

## Key APIs Used

### Team Library APIs
- `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()` - Get enabled libraries
- `figma.teamLibrary.getVariablesInLibraryCollectionAsync(key)` - Query library variables
- `figma.variables.importVariableByKeyAsync(key)` - Import variable by stable key

### Variable Binding
- `node.setBoundVariable(property, variable)` - Bind imported variable to property

## Common Issues & Solutions

### "Variable not found" Error
**Cause**: Trying to bind by ID before importing
**Solution**: Always import by key first

### "Library collection not enabled" Error  
**Cause**: User hasn't enabled design system in Variables panel
**Solution**: Guide user to enable library in Figma UI

### "Team Library API not available" Error
**Cause**: Missing teamlibrary permission
**Solution**: Add to manifest.json permissions array

### Plugin Stops Working After Code Changes
**Cause**: Figma doesn't hot-reload plugin code changes
**Solution**: **RESTART FIGMA** - This is the most common fix for plugin issues

### "Could not find variable with key" Error
**Cause**: Multiple possible issues:
1. Variables not published to Team Library
2. Library not enabled in current file
3. Stale cached data in plugin storage
**Solutions**:
1. Check Variables panel → Enable design system library
2. Restart Figma to clear plugin cache
3. Use "Reset Libraries" button to clear stored data

### "Found 0 local variables" Error
**Cause**: Testing in wrong file or variables not accessible
**Solutions**:
1. Test in the same file where variables were exported
2. Enable Team Library access in Variables panel
3. Verify variables exist with "DEBUG: Check Available Variables" button

## Supported Properties

### Auto Layout Frames
- `itemSpacing` - Gap between items
- `paddingLeft/Right/Top/Bottom` - Internal padding

### Requirements
- Variable must have `FLOAT` type
- Variable scopes should include target property
- Node must support the property (e.g., auto layout for itemSpacing)

## Testing Workflow

1. **Export from design system**: Captures variable keys
2. **Enable library in working file**: Makes variables accessible via Team Library API
3. **Apply tokens**: Plugin imports by key and binds successfully

## Troubleshooting Checklist

When variable binding fails, try these steps **in order**:

### 1. 🔄 Restart Figma First
- **Most common fix** - Figma needs restart after plugin code changes
- Close Figma completely and reopen
- Test variable binding again

### 2. 🔍 Debug Available Variables
- Use "DEBUG: Check Available Variables" button
- Verify variables exist and are accessible
- Check console for detailed variable information

### 3. 📦 Check Storage State
- Use "DEBUG: Check Storage State" button
- Verify library data was exported correctly
- Look for fresh timestamps and variable keys

### 4. 🔗 Verify Library Connection
- Open Variables panel (⌘ + Option + V)
- Check if design system library is enabled
- Enable library if not already active

### 5. 🧹 Clear Plugin Data
- Use "Reset Libraries" button to clear cached data
- Re-export from design system
- Test again with fresh data

### 6. 📍 Check File Context
- Verify you're in the correct file
- Same-file: Variables should be found locally
- Cross-file: Library must be enabled in Variables panel

## Success Indicators

When working correctly, you'll see logs like:
```
✅ Successfully imported variable: "12" (ID: VariableID:...)
🔗 Binding variable to itemSpacing
```

## File Structure

- `code.ts` - Main plugin logic with `applySpacingTokenToNode()`
- `manifest.json` - Must include teamlibrary permission
- `ui.html` - User interface for token selection
- `extract-tokens.js` - Utility for extracting design tokens

## Dynamic Validation Options

The plugin now generates validation options dynamically based on available tokens in the selected library:

### Token Categories
- **Text Styles** 🔤 - Published text styles from design system
- **Colors** 🎨 - Color variables and tokens
- **Spacing** 📏 - Spacing, padding, margin, gap variables
- **Corner Radius** ⭕ - Border radius and corner variables
- **Layer Styles** 🎭 - Layer effects and styles (future)

### Implementation
```typescript
function analyzeLibraryTokens(lib: SavedLibrary) {
  // Categorizes variables by collection name and individual variable names
  // Returns counts for each token type
}
```

### UI Generation
```javascript
function generateValidationOptions(tokenCounts) {
  // Dynamically creates checkbox options for available token types
  // Only shows categories that have tokens available
}
```

## Last Working State

As of October 2024, the plugin successfully:
- Imports spacing tokens by key from team libraries
- Binds to itemSpacing (gap) and padding properties
- Provides clear error messages for common issues
- Handles multiple spacing token formats and naming conventions
- **NEW**: Dynamically generates validation options based on available tokens
- **NEW**: Supports validation for colors, corner radius, and other variable types
- **NEW**: Multi-approach variable lookup (local ID → local name → Team Library import)
- **NEW**: Comprehensive debug tools for troubleshooting variable issues

## Critical Development Notes

### Plugin Restart Requirement
**IMPORTANT**: Figma must be restarted after plugin code changes. This is the #1 cause of "broken" functionality during development.

### Debug Tools Available
- `DEBUG: Check Available Variables` - Shows Team Library variables
- `DEBUG: Check Storage State` - Shows cached library data
- `Reset Libraries` - Clears all cached data

### Variable Key Stability
Variable keys remain stable across publishes, making them reliable for cross-file imports. Variable IDs are file-specific and only work within the same file.

This architecture follows Figma's recommended patterns and provides reliable cross-file variable binding with extensible validation categories.
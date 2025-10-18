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

This architecture follows Figma's recommended patterns and provides reliable cross-file variable binding with extensible validation categories.
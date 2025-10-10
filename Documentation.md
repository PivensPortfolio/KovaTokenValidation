# Token Validation Tool - Documentation

## Overview

The Token Validation Tool helps you validate design tokens and text styles in your Figma documents against attached design systems. It automatically detects inconsistencies and suggests appropriate design tokens to maintain consistency.

## Getting Started

### 1. Attach a Design System

1. Click "Attach Design System" in the main interface
2. Select from available design systems:
   - **Local Styles & Variables**: Your current document's styles and variables
   - **Team Libraries**: Published design systems from your team

### 2. Validation Options

Once a design system is attached, you'll see validation options with counts:

- **Text Styles**: Validates text style usage (shows "X Styles Available")
- **Spacing**: Validates spacing tokens and layout consistency (shows "X Variables Available")

## Spacing Variable Detection

### How It Works

The tool automatically detects spacing variables by looking at **collection names**. It counts ALL variables within collections whose names contain spacing-related keywords.

### Supported Collection Names (Case-Insensitive)

Collections will be detected if their name contains any of these keywords:
- `spacing`
- `space`
- `gap`
- `margin`
- `padding`
- `size`

### Examples

✅ **Will be detected:**
- "Spacing"
- "Space"
- "Design Spacing"
- "Layout Spacing"
- "Spacing Tokens"
- "Gap"
- "Margins"
- "Padding"
- "Size"
- "Component Spacing"

❌ **Will NOT be detected:**
- "Design Tokens"
- "Foundation"
- "Variables"
- "System"
- "Tokens"

### Troubleshooting Spacing Variables

If your spacing variables show "0 Variables Available":

1. **Check your collection names** in Figma's Variables panel
2. **Ensure at least one collection name contains** one of the supported keywords
3. **Consider renaming** your collection to include "Spacing" or "Space"
4. **Alternative**: Create a dedicated "Spacing" collection for your spacing variables

### What Gets Counted

- **ALL variables** within collections that match the naming criteria
- Individual variable names within those collections are **not filtered**
- If a collection is named "Spacing", **all variables in it** count as spacing variables

## Text Style Detection

### How It Works

The tool detects text styles from attached design systems and compares them against text styles used in your document.

### Current Implementation

- **Library text styles**: Automatically detected from attached design systems
- **Count display**: Shows total number of available text styles (e.g., "16 Styles Available")
- **Usage validation**: Checks which styles from the design system are actually being used

## Validation Process

### What Gets Validated

1. **Text Style Usage**:
   - Identifies text nodes using hardcoded formatting instead of design system styles
   - Suggests appropriate text styles from the attached design system

2. **Spacing Consistency**:
   - Detects hardcoded spacing values
   - Suggests appropriate spacing tokens from detected spacing collections

### Validation Requirements

For validation to work properly:

1. **Design system must be attached** and contain relevant tokens
2. **At least some design system tokens must be in use** in your document
3. **Spacing variables must be in properly named collections** (see Spacing Detection above)

## Console Logging

The tool provides detailed console logging to help you understand what's happening:

### Spacing Detection Example
```
📊 Getting spacing variables count for Blueprint Atoms...
📋 SPACING DETECTION: Looking for collections with names containing: spacing, space, gap, margin, padding, size
🔍 Analyzing 2 collections...
🔍 Checking collection: "Spacing" with 3 variables
✅ "Spacing" is a spacing collection with 3 variables
🔍 Checking collection: "Colors" with 12 variables
⏭️ "Colors" is not a spacing collection, skipping

📊 SPACING DETECTION SUMMARY:
   ✅ Detected spacing collections: "Spacing" (3 variables)
   ⏭️ Skipped collections: "Colors"
   📏 Total spacing variables: 3
```

### Troubleshooting Output
```
⚠️ TROUBLESHOOTING: No spacing variables detected!
   💡 To fix this, ensure at least one collection name contains:
      "spacing", "space", "gap", "margin", "padding", or "size"
   💡 Consider renaming a collection to "Spacing" or creating a dedicated spacing collection
```

## Best Practices

### Organizing Variables

1. **Create dedicated collections** for different token types:
   - "Spacing" for spacing tokens
   - "Colors" for color tokens
   - "Typography" for typography tokens

2. **Use descriptive names** that include relevant keywords for automatic detection

3. **Group related variables** together in the same collection

### Design System Setup

1. **Publish your design system** as a team library for broader access
2. **Use consistent naming conventions** across your design tokens
3. **Apply design system styles** to at least some elements in your document before validation

## Limitations

### Current Limitations

1. **Collection name dependency**: Spacing detection relies on collection names containing specific keywords
2. **Library access**: Some design systems may not be accessible depending on permissions
3. **Text style API**: Full text style enumeration requires REST API access (currently simulated)

### Future Improvements

- Individual variable name detection (not just collection names)
- More flexible detection patterns
- Enhanced text style discovery
- Custom keyword configuration

## Support

### Getting Help

1. **Check the console** for detailed logging and troubleshooting information
2. **Verify your collection names** match the supported patterns
3. **Ensure your design system is properly published** and accessible
4. **Test with a simple setup** first (e.g., create a "Spacing" collection with a few variables)

### Common Issues

**"0 Variables Available" for spacing**:
- Check collection names contain spacing-related keywords
- Verify variables are in collections, not loose variables

**"No design system usage found"**:
- Apply at least one text style from the design system to your document
- Ensure the design system is properly attached

**Design system not appearing**:
- Check if the library is published and you have access
- Try refreshing the design system list
# Kova Token Validator - Quick Reference

## Overview
The Kova Token Validator helps maintain design system consistency by validating text styles, spacing tokens, colors, and other design tokens in your Figma documents.

## Quick Start

### 1. Export Design System
1. Open your design system file
2. Launch the plugin → Click "Export Keys"
3. Plugin saves all text styles and variables

### 2. Validate Design File
1. Open the file to validate
2. Launch plugin → Select your exported library
3. Choose validation options → Run validation
4. Review and fix issues

## Supported Token Types

| Type | Detection | Description |
|------|-----------|-------------|
| **Text Styles** | Published styles | Validates text style usage |
| **Spacing** | `spacing`, `space`, `gap`, `margin`, `padding` | Layout consistency |
| **Colors** | `color`, `colours`, `palette` | Color token usage |
| **Corner Radius** | `radius`, `corner`, `border-radius` | Border radius tokens |

## Token Detection

### Collection Names
The plugin detects tokens by collection names:
- ✅ "Spacing" → Spacing tokens
- ✅ "Colors" → Color tokens  
- ✅ "Corner Radius" → Radius tokens

### Variable Names (Fallback)
If collection names don't match, checks individual variable names:
- `primary-color` → Color token
- `button-padding` → Spacing token

## Troubleshooting

### "0 Variables Available"
- Check collection names contain relevant keywords
- Rename collections to include "Spacing", "Colors", etc.
- Ensure variables are in collections, not loose

### "Library not found"
- Re-export your design system
- Check library permissions
- Ensure design system is published

### Variable binding fails
- Enable design system library in Variables panel
- Check plugin has team library permissions
- Verify variable keys are valid

## Best Practices

1. **Organize collections** with clear names ("Spacing", "Colors")
2. **Use consistent naming** across design tokens
3. **Publish libraries** for team access
4. **Test with simple setup** first

For detailed documentation, see the main README.md file.
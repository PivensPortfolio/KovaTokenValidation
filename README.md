# Figma Token Validator

A powerful Figma plugin that helps design teams maintain consistency by validating design system compliance and applying text styles and spacing tokens from external design system libraries.

## Features

### 🎯 Design System Validation
- **Text Style Validation**: Identifies text layers without applied text styles
- **Spacing Validation**: Detects hardcoded spacing values (padding, gaps) that should use design tokens
- **Real-time Results**: Instant validation feedback with detailed issue reporting
- **Collapsed View**: Focus mode for individual asset validation

### 📚 External Library Integration
- **Library Export**: Export text styles and variables from any Figma file
- **Cross-file Application**: Apply styles from external design system files
- **Variable Support**: Full support for Figma variables including spacing tokens
- **Multiple Libraries**: Manage and switch between multiple design system libraries

### 🔧 Smart Application Tools
- **One-click Style Application**: Apply text styles directly to validation issues
- **Spacing Token Application**: Replace hardcoded spacing with design tokens
- **Bulk Operations**: Apply styles to multiple text layers at once
- **Node Selection**: Automatic node selection and highlighting

### 🎨 Intuitive Interface
- **Multi-screen Workflow**: Guided process from export to validation
- **Responsive UI**: Adaptive interface that resizes based on current mode
- **Visual Feedback**: Clear indicators for validation status and progress
- **Collapsed Mode**: Minimized view for focused validation work

## How It Works

### 1. Export Design System
1. Open your design system file in Figma
2. Launch the Token Validator plugin
3. Click "Export Keys" to extract text styles and variables
4. The plugin saves your design system data locally

### 2. Validate Designs
1. Open any design file you want to validate
2. Launch the plugin and select your exported design system
3. Choose validation options (text styles, spacing, or both)
4. Run validation to see compliance issues

### 3. Fix Issues
1. Review validation results in the detailed report
2. Use dropdown menus to select appropriate styles/tokens
3. Click "Update" to apply fixes instantly
4. Use the "View" button to focus on specific assets

## Installation & Setup

### Prerequisites
- Node.js (https://nodejs.org/en/download/)
- TypeScript: `npm install -g typescript`

### Development Setup
1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Install Figma plugin types:
   ```bash
   npm install --save-dev @figma/plugin-typings
   ```
4. Build the plugin:
   ```bash
   npm run build
   ```
   Or for development with auto-rebuild:
   ```bash
   npm run watch
   ```

### Installing in Figma
1. Open Figma Desktop App
2. Go to Plugins → Development → Import plugin from manifest
3. Select the `manifest.json` file from this project
4. The plugin will appear in your Plugins menu

## Usage Guide

### Exporting a Design System
1. **Open your design system file** in Figma
2. **Launch the plugin** from the Plugins menu
3. **Click "Export Keys"** - this will:
   - Extract all local text styles
   - Export all local variables (including spacing tokens)
   - Save the data with your file name as the library key
4. **Confirmation** - you'll see a success message with the count of exported items

### Validating a Design File
1. **Open the file** you want to validate
2. **Launch the plugin** and select your exported design system library
3. **Choose validation options**:
   - Text Styles: Find text without applied styles
   - Spacing: Find hardcoded padding and gaps
4. **Run validation** - results appear instantly
5. **Review issues** in the detailed report

### Fixing Validation Issues
1. **Select appropriate fixes** using the dropdown menus next to each issue
2. **Click "Update"** to apply the selected style or token
3. **Use "View" button** to switch to collapsed mode and focus on specific assets
4. **Track progress** - fixed items are automatically removed from the list

### Collapsed Mode
- **Automatic activation** when clicking "View" buttons
- **Focused validation** showing only issues for the selected asset
- **Minimize/expand** toggle for switching between full and collapsed views
- **Selection tracking** automatically updates when you select different assets

## Technical Architecture

### Core Components
- **`code.ts`**: Main plugin logic, Figma API interactions, validation engine
- **`ui.html`**: Complete user interface with embedded CSS and JavaScript
- **`manifest.json`**: Plugin configuration and permissions

### Key Features Implementation
- **Duplicate Prevention**: Event handlers use `data-handlers-attached` attributes
- **State Management**: Persistent storage for libraries and UI state
- **Validation Engine**: Recursive node traversal with safety checks
- **Cross-file Integration**: Figma's `importStyleByKeyAsync` API for external styles

### Data Structure
```typescript
type SavedLibrary = {
  libraryName: string;
  libraryFileKey?: string | null;
  generatedAt: string;
  type: 'design-system-export';
  version: number;
  items: Record<string, string>; // Style name -> style key
  variables?: Record<string, any>; // Variable collections
};
```

## API Reference

### Plugin Messages
- `export-keys`: Export design system from current file
- `run-validation`: Validate current selection or page
- `apply-text-style`: Apply text style to specific node
- `apply-spacing-token`: Apply spacing token to specific node
- `select-node`: Select and highlight specific node in Figma

### Storage
- `savedLibraries`: Persistent storage for exported design systems
- `status`: Current UI state and workflow position

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with descriptive messages
5. Push to your fork and submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Maintain backward compatibility for saved libraries
- Test with multiple design system configurations
- Ensure UI responsiveness across different screen sizes

## Troubleshooting

### Common Issues
- **"No style map found"**: Ensure you've exported a design system library first
- **"Style not found"**: The selected style may have been renamed or deleted in the source file
- **Validation not working**: Check that you have proper selection or are on a valid page
- **UI not responsive**: Try refreshing the plugin or restarting Figma

### Performance Tips
- Validation is limited to 1000 nodes for performance
- Large files may take longer to process
- Use collapsed mode for focused work on specific assets

## License

This project is open source. Feel free to use, modify, and distribute according to your needs.

## Support

For issues, feature requests, or questions:
- Create an issue in this GitHub repository
- Include steps to reproduce any bugs
- Provide sample files when possible

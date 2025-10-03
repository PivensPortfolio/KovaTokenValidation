# View State Management System

This directory contains the view state management system for the Token Validator plugin, implementing a three-view interface with smooth transitions and persistent data management.

## Architecture Overview

The system is built with a modular architecture consisting of:

- **Types**: TypeScript interfaces and type definitions
- **State Management**: Centralized state management with automatic persistence
- **Controllers**: High-level orchestration of state, persistence, and transitions
- **Persistence**: Data persistence using Figma's clientStorage API

## Core Components

### 1. Types (`types/ViewState.ts`)

Defines all TypeScript interfaces and types used throughout the system:

- `ViewType`: Union type for the three views ('form' | 'results' | 'collapsed')
- `ViewState`: Main state interface containing current view, form data, and results
- `DesignSystemInfo`: Interface for design system metadata
- `ValidationIssue`: Interface for validation result issues
- `ViewTransition`: Interface for transition configuration

### 2. State Manager (`state/StateManager.ts`)

Centralized state management with:

- **State Storage**: Maintains current view state, form data, and results
- **State Updates**: Methods for updating different parts of the state
- **Validation**: Helper methods to check state validity
- **Subscriptions**: Observer pattern for state change notifications

Key methods:
- `setCurrentView(view)`: Switch to a different view
- `updateFormData(updates)`: Update form data
- `attachDesignSystem(info)`: Attach a design system
- `setValidationOptions(options)`: Set validation options
- `subscribe(callback)`: Listen for state changes

### 3. Persistence Manager (`state/PersistenceManager.ts`)

Handles data persistence using Figma's clientStorage:

- **Design System Persistence**: Long-term storage of selected design systems
- **Validation Options**: User preference persistence
- **Results Data**: Temporary storage of validation results
- **Data Freshness**: Checks if cached results are still valid

Key methods:
- `saveDesignSystem(id, info)`: Persist design system selection
- `loadFormData()`: Restore user preferences
- `saveResultsData(results)`: Cache validation results
- `areResultsFresh(results)`: Check if results are still valid

### 4. View Transition Controller (`controllers/ViewTransitionController.ts`)

Manages view transitions with animations:

- **Smooth Transitions**: Animated transitions between views
- **Window Management**: Automatic resizing and repositioning
- **Animation Types**: Different animations for different transitions
- **State Preservation**: Maintains state during transitions

Key methods:
- `switchToView(view, options)`: Main transition method
- `goToForm()`, `goToResults()`, `goToCollapsed()`: Quick transition methods
- `restorePreviousState()`: Go back to previous view

### 5. View State Controller (`controllers/ViewStateController.ts`)

Main orchestrator that coordinates all components:

- **Initialization**: Sets up the entire system
- **State Coordination**: Manages interactions between components
- **Auto-persistence**: Automatically saves state changes
- **Error Handling**: Graceful error handling and recovery

Key methods:
- `initialize()`: Initialize the entire system
- `switchToView(view)`: High-level view switching
- `attachDesignSystem(info)`: Attach design system with persistence
- `setValidationResults(issues, nodes, scope)`: Set and persist results

### 6. Main Entry Point (`ViewStateManager.ts`)

Provides a simple API for external use:

- **Global Instance**: Singleton pattern for system-wide access
- **Convenience Functions**: Simple functions for common operations
- **Type Exports**: Re-exports types for external use

## Usage

### Initialization

```typescript
import { initializeViewStateManager } from './src/ViewStateManager';

// Initialize the system
await initializeViewStateManager();
```

### Basic Operations

```typescript
import { 
  switchToView, 
  attachDesignSystem, 
  setValidationOptions,
  goToResults 
} from './src/ViewStateManager';

// Switch views
await switchToView('form');
await switchToView('results');
await switchToView('collapsed');

// Or use convenience methods
await goToResults(issues, totalNodes, scope);

// Manage design systems
await attachDesignSystem({
  id: 'system-id',
  name: 'My Design System',
  type: 'local-variables',
  source: 'Local',
  assetsCount: 42
});

// Set validation options
setValidationOptions(['spacings', 'font-size']);
```

### State Subscription

```typescript
import { subscribeToStateChanges } from './src/ViewStateManager';

// Listen for state changes
const unsubscribe = subscribeToStateChanges((state) => {
  console.log('State changed:', state);
  // Update UI based on state changes
});

// Later, unsubscribe
unsubscribe();
```

## View Flow

The system supports three main views with the following flow:

```
Form View (Default)
    ↓ (Run Check)
Results View
    ↓ (Click Issue)
Collapsed View
    ↓ (Expand)
Results View
    ↓ (Back to Form)
Form View
```

## Data Persistence

The system automatically persists:

- **Design System Selection**: Remembered across sessions
- **Validation Options**: User preferences saved
- **Results Data**: Cached for quick access (5-minute freshness)

## Error Handling

The system includes comprehensive error handling:

- **Graceful Degradation**: Falls back to basic functionality if advanced features fail
- **Error Recovery**: Attempts to recover from errors automatically
- **Logging**: Detailed logging for debugging

## Testing

Basic tests are included in `tests/ViewStateManager.test.ts`:

```typescript
import { runAllTests } from './src/tests/ViewStateManager.test';

// Run all tests
const allPassed = runAllTests();
```

## Integration

The system integrates with the existing Figma plugin code:

1. **Initialization**: Called during plugin startup
2. **Message Handling**: Responds to UI messages for view changes
3. **State Updates**: Updates state based on user actions
4. **Persistence**: Automatically saves and restores state

## Requirements Satisfied

This implementation satisfies the following requirements:

- **4.2**: Visual feedback during transitions ✅
- **5.1**: Design system selection persistence ✅
- **5.2**: Validation option preferences ✅
- **5.3**: Automatic state restoration ✅
- **5.4**: Preference saving ✅
- **5.5**: Session data management ✅

## Future Enhancements

Potential improvements:

- **Animation Customization**: More animation options
- **State Validation**: More robust state validation
- **Performance Optimization**: Lazy loading and caching
- **Error Recovery**: More sophisticated error recovery
- **Testing**: Comprehensive test suite
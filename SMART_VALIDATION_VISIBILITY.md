# Smart Validation Options Visibility

## Problem
The plugin was showing validation options for token types that had 0 tokens available, creating a confusing user experience where users could select validation options that wouldn't find anything to validate.

## Solution
Implemented smart visibility logic that automatically hides validation options when no tokens of that type are available in the selected design system.

## Implementation

### 1. Dynamic Show/Hide Logic
```javascript
const updateCountAndVisibility = (checkboxId, countId, count, label) => {
  const countElement = document.getElementById(countId)
  const checkboxGroup = document.querySelector(`label[for="${checkboxId}"]`)
  
  if (countElement) {
    countElement.textContent = `${count} ${label}`
  }
  
  // Show/hide based on token availability
  if (checkboxGroup) {
    if (count > 0) {
      checkboxGroup.style.display = 'flex'
    } else {
      checkboxGroup.style.display = 'none'
      // Uncheck hidden checkboxes
      const checkbox = document.getElementById(checkboxId)
      if (checkbox) {
        checkbox.checked = false
      }
    }
  }
}
```

### 2. Core vs Optional Validation Options

#### Always Visible (Core Functionality)
- **Text Styles** - Always shown (core plugin functionality)
- **Spacing** - Always shown (core plugin functionality)

#### Conditionally Visible (Based on Token Availability)
- **Colors** - Only shown if colors > 0
- **Corner Radius** - Only shown if cornerRadius > 0
- **Typography** - Only shown if typography > 0
- **Shadows** - Only shown if shadows > 0
- **Borders** - Only shown if borders > 0
- **Opacity** - Only shown if opacity > 0
- **Sizing** - Only shown if sizing > 0

### 3. Smart Validation Logic

#### Updated Button State Management
```javascript
const anyChecked = checkboxes.some(id => {
  const checkbox = document.getElementById(id)
  const checkboxGroup = document.querySelector(`label[for="${id}"]`)
  // Only count visible and checked checkboxes
  return checkbox && checkbox.checked && checkboxGroup && checkboxGroup.style.display !== 'none'
})
```

#### Validation Options Processing
```javascript
const getVisibleCheckboxValue = (checkboxId) => {
  const checkbox = document.getElementById(checkboxId)
  const checkboxGroup = document.querySelector(`label[for="${checkboxId}"]`)
  // Only return true if checkbox is checked AND visible
  return checkbox && checkbox.checked && checkboxGroup && checkboxGroup.style.display !== 'none'
}
```

## User Experience Improvements

### Before
- All 9 validation options always visible
- Users could select options with 0 tokens
- Confusing "83 Colors Available" vs "0 Typography Tokens Available"
- Cluttered interface with irrelevant options

### After
- Only relevant validation options shown
- Clean, focused interface
- No confusion about empty token categories
- Automatic checkbox unchecking when hidden
- Dynamic interface that adapts to library content

## Smart Behavior

### Library Selection Flow
1. **User selects library** → Plugin analyzes token counts
2. **Token analysis** → Categorizes all available tokens
3. **Visibility update** → Shows only categories with tokens > 0
4. **Interface cleanup** → Hides empty categories, unchecks hidden checkboxes
5. **Window resize** → Adjusts to fit only visible content

### Automatic State Management
- **Hidden checkboxes** are automatically unchecked
- **Run Validation button** only considers visible options
- **Validation logic** only processes visible selections
- **Window sizing** adapts to visible content only

## Benefits

### ✅ Cleaner Interface
- No clutter from empty token categories
- Users only see relevant validation options
- Focused user experience

### ✅ Prevents Confusion
- No "0 tokens available" options visible
- Clear indication of what can be validated
- No empty validation results

### ✅ Dynamic Adaptation
- Interface adapts to each design system's content
- Different libraries show different options
- Responsive to library changes

### ✅ Better UX Flow
- Users can't accidentally select empty categories
- Validation always finds relevant issues
- Clear expectations about what will be validated

## Technical Details

### Visibility Control
- Uses `display: 'flex'` to show options
- Uses `display: 'none'` to hide options
- Maintains checkbox styling when visible

### State Synchronization
- Hidden checkboxes are unchecked automatically
- Button states update based on visible selections only
- Validation logic respects visibility state

### Performance
- Minimal DOM manipulation
- Efficient visibility checks
- No unnecessary processing of hidden options

This implementation ensures users only see validation options that are actually useful for their selected design system, creating a much cleaner and more intuitive experience.
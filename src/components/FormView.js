export class FormView {
    constructor(container, viewController) {
        this.container = container;
        this.viewController = viewController;
        this.state = {
            selectedDesignSystem: null,
            validationOptions: ['spacings'], // Default to spacings checked
            attachedSystemInfo: null,
            availableLibraries: [],
            isDropdownOpen: false,
            isLoadingLibraries: false,
            libraryLoadError: null,
            attachmentStatus: 'idle',
            attachmentError: null,
            formValidation: {
                hasDesignSystem: false,
                hasValidationOptions: true, // Default spacings is checked
                showNoOptionsWarning: false,
                showNoDesignSystemError: false
            }
        };
    }
    render() {
        this.container.innerHTML = `
      <h1 class="main-title">Token Validation</h1>
      <p class="description">
        Validate properties are set to use the tokens defined in your design system.
      </p>

      <div class="section design-system-section">
        <div class="section-title">Design System:</div>
        <div class="helper-text">
          Select a design system to validate your design tokens against.
        </div>
        <div class="attach-container">
          <button class="attach-button" id="attach-design-system">
            <span class="attach-icon">📎</span>
            <span id="attach-text">Attach Design System</span>
            <span class="loading-spinner" id="loading-spinner"></span>
          </button>
          <div class="library-dropdown" id="library-dropdown">
            <div class="library-item no-libraries">Loading libraries...</div>
          </div>
        </div>
        <div class="validation-error" id="design-system-error">
          <span class="error-icon">⚠️</span>
          <span>Please select a design system before running validation</span>
        </div>
        <div class="attachment-status" id="attachment-status">
          <div class="status-indicator" id="status-indicator"></div>
          <span class="status-text" id="status-text"></span>
        </div>
        <div class="attached-info" id="attached-info">
          <strong>Design System attached:</strong> <span id="system-name"></span>
        </div>
        <div class="error-message" id="error-message">
          <span class="error-text" id="error-text"></span>
          <button class="retry-button" id="retry-button">Retry</button>
        </div>
      </div>

      <div class="section validation-options-section">
        <div class="section-title">What to check:</div>
        <div class="helper-text">
          Select which design token properties you want to validate. At least one option is required.
        </div>
        <div class="checkbox-item">
          <div class="checkbox checked" data-option="spacings"></div>
          <label class="checkbox-label" for="spacings">
            <span class="option-name">Spacings (padding, gaps)</span>
            <span class="option-description">Check if spacing values match your design tokens</span>
          </label>
        </div>
        <div class="checkbox-item">
          <div class="checkbox" data-option="corner-radius"></div>
          <label class="checkbox-label" for="corner-radius">
            <span class="option-name">Corner Radius</span>
            <span class="option-description">Validate border radius values against tokens</span>
          </label>
        </div>
        <div class="checkbox-item">
          <div class="checkbox" data-option="font-size"></div>
          <label class="checkbox-label" for="font-size">
            <span class="option-name">Font Size</span>
            <span class="option-description">Check text size consistency with typography tokens</span>
          </label>
        </div>
        <div class="checkbox-item">
          <div class="checkbox" data-option="font-color"></div>
          <label class="checkbox-label" for="font-color">
            <span class="option-name">Font Color</span>
            <span class="option-description">Validate text colors match your color tokens</span>
          </label>
        </div>
        <div class="validation-warning" id="options-warning">
          <span class="warning-icon">⚠️</span>
          <span>Please select at least one validation option to continue</span>
        </div>
      </div>

      <div class="run-section">
        <button class="run-button" id="run-check">Run Check</button>
        <div class="run-button-help" id="run-button-help">
          Complete the form above to enable validation
        </div>
      </div>
    `;
        this.attachEventListeners();
        this.validateForm(); // Initial form validation
        this.updateUI();
        this.requestLibraries();
    }
    attachEventListeners() {
        // Handle checkbox interactions
        this.container.querySelectorAll('.checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', () => {
                const option = checkbox.dataset.option;
                if (option) {
                    this.toggleValidationOption(option);
                }
            });
        });
        // Handle label clicks
        this.container.querySelectorAll('.checkbox-label').forEach(label => {
            label.addEventListener('click', () => {
                const checkbox = label.previousElementSibling;
                const option = checkbox === null || checkbox === void 0 ? void 0 : checkbox.dataset.option;
                if (option) {
                    this.toggleValidationOption(option);
                }
            });
        });
        // Handle run check button
        const runButton = this.container.querySelector('#run-check');
        runButton === null || runButton === void 0 ? void 0 : runButton.addEventListener('click', () => {
            // Validate form before proceeding
            this.validateForm();
            if (!this.state.formValidation.hasDesignSystem) {
                this.showValidationError('Please attach a design system first');
                return;
            }
            if (!this.state.formValidation.hasValidationOptions) {
                this.showValidationError('Please select at least one validation option');
                return;
            }
            if (this.state.attachedSystemInfo && this.onRunCheck) {
                this.onRunCheck(this.state.validationOptions);
            }
        });
        // Handle design system attachment
        const attachButton = this.container.querySelector('#attach-design-system');
        attachButton === null || attachButton === void 0 ? void 0 : attachButton.addEventListener('click', () => {
            if (this.state.attachmentStatus === 'attaching') {
                return; // Prevent clicks while attaching
            }
            if (!this.state.attachedSystemInfo) {
                this.toggleDropdown();
            }
            else {
                this.detachDesignSystem();
            }
        });
        // Handle retry button
        const retryButton = this.container.querySelector('#retry-button');
        retryButton === null || retryButton === void 0 ? void 0 : retryButton.addEventListener('click', () => {
            this.retryLibraryLoad();
        });
        // Close dropdown when clicking outside
        document.addEventListener('click', (event) => {
            const dropdown = this.container.querySelector('#library-dropdown');
            const button = this.container.querySelector('#attach-design-system');
            if (!(button === null || button === void 0 ? void 0 : button.contains(event.target)) && !(dropdown === null || dropdown === void 0 ? void 0 : dropdown.contains(event.target))) {
                this.closeDropdown();
            }
        });
    }
    toggleValidationOption(option) {
        const index = this.state.validationOptions.indexOf(option);
        if (index > -1) {
            this.state.validationOptions.splice(index, 1);
        }
        else {
            this.state.validationOptions.push(option);
        }
        this.updateCheckboxes();
        this.validateForm();
        this.updateRunButton();
    }
    updateCheckboxes() {
        this.container.querySelectorAll('.checkbox').forEach(checkbox => {
            const option = checkbox.dataset.option;
            if (option) {
                if (this.state.validationOptions.includes(option)) {
                    checkbox.classList.add('checked');
                }
                else {
                    checkbox.classList.remove('checked');
                }
            }
        });
    }
    validateForm() {
        this.state.formValidation.hasDesignSystem = !!this.state.attachedSystemInfo;
        this.state.formValidation.hasValidationOptions = this.state.validationOptions.length > 0;
        // Show warnings/errors based on validation state
        this.state.formValidation.showNoDesignSystemError = !this.state.formValidation.hasDesignSystem;
        this.state.formValidation.showNoOptionsWarning = !this.state.formValidation.hasValidationOptions;
        this.updateValidationUI();
    }
    updateValidationUI() {
        const designSystemError = this.container.querySelector('#design-system-error');
        const optionsWarning = this.container.querySelector('#options-warning');
        const runButtonHelp = this.container.querySelector('#run-button-help');
        // Design system validation
        if (designSystemError) {
            if (this.state.formValidation.showNoDesignSystemError && !this.state.attachedSystemInfo) {
                designSystemError.classList.add('show');
            }
            else {
                designSystemError.classList.remove('show');
            }
        }
        // Validation options warning
        if (optionsWarning) {
            if (this.state.formValidation.showNoOptionsWarning) {
                optionsWarning.classList.add('show');
            }
            else {
                optionsWarning.classList.remove('show');
            }
        }
        // Update run button help text
        if (runButtonHelp) {
            if (!this.state.formValidation.hasDesignSystem && !this.state.formValidation.hasValidationOptions) {
                runButtonHelp.textContent = 'Please attach a design system and select validation options';
            }
            else if (!this.state.formValidation.hasDesignSystem) {
                runButtonHelp.textContent = 'Please attach a design system to continue';
            }
            else if (!this.state.formValidation.hasValidationOptions) {
                runButtonHelp.textContent = 'Please select at least one validation option';
            }
            else {
                runButtonHelp.textContent = 'Ready to run validation';
                runButtonHelp.classList.add('ready');
            }
        }
    }
    updateRunButton() {
        const runButton = this.container.querySelector('#run-check');
        const isFormValid = this.state.formValidation.hasDesignSystem && this.state.formValidation.hasValidationOptions;
        if (runButton) {
            runButton.disabled = !isFormValid;
            runButton.classList.toggle('disabled', !isFormValid);
            runButton.classList.toggle('ready', isFormValid);
        }
    }
    toggleDropdown() {
        this.state.isDropdownOpen = !this.state.isDropdownOpen;
        const dropdown = this.container.querySelector('#library-dropdown');
        if (dropdown) {
            if (this.state.isDropdownOpen) {
                dropdown.classList.add('show');
            }
            else {
                dropdown.classList.remove('show');
            }
        }
    }
    closeDropdown() {
        this.state.isDropdownOpen = false;
        const dropdown = this.container.querySelector('#library-dropdown');
        dropdown === null || dropdown === void 0 ? void 0 : dropdown.classList.remove('show');
    }
    requestLibraries() {
        this.state.isLoadingLibraries = true;
        this.state.libraryLoadError = null;
        this.updateLibraryLoadingState();
        // Send message to plugin to get available libraries
        parent.postMessage({
            pluginMessage: {
                type: 'get-libraries'
            }
        }, '*');
    }
    retryLibraryLoad() {
        this.state.libraryLoadError = null;
        this.state.attachmentError = null;
        this.updateErrorState();
        this.requestLibraries();
    }
    updateLibraryLoadingState() {
        const dropdown = this.container.querySelector('#library-dropdown');
        if (!dropdown)
            return;
        if (this.state.isLoadingLibraries) {
            dropdown.innerHTML = '<div class="library-item no-libraries loading">Loading libraries...</div>';
        }
    }
    updateAttachmentStatus(status, message) {
        this.state.attachmentStatus = status;
        const statusIndicator = this.container.querySelector('#status-indicator');
        const statusText = this.container.querySelector('#status-text');
        const attachmentStatus = this.container.querySelector('#attachment-status');
        if (!statusIndicator || !statusText || !attachmentStatus)
            return;
        // Clear previous status classes
        statusIndicator.className = 'status-indicator';
        attachmentStatus.className = 'attachment-status';
        switch (status) {
            case 'attaching':
                statusIndicator.classList.add('loading');
                statusText.textContent = 'Attaching design system...';
                attachmentStatus.classList.add('show');
                break;
            case 'attached':
                statusIndicator.classList.add('success');
                statusText.textContent = 'Design system successfully attached';
                attachmentStatus.classList.add('show');
                // Hide status after 3 seconds
                setTimeout(() => {
                    attachmentStatus.classList.remove('show');
                }, 3000);
                break;
            case 'error':
                statusIndicator.classList.add('error');
                statusText.textContent = message || 'Failed to attach design system';
                attachmentStatus.classList.add('show');
                break;
            case 'idle':
            default:
                attachmentStatus.classList.remove('show');
                break;
        }
    }
    updateErrorState() {
        const errorMessage = this.container.querySelector('#error-message');
        const errorText = this.container.querySelector('#error-text');
        if (!errorMessage || !errorText)
            return;
        if (this.state.libraryLoadError || this.state.attachmentError) {
            const error = this.state.libraryLoadError || this.state.attachmentError;
            errorText.textContent = error || 'An error occurred';
            errorMessage.classList.add('show');
        }
        else {
            errorMessage.classList.remove('show');
        }
    }
    showValidationError(message) {
        // Create a temporary validation error message
        const existingError = this.container.querySelector('.temp-validation-error');
        if (existingError) {
            existingError.remove();
        }
        const errorDiv = document.createElement('div');
        errorDiv.className = 'temp-validation-error validation-error show';
        errorDiv.innerHTML = `
      <span class="error-icon">⚠️</span>
      <span>${message}</span>
    `;
        const runSection = this.container.querySelector('.run-section');
        if (runSection) {
            runSection.appendChild(errorDiv);
            // Remove the error after 5 seconds
            setTimeout(() => {
                errorDiv.remove();
            }, 5000);
        }
    }
    updateLibraries(libraries, hasError = false, errorMessage = '', debugInfo = null) {
        this.state.isLoadingLibraries = false;
        this.state.availableLibraries = libraries;
        const dropdown = this.container.querySelector('#library-dropdown');
        if (!dropdown)
            return;
        dropdown.innerHTML = '';
        if (hasError) {
            this.state.libraryLoadError = errorMessage || 'Error loading libraries';
            this.updateErrorState();
            const errorItem = document.createElement('div');
            errorItem.className = 'library-item no-libraries error';
            errorItem.innerHTML = `
        <span class="error-icon">⚠️</span>
        <span>${errorMessage || 'Error loading libraries'}</span>
      `;
            errorItem.title = debugInfo ? JSON.stringify(debugInfo, null, 2) : 'No debug info available';
            dropdown.appendChild(errorItem);
            if (debugInfo) {
                const debugItem = document.createElement('div');
                debugItem.className = 'library-item no-libraries debug';
                debugItem.textContent = `Debug: Failed at step "${debugInfo.step}"`;
                debugItem.style.fontSize = '11px';
                debugItem.style.color = '#999';
                dropdown.appendChild(debugItem);
            }
            return;
        }
        // Clear any previous errors
        this.state.libraryLoadError = null;
        this.updateErrorState();
        if (libraries.length === 0) {
            const noLibrariesItem = document.createElement('div');
            noLibrariesItem.className = 'library-item no-libraries';
            noLibrariesItem.innerHTML = `
        <span class="info-icon">ℹ️</span>
        <span>No design system libraries found</span>
      `;
            dropdown.appendChild(noLibrariesItem);
            return;
        }
        libraries.forEach(library => {
            const libraryItem = document.createElement('div');
            libraryItem.className = 'library-item';
            libraryItem.innerHTML = `
        <span class="library-name">${library.name}</span>
        <span class="library-type">${library.source}</span>
      `;
            libraryItem.addEventListener('click', () => {
                this.selectLibrary(library);
            });
            dropdown.appendChild(libraryItem);
        });
    }
    selectLibrary(library) {
        this.closeDropdown();
        this.updateAttachmentStatus('attaching');
        // Clear any previous attachment errors
        this.state.attachmentError = null;
        this.updateErrorState();
        // Send message to plugin to attach this library
        parent.postMessage({
            pluginMessage: {
                type: 'attach-design-system',
                libraryId: library.id
            }
        }, '*');
    }
    attachDesignSystem(library) {
        this.state.attachedSystemInfo = library;
        this.state.selectedDesignSystem = library;
        this.updateAttachmentStatus('attached', `Successfully attached ${library.name}`);
        this.validateForm(); // Re-validate form when design system is attached
        this.updateUI();
    }
    attachDesignSystemError(errorMessage) {
        this.state.attachmentError = errorMessage;
        this.updateAttachmentStatus('error', errorMessage);
        this.updateErrorState();
    }
    detachDesignSystem() {
        this.state.attachedSystemInfo = null;
        this.state.selectedDesignSystem = null;
        // Send message to plugin
        parent.postMessage({
            pluginMessage: {
                type: 'detach-design-system'
            }
        }, '*');
        this.validateForm(); // Re-validate form when design system is detached
        this.updateUI();
    }
    updateUI() {
        const button = this.container.querySelector('#attach-design-system');
        const attachText = this.container.querySelector('#attach-text');
        const attachedInfo = this.container.querySelector('#attached-info');
        const systemName = this.container.querySelector('#system-name');
        const loadingSpinner = this.container.querySelector('#loading-spinner');
        // Update button state based on attachment status
        if (button) {
            button.disabled = this.state.attachmentStatus === 'attaching';
            button.classList.toggle('attached', !!this.state.attachedSystemInfo);
            button.classList.toggle('loading', this.state.attachmentStatus === 'attaching');
        }
        // Update loading spinner visibility
        if (loadingSpinner) {
            loadingSpinner.style.display = this.state.attachmentStatus === 'attaching' ? 'inline-block' : 'none';
        }
        if (this.state.attachedSystemInfo) {
            if (attachText)
                attachText.textContent = 'Design System Attached';
            if (systemName)
                systemName.textContent = this.state.attachedSystemInfo.name;
            attachedInfo === null || attachedInfo === void 0 ? void 0 : attachedInfo.classList.add('show');
        }
        else {
            if (attachText)
                attachText.textContent = 'Attach Design System';
            attachedInfo === null || attachedInfo === void 0 ? void 0 : attachedInfo.classList.remove('show');
        }
        this.updateRunButton();
    }
    setOnRunCheck(callback) {
        this.onRunCheck = callback;
    }
    getState() {
        return Object.assign({}, this.state);
    }
    setState(newState) {
        this.state = Object.assign(Object.assign({}, this.state), newState);
        this.validateForm(); // Re-validate when state changes
        this.updateUI();
        this.updateCheckboxes();
    }
}

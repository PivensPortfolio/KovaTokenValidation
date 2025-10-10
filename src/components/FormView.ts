import { ViewStateController } from '../controllers/ViewStateController';

export interface DesignSystemInfo {
  id: string;
  name: string;
  type: 'local-variables' | 'library-variables' | 'local-styles';
  key: string;
  source: 'Local' | 'Library';
  libraryName?: string;
  collectionName?: string;
}

export interface FormViewState {
  selectedDesignSystem: DesignSystemInfo | null;
  validationOptions: string[];
  attachedSystemInfo: DesignSystemInfo | null;
  availableLibraries: DesignSystemInfo[];
  isDropdownOpen: boolean;
  isLoadingLibraries: boolean;
  libraryLoadError: string | null;
  attachmentStatus: 'idle' | 'attaching' | 'attached' | 'error';
  attachmentError: string | null;
  formValidation: {
    hasDesignSystem: boolean;
    hasValidationOptions: boolean;
    showNoOptionsWarning: boolean;
    showNoDesignSystemError: boolean;
  };
}

export class FormView {
  private container: HTMLElement;
  private state: FormViewState;
  private viewController: ViewStateController;
  private onRunCheck?: (options: string[]) => void;

  constructor(container: HTMLElement, viewController: ViewStateController) {
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

  public render(): void {
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

  private attachEventListeners(): void {
    // Handle checkbox interactions
    this.container.querySelectorAll('.checkbox').forEach(checkbox => {
      checkbox.addEventListener('click', () => {
        const option = (checkbox as HTMLElement).dataset.option;
        if (option) {
          this.toggleValidationOption(option);
        }
      });
    });

    // Handle label clicks
    this.container.querySelectorAll('.checkbox-label').forEach(label => {
      label.addEventListener('click', () => {
        const checkbox = label.previousElementSibling as HTMLElement;
        const option = checkbox?.dataset.option;
        if (option) {
          this.toggleValidationOption(option);
        }
      });
    });

    // Handle run check button
    const runButton = this.container.querySelector('#run-check') as HTMLButtonElement;
    runButton?.addEventListener('click', () => {
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
    const attachButton = this.container.querySelector('#attach-design-system') as HTMLButtonElement;
    attachButton?.addEventListener('click', () => {
      if (this.state.attachmentStatus === 'attaching') {
        return; // Prevent clicks while attaching
      }
      
      if (!this.state.attachedSystemInfo) {
        this.toggleDropdown();
      } else {
        this.detachDesignSystem();
      }
    });

    // Handle retry button
    const retryButton = this.container.querySelector('#retry-button') as HTMLButtonElement;
    retryButton?.addEventListener('click', () => {
      this.retryLibraryLoad();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
      const dropdown = this.container.querySelector('#library-dropdown') as HTMLElement;
      const button = this.container.querySelector('#attach-design-system') as HTMLElement;

      if (!button?.contains(event.target as Node) && !dropdown?.contains(event.target as Node)) {
        this.closeDropdown();
      }
    });
  }

  private toggleValidationOption(option: string): void {
    const index = this.state.validationOptions.indexOf(option);
    if (index > -1) {
      this.state.validationOptions.splice(index, 1);
    } else {
      this.state.validationOptions.push(option);
    }
    this.updateCheckboxes();
    this.validateForm();
    this.updateRunButton();
  }

  private updateCheckboxes(): void {
    this.container.querySelectorAll('.checkbox').forEach(checkbox => {
      const option = (checkbox as HTMLElement).dataset.option;
      if (option) {
        if (this.state.validationOptions.includes(option)) {
          checkbox.classList.add('checked');
        } else {
          checkbox.classList.remove('checked');
        }
      }
    });
  }

  private validateForm(): void {
    this.state.formValidation.hasDesignSystem = !!this.state.attachedSystemInfo;
    this.state.formValidation.hasValidationOptions = this.state.validationOptions.length > 0;
    
    // Show warnings/errors based on validation state
    this.state.formValidation.showNoDesignSystemError = !this.state.formValidation.hasDesignSystem;
    this.state.formValidation.showNoOptionsWarning = !this.state.formValidation.hasValidationOptions;
    
    this.updateValidationUI();
  }

  private updateValidationUI(): void {
    const designSystemError = this.container.querySelector('#design-system-error') as HTMLElement;
    const optionsWarning = this.container.querySelector('#options-warning') as HTMLElement;
    const runButtonHelp = this.container.querySelector('#run-button-help') as HTMLElement;
    
    // Design system validation
    if (designSystemError) {
      if (this.state.formValidation.showNoDesignSystemError && !this.state.attachedSystemInfo) {
        designSystemError.classList.add('show');
      } else {
        designSystemError.classList.remove('show');
      }
    }
    
    // Validation options warning
    if (optionsWarning) {
      if (this.state.formValidation.showNoOptionsWarning) {
        optionsWarning.classList.add('show');
      } else {
        optionsWarning.classList.remove('show');
      }
    }
    
    // Update run button help text
    if (runButtonHelp) {
      if (!this.state.formValidation.hasDesignSystem && !this.state.formValidation.hasValidationOptions) {
        runButtonHelp.textContent = 'Please attach a design system and select validation options';
      } else if (!this.state.formValidation.hasDesignSystem) {
        runButtonHelp.textContent = 'Please attach a design system to continue';
      } else if (!this.state.formValidation.hasValidationOptions) {
        runButtonHelp.textContent = 'Please select at least one validation option';
      } else {
        runButtonHelp.textContent = 'Ready to run validation';
        runButtonHelp.classList.add('ready');
      }
    }
  }

  private updateRunButton(): void {
    const runButton = this.container.querySelector('#run-check') as HTMLButtonElement;
    const isFormValid = this.state.formValidation.hasDesignSystem && this.state.formValidation.hasValidationOptions;
    
    if (runButton) {
      runButton.disabled = !isFormValid;
      runButton.classList.toggle('disabled', !isFormValid);
      runButton.classList.toggle('ready', isFormValid);
    }
  }

  private toggleDropdown(): void {
    this.state.isDropdownOpen = !this.state.isDropdownOpen;
    const dropdown = this.container.querySelector('#library-dropdown') as HTMLElement;
    if (dropdown) {
      if (this.state.isDropdownOpen) {
        dropdown.classList.add('show');
      } else {
        dropdown.classList.remove('show');
      }
    }
  }

  private closeDropdown(): void {
    this.state.isDropdownOpen = false;
    const dropdown = this.container.querySelector('#library-dropdown') as HTMLElement;
    dropdown?.classList.remove('show');
  }

  private requestLibraries(): void {
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

  private retryLibraryLoad(): void {
    this.state.libraryLoadError = null;
    this.state.attachmentError = null;
    this.updateErrorState();
    this.requestLibraries();
  }

  private updateLibraryLoadingState(): void {
    const dropdown = this.container.querySelector('#library-dropdown') as HTMLElement;
    if (!dropdown) return;

    if (this.state.isLoadingLibraries) {
      dropdown.innerHTML = '<div class="library-item no-libraries loading">Loading libraries...</div>';
    }
  }

  private updateAttachmentStatus(status: 'idle' | 'attaching' | 'attached' | 'error', message?: string): void {
    this.state.attachmentStatus = status;
    
    const statusIndicator = this.container.querySelector('#status-indicator') as HTMLElement;
    const statusText = this.container.querySelector('#status-text') as HTMLElement;
    const attachmentStatus = this.container.querySelector('#attachment-status') as HTMLElement;
    
    if (!statusIndicator || !statusText || !attachmentStatus) return;

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

  private updateErrorState(): void {
    const errorMessage = this.container.querySelector('#error-message') as HTMLElement;
    const errorText = this.container.querySelector('#error-text') as HTMLElement;
    
    if (!errorMessage || !errorText) return;

    if (this.state.libraryLoadError || this.state.attachmentError) {
      const error = this.state.libraryLoadError || this.state.attachmentError;
      errorText.textContent = error || 'An error occurred';
      errorMessage.classList.add('show');
    } else {
      errorMessage.classList.remove('show');
    }
  }

  private showValidationError(message: string): void {
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

  public updateLibraries(libraries: DesignSystemInfo[], hasError = false, errorMessage = '', debugInfo: any = null): void {
    this.state.isLoadingLibraries = false;
    this.state.availableLibraries = libraries;
    
    const dropdown = this.container.querySelector('#library-dropdown') as HTMLElement;
    if (!dropdown) return;

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

  private selectLibrary(library: DesignSystemInfo): void {
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

  public attachDesignSystem(library: DesignSystemInfo): void {
    this.state.attachedSystemInfo = library;
    this.state.selectedDesignSystem = library;
    this.updateAttachmentStatus('attached', `Successfully attached ${library.name}`);
    this.validateForm(); // Re-validate form when design system is attached
    this.updateUI();
  }

  public attachDesignSystemError(errorMessage: string): void {
    this.state.attachmentError = errorMessage;
    this.updateAttachmentStatus('error', errorMessage);
    this.updateErrorState();
  }

  private detachDesignSystem(): void {
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

  private updateUI(): void {
    const button = this.container.querySelector('#attach-design-system') as HTMLButtonElement;
    const attachText = this.container.querySelector('#attach-text') as HTMLElement;
    const attachedInfo = this.container.querySelector('#attached-info') as HTMLElement;
    const systemName = this.container.querySelector('#system-name') as HTMLElement;
    const loadingSpinner = this.container.querySelector('#loading-spinner') as HTMLElement;

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
      if (attachText) attachText.textContent = 'Design System Attached';
      if (systemName) systemName.textContent = this.state.attachedSystemInfo.name;
      attachedInfo?.classList.add('show');
    } else {
      if (attachText) attachText.textContent = 'Attach Design System';
      attachedInfo?.classList.remove('show');
    }

    this.updateRunButton();
  }

  public setOnRunCheck(callback: (options: string[]) => void): void {
    this.onRunCheck = callback;
  }

  public getState(): FormViewState {
    return { ...this.state };
  }

  public setState(newState: Partial<FormViewState>): void {
    this.state = { ...this.state, ...newState };
    this.validateForm(); // Re-validate when state changes
    this.updateUI();
    this.updateCheckboxes();
  }
}
// State Persistence Manager using Figma clientStorage and sessionStorage

import { FormData, ResultsData, DesignSystemInfo } from '../types/ViewState';

export class PersistenceManager {
  private static readonly KEYS = {
    DESIGN_SYSTEM: 'selectedLibraryId',
    DESIGN_SYSTEM_INFO: 'designSystemInfo',
    VALIDATION_OPTIONS: 'validationOptions',
    RESULTS_DATA: 'resultsData',
    FORM_STATE: 'formState'
  };

  // Design System Persistence (using Figma clientStorage for long-term persistence)
  async saveDesignSystem(systemId: string, systemInfo: DesignSystemInfo): Promise<void> {
    try {
      await figma.clientStorage.setAsync(PersistenceManager.KEYS.DESIGN_SYSTEM, systemId);
      await figma.clientStorage.setAsync(PersistenceManager.KEYS.DESIGN_SYSTEM_INFO, systemInfo);
    } catch (error) {
      console.warn('Failed to save design system to clientStorage:', error);
    }
  }

  async loadDesignSystem(): Promise<{ systemId: string | null; systemInfo: DesignSystemInfo | null }> {
    try {
      const systemId = await figma.clientStorage.getAsync(PersistenceManager.KEYS.DESIGN_SYSTEM);
      const systemInfo = await figma.clientStorage.getAsync(PersistenceManager.KEYS.DESIGN_SYSTEM_INFO);
      
      return {
        systemId: systemId || null,
        systemInfo: systemInfo || null
      };
    } catch (error) {
      console.warn('Failed to load design system from clientStorage:', error);
      return { systemId: null, systemInfo: null };
    }
  }

  async clearDesignSystem(): Promise<void> {
    try {
      await figma.clientStorage.deleteAsync(PersistenceManager.KEYS.DESIGN_SYSTEM);
      await figma.clientStorage.deleteAsync(PersistenceManager.KEYS.DESIGN_SYSTEM_INFO);
    } catch (error) {
      console.warn('Failed to clear design system from clientStorage:', error);
    }
  }

  // Validation Options Persistence (using Figma clientStorage for user preferences)
  async saveValidationOptions(options: string[]): Promise<void> {
    try {
      await figma.clientStorage.setAsync(PersistenceManager.KEYS.VALIDATION_OPTIONS, options);
    } catch (error) {
      console.warn('Failed to save validation options to clientStorage:', error);
    }
  }

  async loadValidationOptions(): Promise<string[]> {
    try {
      const options = await figma.clientStorage.getAsync(PersistenceManager.KEYS.VALIDATION_OPTIONS);
      return options || ['spacings']; // Default to spacings if nothing saved
    } catch (error) {
      console.warn('Failed to load validation options from clientStorage:', error);
      return ['spacings'];
    }
  }

  // Form State Persistence (using Figma clientStorage for user preferences)
  async saveFormData(formData: FormData): Promise<void> {
    try {
      // Save individual components
      if (formData.selectedDesignSystem && formData.attachedSystemInfo) {
        await this.saveDesignSystem(formData.selectedDesignSystem, formData.attachedSystemInfo);
      }
      await this.saveValidationOptions(formData.validationOptions);
    } catch (error) {
      console.warn('Failed to save form data:', error);
    }
  }

  async loadFormData(): Promise<Partial<FormData>> {
    try {
      const { systemId, systemInfo } = await this.loadDesignSystem();
      const validationOptions = await this.loadValidationOptions();

      return {
        selectedDesignSystem: systemId,
        attachedSystemInfo: systemInfo,
        validationOptions
      };
    } catch (error) {
      console.warn('Failed to load form data:', error);
      return {
        selectedDesignSystem: null,
        attachedSystemInfo: null,
        validationOptions: ['spacings']
      };
    }
  }

  // Results Data Persistence (using Figma clientStorage for temporary data)
  async saveResultsData(resultsData: ResultsData): Promise<void> {
    try {
      const serializedData = {
        ...resultsData,
        timestamp: resultsData.timestamp.toISOString()
      };
      await figma.clientStorage.setAsync(PersistenceManager.KEYS.RESULTS_DATA, serializedData);
    } catch (error) {
      console.warn('Failed to save results data to clientStorage:', error);
    }
  }

  async loadResultsData(): Promise<ResultsData | null> {
    try {
      const data = await figma.clientStorage.getAsync(PersistenceManager.KEYS.RESULTS_DATA);
      if (!data) return null;

      return {
        ...data,
        timestamp: new Date(data.timestamp)
      };
    } catch (error) {
      console.warn('Failed to load results data from clientStorage:', error);
      return null;
    }
  }

  async clearResultsData(): Promise<void> {
    try {
      await figma.clientStorage.deleteAsync(PersistenceManager.KEYS.RESULTS_DATA);
    } catch (error) {
      console.warn('Failed to clear results data from clientStorage:', error);
    }
  }

  // Check if results are fresh (within last 5 minutes)
  areResultsFresh(resultsData: ResultsData): boolean {
    const now = new Date();
    const resultAge = now.getTime() - resultsData.timestamp.getTime();
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    return resultAge < fiveMinutes;
  }

  // Clear all persisted data
  async clearAllData(): Promise<void> {
    try {
      await this.clearDesignSystem();
      await figma.clientStorage.deleteAsync(PersistenceManager.KEYS.VALIDATION_OPTIONS);
      this.clearResultsData();
    } catch (error) {
      console.warn('Failed to clear all persisted data:', error);
    }
  }

  // Data migration and cleanup
  async migrateOldData(): Promise<void> {
    try {
      // Check for old data format and migrate if necessary
      // This is a placeholder for future data format changes
      console.log('Checking for data migration needs...');
    } catch (error) {
      console.warn('Failed to migrate old data:', error);
    }
  }
}
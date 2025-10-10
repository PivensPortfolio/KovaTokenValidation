// State Persistence Manager using Figma clientStorage and sessionStorage
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export class PersistenceManager {
    // Design System Persistence (using Figma clientStorage for long-term persistence)
    saveDesignSystem(systemId, systemInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield figma.clientStorage.setAsync(PersistenceManager.KEYS.DESIGN_SYSTEM, systemId);
                yield figma.clientStorage.setAsync(PersistenceManager.KEYS.DESIGN_SYSTEM_INFO, systemInfo);
            }
            catch (error) {
                console.warn('Failed to save design system to clientStorage:', error);
            }
        });
    }
    loadDesignSystem() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const systemId = yield figma.clientStorage.getAsync(PersistenceManager.KEYS.DESIGN_SYSTEM);
                const systemInfo = yield figma.clientStorage.getAsync(PersistenceManager.KEYS.DESIGN_SYSTEM_INFO);
                return {
                    systemId: systemId || null,
                    systemInfo: systemInfo || null
                };
            }
            catch (error) {
                console.warn('Failed to load design system from clientStorage:', error);
                return { systemId: null, systemInfo: null };
            }
        });
    }
    clearDesignSystem() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield figma.clientStorage.deleteAsync(PersistenceManager.KEYS.DESIGN_SYSTEM);
                yield figma.clientStorage.deleteAsync(PersistenceManager.KEYS.DESIGN_SYSTEM_INFO);
            }
            catch (error) {
                console.warn('Failed to clear design system from clientStorage:', error);
            }
        });
    }
    // Validation Options Persistence (using Figma clientStorage for user preferences)
    saveValidationOptions(options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield figma.clientStorage.setAsync(PersistenceManager.KEYS.VALIDATION_OPTIONS, options);
            }
            catch (error) {
                console.warn('Failed to save validation options to clientStorage:', error);
            }
        });
    }
    loadValidationOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const options = yield figma.clientStorage.getAsync(PersistenceManager.KEYS.VALIDATION_OPTIONS);
                return options || ['spacings']; // Default to spacings if nothing saved
            }
            catch (error) {
                console.warn('Failed to load validation options from clientStorage:', error);
                return ['spacings'];
            }
        });
    }
    // Form State Persistence (using Figma clientStorage for user preferences)
    saveFormData(formData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Save individual components
                if (formData.selectedDesignSystem && formData.attachedSystemInfo) {
                    yield this.saveDesignSystem(formData.selectedDesignSystem, formData.attachedSystemInfo);
                }
                yield this.saveValidationOptions(formData.validationOptions);
            }
            catch (error) {
                console.warn('Failed to save form data:', error);
            }
        });
    }
    loadFormData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { systemId, systemInfo } = yield this.loadDesignSystem();
                const validationOptions = yield this.loadValidationOptions();
                return {
                    selectedDesignSystem: systemId,
                    attachedSystemInfo: systemInfo,
                    validationOptions
                };
            }
            catch (error) {
                console.warn('Failed to load form data:', error);
                return {
                    selectedDesignSystem: null,
                    attachedSystemInfo: null,
                    validationOptions: ['spacings']
                };
            }
        });
    }
    // Results Data Persistence (using sessionStorage for temporary data)
    saveResultsData(resultsData) {
        try {
            const serializedData = Object.assign(Object.assign({}, resultsData), { timestamp: resultsData.timestamp.toISOString() });
            sessionStorage.setItem(PersistenceManager.KEYS.RESULTS_DATA, JSON.stringify(serializedData));
        }
        catch (error) {
            console.warn('Failed to save results data to sessionStorage:', error);
        }
    }
    loadResultsData() {
        try {
            const data = sessionStorage.getItem(PersistenceManager.KEYS.RESULTS_DATA);
            if (!data)
                return null;
            const parsed = JSON.parse(data);
            return Object.assign(Object.assign({}, parsed), { timestamp: new Date(parsed.timestamp) });
        }
        catch (error) {
            console.warn('Failed to load results data from sessionStorage:', error);
            return null;
        }
    }
    clearResultsData() {
        try {
            sessionStorage.removeItem(PersistenceManager.KEYS.RESULTS_DATA);
        }
        catch (error) {
            console.warn('Failed to clear results data from sessionStorage:', error);
        }
    }
    // Check if results are fresh (within last 5 minutes)
    areResultsFresh(resultsData) {
        const now = new Date();
        const resultAge = now.getTime() - resultsData.timestamp.getTime();
        const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
        return resultAge < fiveMinutes;
    }
    // Clear all persisted data
    clearAllData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.clearDesignSystem();
                yield figma.clientStorage.deleteAsync(PersistenceManager.KEYS.VALIDATION_OPTIONS);
                this.clearResultsData();
            }
            catch (error) {
                console.warn('Failed to clear all persisted data:', error);
            }
        });
    }
    // Data migration and cleanup
    migrateOldData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check for old data format and migrate if necessary
                // This is a placeholder for future data format changes
                console.log('Checking for data migration needs...');
            }
            catch (error) {
                console.warn('Failed to migrate old data:', error);
            }
        });
    }
}
PersistenceManager.KEYS = {
    DESIGN_SYSTEM: 'selectedLibraryId',
    DESIGN_SYSTEM_INFO: 'designSystemInfo',
    VALIDATION_OPTIONS: 'validationOptions',
    RESULTS_DATA: 'resultsData',
    FORM_STATE: 'formState'
};

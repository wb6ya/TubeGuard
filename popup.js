document.addEventListener("DOMContentLoaded", () => {
    // 1. A single object to hold all UI elements for clean access
    const elements = {
        isEnabledToggle: document.getElementById("isEnabled"),
        promptToggle: document.getElementById("promptOnVideo"),
        hoursInput: document.getElementById("limitHours"),
        minutesInput: document.getElementById("limitMinutes"),
        saveButton: document.getElementById("saveButton"),
        langToggleButton: document.getElementById("langToggleButton"),
        remainingTimeDisplay: document.getElementById("remainingTimeDisplay"),
        i18nElements: document.querySelectorAll('[data-i18n]')
    };

    let isInitialized = false; // A flag to prevent settings from resetting while the user types

    // 2. Main function to update the entire UI
    async function updateLiveUI() {
        const data = await chrome.storage.local.get([
            'isEnabled', 'promptOnVideo', 'timeLimitInMinutes', 
            'dailyRecord', 'currentLang'
        ]);

        const currentLang = data.currentLang || 'ar';

        // This part runs only once when the popup is first opened
        if (!isInitialized) {
            applyLanguage(currentLang);
            updateSettingsDisplay(data);
            isInitialized = true;
        }

        // This part runs every second to keep the timer live and accurate
        updateTimerDisplay(data);
    }

    // 3. Helper Functions

    function applyLanguage(lang) {
        // Translate all marked elements
        elements.i18nElements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[lang]?.[key]) {
                el.textContent = translations[lang][key];
            }
        });
        // Update the language toggle button's text
        elements.langToggleButton.textContent = lang === 'ar' ? 'EN' : 'العربية';
        document.documentElement.lang = lang;
    }

    function updateSettingsDisplay(data) {
        elements.isEnabledToggle.checked = data.isEnabled ?? true;
        elements.promptToggle.checked = data.promptOnVideo ?? false;
        const totalMinutes = data.timeLimitInMinutes || 90;
        elements.hoursInput.value = Math.floor(totalMinutes / 60);
        elements.minutesInput.value = totalMinutes % 60;
    }
    
    function updateTimerDisplay(data) {
        const limitInSeconds = (data.timeLimitInMinutes || 90) * 60;
        const watchedSeconds = data.dailyRecord?.watchedSeconds || 0;
        const remainingSeconds = Math.max(0, limitInSeconds - watchedSeconds);

        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        const seconds = remainingSeconds % 60;

        elements.remainingTimeDisplay.textContent = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    async function saveSettings() {
        const hours = parseInt(elements.hoursInput.value) || 0;
        const minutes = parseInt(elements.minutesInput.value) || 0;
        const totalMinutes = (hours * 60) + minutes;
        
        const todayStr = new Date().toISOString().slice(0, 10);
        const newRecord = { date: todayStr, watchedSeconds: 0 };

        await chrome.storage.local.set({ 
            isEnabled: elements.isEnabledToggle.checked,
            promptOnVideo: elements.promptToggle.checked,
            timeLimitInMinutes: totalMinutes,
            dailyRecord: newRecord 
        });

        // Provide visual feedback
        const lang = (await chrome.storage.local.get('currentLang')).currentLang || 'ar';
        const originalText = translations[lang].saveButton;
        elements.saveButton.textContent = translations[lang].saveConfirm;
        elements.saveButton.style.backgroundColor = "var(--success-color)";
        setTimeout(() => {
            elements.saveButton.textContent = originalText;
            elements.saveButton.style.backgroundColor = "var(--primary-color)";
        }, 1500);
    }

    async function toggleLanguage() {
        let { currentLang } = await chrome.storage.local.get('currentLang');
        currentLang = (currentLang === 'ar') ? 'en' : 'ar';
        await chrome.storage.local.set({ currentLang: currentLang });
        applyLanguage(currentLang);
    }

    // 4. Initialization
    
    // Run the update function immediately, then repeat it every second
    updateLiveUI();
    setInterval(updateLiveUI, 1000);

    // Attach event listeners to buttons
    elements.saveButton.addEventListener("click", saveSettings);
    elements.langToggleButton.addEventListener("click", toggleLanguage);
});
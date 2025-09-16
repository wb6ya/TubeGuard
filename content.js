const YouTubeLimiter = {
    // 1. الحالة الداخلية للإضافة
    timeCountingInterval: null,
    lastVideoId: null,

    // 2. نقطة البداية (التشغيل)
    init: function() {
        // نبحث عن الفيديو حتى نجده
        const videoFinderInterval = setInterval(() => {
            const video = document.querySelector('video');
            if (video) {
                clearInterval(videoFinderInterval);
                console.log("YouTube Limiter Initialized.");
                this.addEventListeners(video);

                if (!video.paused) {
                    this.handlePlay(video);
                }
            }
        }, 1000);
        
        // نضيف مستمعًا يراقب أي تغييرات في الذاكرة
        chrome.storage.onChanged.addListener((changes) => {
            // إذا تغيرت اللغة، قم بتحديث التاق على الشاشة
            if (changes.currentLang) {
                this.createOrUpdateTag();
            }
        });
    },

    // 3. إدارة الأحداث
    addEventListeners: function(video) {
        video.addEventListener('play', () => this.handlePlay(video));
        video.addEventListener('pause', () => clearInterval(this.timeCountingInterval));
        video.addEventListener('ended', () => clearInterval(this.timeCountingInterval));
    },

    // 4. المنطق الرئيسي عند تشغيل الفيديو
    handlePlay: async function(video) {
        if (sessionStorage.getItem('educationalPass') === window.location.href) return;

        const settings = await chrome.storage.local.get(['promptOnVideo', 'isEnabled', 'currentLang']);
        if (settings.isEnabled === false) return;

        const lang = settings.currentLang || 'ar';

        if (settings.promptOnVideo === false) {
            this.startTimer();
            return;
        }

        const videoId = new URLSearchParams(window.location.search).get('v');
        const videoType = sessionStorage.getItem(videoId);

        if (this.lastVideoId !== videoId) {
            this.lastVideoId = videoId;
            if (!videoType) {
                video.pause();
                this.showClassificationPrompt(video, videoId, lang);
                return;
            }
        }
        
        if (videoType === 'ترفيهي') {
            this.startTimer();
        } else if (videoType === 'تعليمي') {
            clearInterval(this.timeCountingInterval);
        }
    },

    // 5. الدوال المساعدة
    startTimer: function() {
        clearInterval(this.timeCountingInterval);
        this.timeCountingInterval = setInterval(() => this.updateTime(), 1000);
    },

    updateTime: async function() {
        if (sessionStorage.getItem('educationalPass') === window.location.href) {
            clearInterval(this.timeCountingInterval);
            return;
        }
        
        const data = await chrome.storage.local.get(['dailyRecord', 'timeLimitInMinutes', 'isEnabled', 'currentLang']);
        if (data.isEnabled === false) {
            clearInterval(this.timeCountingInterval);
            return;
        }

        const lang = data.currentLang || 'ar';
        const todayStr = new Date().toISOString().slice(0, 10);
        let record = data.dailyRecord || { date: todayStr, watchedSeconds: 0 };
        if (record.date !== todayStr) {
            record = { date: todayStr, watchedSeconds: 0 };
        }
        
        const limitInSeconds = (data.timeLimitInMinutes || 60) * 60;
        if (record.watchedSeconds >= limitInSeconds) {
            clearInterval(this.timeCountingInterval);
            const video = document.querySelector('video');
            if (video) video.pause();
            this.showBlocker(video, lang);
            return;
        }

        record.watchedSeconds++;
        await chrome.storage.local.set({ dailyRecord: record });
        
        const videoId = new URLSearchParams(window.location.search).get('v');
        if (sessionStorage.getItem(videoId)) {
            this.createOrUpdateTag();
        }
    },
    
    createOrUpdateTag: async function() {
        const data = await chrome.storage.local.get(['dailyRecord', 'timeLimitInMinutes', 'currentLang']);
        const lang = data.currentLang || 'ar';
        
        const videoId = new URLSearchParams(window.location.search).get('v');
        let videoTypeInternal = sessionStorage.getItem(videoId);
        let videoTypeDisplay = translations[lang].tagUndefinedType;

        if (videoTypeInternal === 'ترفيهي') {
            videoTypeDisplay = translations[lang].entertainmentButton.split(' ')[0];
        } else if (videoTypeInternal === 'تعليمي') {
            videoTypeDisplay = translations[lang].educationalButton.split(' ')[0];
        }

        const limitInSeconds = (data.timeLimitInMinutes || 90) * 60;
        const watchedSeconds = data.dailyRecord?.watchedSeconds || 0;
        const remainingSeconds = Math.max(0, limitInSeconds - watchedSeconds);
        const h = String(Math.floor(remainingSeconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, '0');
        const s = String(remainingSeconds % 60).padStart(2, '0');
        const remainingTimeText = `${h}:${m}:${s}`;
        
        let tag = document.getElementById('yt-limiter-tag');
        if (!tag) {
            tag = document.createElement('div');
            tag.id = 'yt-limiter-tag';
            tag.className = 'yt-limiter-tag';
            document.querySelector('#movie_player')?.appendChild(tag);
        }

        const typeLabel = translations[lang].tagTypeLabel;
        const remainingLabel = translations[lang].tagRemainingLabel;
        tag.innerHTML = `<span class="tag-item">${typeLabel} ${videoTypeDisplay}</span> | <span class="tag-item">${remainingLabel} ${remainingTimeText}</span>`;
    },

    showBlocker: function(video, lang) {
        if (document.getElementById('yt-limiter-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'yt-limiter-overlay';
        overlay.className = 'yt-limiter-overlay';
        const card = document.createElement('div');
        card.className = 'yt-limiter-card';
        const title = document.createElement('h2');
        title.className = 'yt-limiter-title';
        title.textContent = translations[lang].blockerMessage;
        const bypassButton = document.createElement('button');
        bypassButton.className = 'yt-limiter-button yt-limiter-button--secondary';
        bypassButton.textContent = translations[lang].bypassButton;
        
        bypassButton.addEventListener('click', () => {
            sessionStorage.setItem('educationalPass', window.location.href);
            overlay.remove();
            if (video) video.play();
        });

        card.appendChild(title);
        card.appendChild(bypassButton);
        overlay.appendChild(card);
        document.querySelector('#movie_player')?.appendChild(overlay);
    },

    showClassificationPrompt: function(video, videoId, lang) {
        if (document.getElementById('yt-limiter-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'yt-limiter-overlay';
        overlay.className = 'yt-limiter-overlay';
        const card = document.createElement('div');
        card.className = 'yt-limiter-card';
        const title = document.createElement('h2');
        title.className = 'yt-limiter-title';
        title.textContent = translations[lang].promptTitle;
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'yt-limiter-button-group';
        const entertainmentButton = document.createElement('button');
        entertainmentButton.className = 'yt-limiter-button yt-limiter-button--primary';
        entertainmentButton.textContent = translations[lang].entertainmentButton;
        const educationalButton = document.createElement('button');
        educationalButton.className = 'yt-limiter-button yt-limiter-button--secondary';
        educationalButton.textContent = translations[lang].educationalButton;
        
        entertainmentButton.addEventListener('click', () => {
            sessionStorage.setItem(videoId, 'ترفيهي');
            overlay.remove();
            this.createOrUpdateTag();
            this.startTimer();
            video.play();
        });
        educationalButton.addEventListener('click', () => {
            sessionStorage.setItem(videoId, 'تعليمي');
            overlay.remove();
            this.createOrUpdateTag();
            video.play();
        });

        buttonGroup.appendChild(entertainmentButton);
        buttonGroup.appendChild(educationalButton);
        card.appendChild(title);
        card.appendChild(buttonGroup);
        overlay.appendChild(card);
        document.querySelector('#movie_player')?.appendChild(overlay);
    }
};

// 6. تشغيل الإضافة
YouTubeLimiter.init();
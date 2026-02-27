// storage.js
export const Storage = {
    save(key, val) {
        try {
            const str = JSON.stringify(val);
            const obfuscated = btoa(encodeURIComponent(str));
            localStorage.setItem(key, obfuscated);
        } catch (e) {
            console.error("Storage save err:", e);
        }
    },
    load(key, defaultVal) {
        try {
            const item = localStorage.getItem(key);
            if (!item) return defaultVal;

            // Check if legacy plaintext JSON or raw strings
            if (item.startsWith('[') || item.startsWith('{') || !isNaN(item) || item === 'true' || item === 'false' || item === 'ru' || item === 'az') {
                const val = (item === 'ru' || item === 'az' || (!item.includes('{') && !item.includes('[')))
                    ? item
                    : JSON.parse(item);
                this.save(key, val); // migrate to obfuscated
                return val;
            }

            const str = decodeURIComponent(atob(item));
            return JSON.parse(str);
        } catch (e) {
            return defaultVal;
        }
    },
    remove(key) {
        localStorage.removeItem(key);
    },
    clearAll() {
        this.remove('candyBlitz_volume');
        this.remove('candyBlitz_sfxVolume');
        this.remove('hintsEnabled');
        this.remove('gameCompleted');
    }
};

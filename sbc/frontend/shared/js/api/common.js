export const API_BASE_URL = window.location.host;

export const getApiUrl = (path) => `/api/${path}`;

export const DEBUG_MODE = await (async () => {
    try {
        await fetch(getApiUrl("ping"), {
            signal: AbortSignal.timeout(500)
        });
        return false;
    } catch (error) {
        console.log(error);
        return true;
    }
})();
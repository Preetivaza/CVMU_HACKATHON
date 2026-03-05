export async function authFetch(url, options = {}) {
    let token = null;

    // Next.js client side checks
    if (typeof window !== 'undefined') {
        token = localStorage.getItem('rdd_token');
    }

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        console.warn(`[authFetch] Warning: No token found when requesting ${url}`);
    }

    const config = {
        ...options,
        headers,
    };

    const response = await fetch(url, config);

    // If unauthorized via client, automatically jump to login
    if (response.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('rdd_token');
        localStorage.removeItem('rdd_user');
        window.location.href = '/login';
    }

    return response;
}

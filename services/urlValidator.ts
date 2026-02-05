// services/urlValidator.ts

interface ValidationResult {
    url: string;
    isValid: boolean;
    statusCode: number | null;
    redirectUrl: string | null;
    contentType: string | null;
    failureReason: string | null;
}

export const validateUrls = async (
    urls: string[],
    timeoutMs: number = 3000
): Promise<Map<string, ValidationResult>> => {
    const results = new Map<string, ValidationResult>();
    
    const validationPromises = urls.map(async (url) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            // Use HEAD to minimize bandwidth
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
                redirect: 'follow'
            });
            
            clearTimeout(timeoutId);
            
            const isValidProductPage = 
                response.status === 200 &&
                !response.url.includes('/search') &&
                !response.url.includes('/category') &&
                !response.url.includes('/404');
            
            results.set(url, {
                url,
                isValid: isValidProductPage,
                statusCode: response.status,
                redirectUrl: response.url !== url ? response.url : null,
                contentType: response.headers.get('content-type'),
                failureReason: isValidProductPage ? null : 
                    response.status !== 200 ? `HTTP ${response.status}` : 'Redirected to non-product page'
            });
        } catch (error: any) {
            results.set(url, {
                url,
                isValid: false,
                statusCode: null,
                redirectUrl: null,
                contentType: null,
                failureReason: error.name === 'AbortError' ? 'Timeout' : error.message
            });
        }
    });
    
    await Promise.all(validationPromises);
    return results;
};
// ================= CONFIGURATION =================
const CONFIG = {
    YOUR_API_KEYS: ["SPLEXXO_TRUE", "TESTKEY"], // Apni secret keys
    
    // RapidAPI Config (Jo tumne curl mein diya)
    RAPID_HOST: "truecaller-data2.p.rapidapi.com",
    RAPID_KEY: "68dd515dd3mshe757fcf6151ac56p152e78jsn96ec259df288", 
    
    BASE_URL: "https://truecaller-data2.p.rapidapi.com/search/",

    CACHE_TIME: 24 * 60 * 60 * 1000, // 24 Hours Cache (Phone info jaldi change nahi hoti)
    
    BRANDING: {
        service: "Splexxo-Truecaller",
        type: "Premium Lookup",
        powered_by: "Splexxo Infrastructure"
    }
};
// =================================================

const cache = new Map();

export default async function handler(req, res) {
    // 1. CORS Headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    // 2. Input Parameters
    const { mobile: rawMobile, key: rawKey } = req.query;

    if (!rawMobile || !rawKey) {
        return res.status(400).json({
            status: false,
            error: "Missing parameters.",
            message: "Format: ?mobile=919999999999&key=SPLEXXO_TRUE"
        });
    }

    // Number saaf karna (sirf digits)
    const mobile = String(rawMobile).replace(/\D/g, ""); 
    const key = String(rawKey).trim();

    // 3. API Key Check
    if (!CONFIG.YOUR_API_KEYS.includes(key)) {
        return res.status(403).json({ status: false, error: "Invalid Splexxo API Key" });
    }

    // 4. Cache Check (RapidAPI credits bachane ke liye zaroori hai)
    const now = Date.now();
    const cachedData = cache.get(mobile);
    if (cachedData && (now - cachedData.timestamp < CONFIG.CACHE_TIME)) {
        res.setHeader("X-Proxy-Cache", "HIT");
        return res.status(200).json(cachedData.response);
    }

    // 5. RapidAPI Call
    try {
        const targetUrl = `${CONFIG.BASE_URL}${mobile}`;
        
        const response = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "x-rapidapi-host": CONFIG.RAPID_HOST,
                "x-rapidapi-key": CONFIG.RAPID_KEY
            }
        });

        // RapidAPI errors handle karna
        if (response.status === 429) {
            throw new Error("RapidAPI Quota Exceeded (Limit khatam ho gayi)");
        }
        if (!response.ok) {
            throw new Error(`Upstream Error: ${response.status}`);
        }

        const data = await response.json();

        // 6. Response Branding
        // (Jo bhi data aayega, usme apna thappa lagayenge)
        const brandedResponse = {
            ...CONFIG.BRANDING,
            status: "success",
            lookup_number: mobile,
            data: data.data || data // API structure ke hisab se data nikalna
        };

        // 7. Cache Save & Send
        // Agar valid data hai tabhi cache karo
        if (brandedResponse.data) {
            cache.set(mobile, { timestamp: now, response: brandedResponse });
        }
        
        res.setHeader("X-Proxy-Cache", "MISS");
        return res.status(200).json(brandedResponse);

    } catch (error) {
        return res.status(500).json({
            status: false,
            error: "Lookup Failed",
            details: error.message
        });
    }
}

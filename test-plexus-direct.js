const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

async function test() {
    const query = "Qui est le président de la France ?";
    console.log("1. Test SearXNG...");
    try {
        const res = await fetch("http://localhost:8080/search?q=" + encodeURIComponent(query) + "&format=json");
        const data = await res.json();
        console.log("SearXNG OK:", data.results.length, "résultats");

        console.log("2. Test OpenRouter...");
        const apiKey = process.env.OPENROUTER_API_KEY;
        const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "google/gemini-2.0-pro-exp-02-05:free",
                messages: [{ role: "user", content: "Dis coucou" }]
            })
        });
        const orData = await orRes.json();
        console.log("OpenRouter Response:", JSON.stringify(orData));
        if (orData.choices) {
            console.log("OpenRouter Content:", orData.choices[0].message.content);
        }
    } catch (e) {
        console.error("ERREUR:", e.message);
    }
}

test();

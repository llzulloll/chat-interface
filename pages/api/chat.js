export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { message } = req.body;

    // Build the Gemini API URL with the API key from your environment variable.
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    try {
        const response = await fetch(geminiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{
                            text: `Answer in maximum 150 words, but concise when you can:\n\n${message}`,
                        }],
                    },
                ],
            }),
        });

        const data = await response.json();
        console.log("Gemini API response:", data);
        // console.log("Full Gemini API response:", JSON.stringify(data, null, 2));
        if (!response.ok) {
            return res
                .status(response.status)
                .json({ error: data.error || "Gemini API error" });
        }

        let reply = "No reply from Gemini API";
        if (
            data.candidates &&
            data.candidates.length > 0 &&
            data.candidates[0].content &&
            data.candidates[0].content.parts &&
            data.candidates[0].content.parts.length > 0
        ) {
            reply = data.candidates[0].content.parts[0].text || reply;
        }

        res.status(200).json({ reply });
    } catch (error) {
        console.error("Gemini API error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}
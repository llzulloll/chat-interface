export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { messages } = req.body;

    // Convert the conversation array into a single text block
    const conversationText = messages
        .map((m) => (m.sender === "user" ? `User: ${m.text}` : `Bot: ${m.text}`))
        .join("\n");

    const limitedConversationText = conversationText.slice(0, 1000);
    // Build the Gemini API URL with your API key
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;


    try {
        const response = await fetch(geminiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            // Replace the existing fetch body with this:
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{
                            text: `Provide a short, concise title (MAX SEVEN WORDS, NO BOLDING) for the following conversation:\n\n${limitedConversationText}`,
                        }]
                    }
                ]
            }),
        });

        const data = await response.json();
        console.log("Summarize API response:", data);

        if (!response.ok) {
            return res
                .status(response.status)
                .json({ error: data.error || "Gemini API error" });
        }

        let summary = "Untitled Conversation";
        if (
            data.candidates &&
            data.candidates.length > 0 &&
            data.candidates[0].content &&
            data.candidates[0].content.parts &&
            data.candidates[0].content.parts.length > 0
        ) {
            summary = data.candidates[0].content.parts[0].text.trim();
        }

        return res.status(200).json({ summary });
    } catch (error) {
        console.error("Summarize API error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
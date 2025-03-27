'use client';
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatUI() {
    // Always call hooks
    const [hasMounted, setHasMounted] = useState(false);
    const defaultGreeting = { text: "Hello! How can I help you today?", sender: "bot" };
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [messages, setMessages] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("chatMessages");
            return saved ? JSON.parse(saved) : [defaultGreeting];
        }
        return [defaultGreeting];
    });

    const [pastSessions, setPastSessions] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("pastChatSessions");
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });

    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [showPastSessions, setShowPastSessions] = useState(false);
    const [activeTab, setActiveTab] = useState("current");
    const [currentConversation, setCurrentConversation] = useState(messages);

    const chatContainerRef = useRef(null);
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);

    // Auto-scroll to latest message
    useEffect(() => {
        chatContainerRef.current?.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [messages]);

    // Auto-focus the input on mount and when window regains focus
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
        const handleWindowFocus = () => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        };
        window.addEventListener("focus", handleWindowFocus);
        return () => {
            window.removeEventListener("focus", handleWindowFocus);
        };
    }, []);

    // Save messages to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem("chatMessages", JSON.stringify(messages));
    }, [messages]);

    // Save past sessions to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem("pastChatSessions", JSON.stringify(pastSessions));
    }, [pastSessions]);

    useEffect(() => {
        if (activeTab === "current") {
            setCurrentConversation(messages);
        }
    }, [messages, activeTab]);

    // Use Speech Synthesis to speak text aloud
    const speakText = (text) => {
        if ("speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.speak(utterance);
        }
    };

    const sendMessage = async () => {
        if (!input.trim()) return;
        const newMessage = { text: input, sender: "user" };
        setMessages((prev) => [...prev, newMessage]);
        setInput("");
        setIsTyping(true);

        try {
            const response = await axios.post("/api/chat", { message: input });
            const botMessage = { text: response.data.reply, sender: "bot" };
            setMessages((prev) => [...prev, botMessage]);
            speakText(response.data.reply);
        } catch (error) {
            setMessages((prev) => [...prev, { text: "Error getting response.", sender: "bot" }]);
        }

        setIsTyping(false);
    };

    // Start speech recognition to convert voice to text
    const startVoiceRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition is not supported in your browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.start();

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
        };

        recognition.onend = () => {
            recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
    };

    // Summarize + Save current session, then start a new session
    const newSession = async () => {
        // Always use the working conversation stored in currentConversation
        const conversationToSave = currentConversation;

        // Only save if there's more than just the default greeting
        if (conversationToSave.length > 1) {
            try {
                // 1) Summarize the conversation
                const summarizeRes = await axios.post("/api/summarize", { messages: conversationToSave });
                const summaryTitle = summarizeRes.data.summary || "Untitled Conversation";

                // 2) Create a session object with a 'title'
                const session = {
                    id: Date.now(),
                    timestamp: new Date().toLocaleString(),
                    title: summaryTitle,
                    messages: conversationToSave,
                };

                // 3) Add it to the front of the pastSessions array
                setPastSessions((prev) => [session, ...prev]);
            } catch (error) {
                console.error("Error summarizing session:", error);

                // Fallback: if summarize fails, still save the session with a fallback title
                const session = {
                    id: Date.now(),
                    timestamp: new Date().toLocaleString(),
                    title: "Error Summarizing",
                    messages: conversationToSave,
                };
                setPastSessions((prev) => [session, ...prev]);
            }
        }

        // Reset the conversation to default greeting and update current conversation and activeTab
        setMessages([defaultGreeting]);
        setCurrentConversation([defaultGreeting]);
        setActiveTab("current");
    };

    // Load a past session
    const loadSession = (session) => {
        if (activeTab === "current") {
            setCurrentConversation(messages);
        }
        setMessages(session.messages);
        setActiveTab(session.id);
        setShowPastSessions(false);
    };

    // Delete a session
    const deleteSession = (sessionId) => {
        const updatedSessions = pastSessions.filter((session) => session.id !== sessionId);
        setPastSessions(updatedSessions);
        localStorage.setItem("pastChatSessions", JSON.stringify(updatedSessions));
    };

    // Mark component as mounted
    useEffect(() => {
        setHasMounted(true);
    }, []);

    // Only after all hooks are called, conditionally render UI based on mounting
    if (!hasMounted) {
        return <div className="h-screen flex items-center justify-center">Loading...</div>;
    }

    return (
        <div className="flex h-screen bg-[#212121] text-white">
            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 h-full bg-[#2a2a2a] w-64 shadow-lg transform transition-transform duration-300 z-50 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full pt-16 px-4">
                    <button
                        onClick={newSession}
                        className="bg-[#74AA9C] text-white px-3 py-2 rounded-full shadow hover:bg-[#5e8f87] transition-colors w-full mb-4"
                    >
                        New Chat
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab("current");
                            setMessages(currentConversation);
                            setIsSidebarOpen(false);
                        }}
                        className={`block w-full text-left px-4 py-2 rounded mb-2 ${activeTab === "current" ? "bg-[#74AA9C] text-white" : "bg-[#343434] text-gray-300"
                            }`}
                    >
                        Current Conversation
                    </button>

                    {pastSessions.map((session) => (
                        <div key={session.id} className="mb-2 flex items-center justify-between">
                            <button
                                onClick={() => {
                                    setActiveTab(session.id);
                                    setMessages(session.messages);
                                    setIsSidebarOpen(false);
                                }}
                                className={`block flex-1 text-left px-4 py-2 rounded ${activeTab === session.id ? "bg-[#74AA9C] text-white" : "bg-[#343434] text-gray-300"
                                    }`}
                            >
                                {session.title}
                            </button>
                            <button
                                onClick={() => deleteSession(session.id)}
                                className="ml-2 text-red-500 hover:text-red-700 p-1 rounded"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4a1 1 0 011 1v2H9V4a1 1 0 011-1z"
                                    />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Panel */}
            <div className={`flex flex-col flex-1 transition-all duration-300 ${isSidebarOpen ? "ml-64" : ""}`}>
                {/* Header */}
                <header className="bg-[#74AA9C] text-white py-4 px-6 shadow-md flex items-center justify-between">
                    <div className="flex items-center space-x-4 pl-12">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="focus:outline-none fixed top-4 left-4 z-50 bg-[#74AA9C] p-2 rounded-md shadow-md hover:bg-[#5e8f87]"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 6h16.5m-16.5 6h16.5" />
                            </svg>
                        </button>
                        <h1 className="text-2xl font-bold">AI Chat</h1>
                    </div>
                    <button
                        onClick={newSession}
                        className="bg-[#74AA9C] text-white px-3 py-1 rounded-full shadow hover:bg-[#5e8f87] transition-colors"
                    >
                        New Chat
                    </button>
                </header>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={chatContainerRef}>
                    {messages.map((msg, idx) => {
                        const isUser = msg.sender === "user";
                        return (
                            <div
                                key={idx}
                                className={`p-4 rounded-xl shadow max-w-[80%] ${isUser
                                    ? "bg-[#74AA9C] text-white self-end ml-auto rounded-br-none"
                                    : "bg-[#343434] text-gray-300 self-start mr-auto rounded-bl-none"
                                    }`}
                            >
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                            </div>
                        );
                    })}
                    {isTyping && (
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce animation-delay-200"></div>
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce animation-delay-400"></div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <footer className="p-4 bg-[#2a2a2a] shadow-inner">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-1 items-center border border-gray-600 rounded-full bg-[#343434] px-4">
                            <input
                                ref={inputRef}
                                className="flex-1 bg-transparent text-white py-2 focus:outline-none"
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') sendMessage();
                                }}
                                placeholder="Type a message..."
                            />
                            <button
                                onClick={startVoiceRecognition}
                                className="ml-2  text-white rounded-full p-2 hover:bg-green-600"
                            >
                                🎤
                            </button>
                        </div>
                        <button
                            onClick={sendMessage}
                            className="bg-[#74AA9C] text-white rounded-full px-6 py-2 shadow hover:bg-[#5e8f87] transition-colors"
                        >
                            Send
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
import { useNavigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import SocketContext from "../context/socketContext";
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import GroupInfo from "./GroupInfo";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCallback } from "react";
import { BACKEND_URL } from "./GlobalVariable";

export default function GroupPage() {
  const { socket } = React.useContext(SocketContext);
  const navigate = useNavigate();
  const [codes, setCodes] = useState({});
  const [output, setOutput] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const editorRef = useRef(null);
  const ydocRef = useRef(null);
  const yTextRef = useRef(null);
  const undoManagerRef = useRef(null);
  const chatEndRef = useRef(null);

  const userId = localStorage.getItem("user-data")
    ? JSON.parse(localStorage.getItem("user-data"))._id
    : null;
  const username = localStorage.getItem("user-data")
    ? JSON.parse(localStorage.getItem("user-data")).username
    : "";

  const { groupId } = useParams();

  // --- NEW: bind editor to Yjs properly ---
  const bindEditorToYjs = useCallback((editor, yText) => {
    if (!editor || !yText) return;

    const model = editor.getModel();
    model.setValue(yText.toString());

    // Flag to prevent loop
    let updatingFromYjs = false;

    // Editor changes → Yjs
    const editorListener = editor.onDidChangeModelContent((event) => {
      if (updatingFromYjs) return;
      const value = editor.getValue();
      if (yText.toString() !== value) {
        yText.doc.transact(() => {
          yText.delete(0, yText.length);
          yText.insert(0, value);
        });
      }
    });

    const yjsObserver = (event) => {
      const yContent = yText.toString();
      if (model.getValue() !== yContent) {
        const cursor = editor.getPosition();
        updatingFromYjs = true;
        model.pushEditOperations(
          [],
          [{ range: model.getFullModelRange(), text: yContent }],
          () => [cursor] // restore cursor
        );
        updatingFromYjs = false;
      }
    };
    yText.observe(yjsObserver);

    // Cleanup function
    return () => {
      editorListener.dispose();
      yText.unobserve(yjsObserver);
    };
  }, []);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    if (ydocRef.current && yTextRef.current) {
      bindEditorToYjs(editor, yTextRef.current)();
    }
  };

  useEffect(() => {
    if (!groupId || !socket) return;

    const ydoc = new Y.Doc();
    const yText = ydoc.getText("text");
    const undoManager = new Y.UndoManager(yText);

    ydocRef.current = ydoc;
    yTextRef.current = yText;
    undoManagerRef.current = undoManager;

    // Socket callbacks
    const handleSync = (initialContent) => {
      if (initialContent && yText.toString() === "") {
        yText.insert(0, initialContent);
      }
    };

    const handleDocumentUpdate = (update) => {
      Y.applyUpdate(ydoc, new Uint8Array(update));
    };

    socket.on("sync", handleSync);
    socket.on("documentUpdated", handleDocumentUpdate);

    let unbindEditor = null;
    if (editorRef.current) {
      unbindEditor = bindEditorToYjs(editorRef.current, yText);
    }

    return () => {
      socket.off("sync", handleSync);
      socket.off("documentUpdated", handleDocumentUpdate);
      if (unbindEditor) unbindEditor();
      ydoc.destroy();
      ydocRef.current = null;
      yTextRef.current = null;
      undoManagerRef.current = null;
    };
  }, [groupId, socket, bindEditorToYjs]);

  useEffect(() => {
    if (!ydocRef.current || !socket || !groupId) return;

    const observer = () => {
      const update = Y.encodeStateAsUpdate(ydocRef.current);
      socket.emit("updateDocument", Array.from(update));
    };
    ydocRef.current.on("update", observer);

    return () => {
      if (ydocRef.current) ydocRef.current.off("update", observer);
    };
  }, [socket, groupId]);



  const fetchCodeGroup = async (lang) => {
  try {
    const res = await axios.post(
      `${BACKEND_URL}/getCodeGroup`,
      { language: lang, groupId },
      { withCredentials: true }
    );

    const data = res.data;
    const initialCode = data.code || "// Write your code here";

    // Update local state
    setCodes((prev) => ({ ...prev, [lang]: initialCode }));

    // ALSO update Yjs text
    if (yTextRef.current && yTextRef.current.toString() === "") {
      yTextRef.current.insert(0, initialCode);
    }

  } catch (err) {
    console.error("Failed to fetch code", err);
  }
};


  useEffect(() => {
    if (language) {
      fetchCodeGroup(language);
    }
  }, [language]);

  // Modify your existing useEffect for previous messages
  useEffect(() => {
    if (!socket || !groupId) return;
  
    socket.emit("joinGroup", groupId);
  
    socket.on("previousMessages", (msgs) => {
      setMessages(msgs);
      setTimeout(() => {
        if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: "auto" });
        }
      }, 100); // Small timeout to ensure DOM updates
    });
  
    socket.on("newMessage", (message) => {
      setMessages((prev) => [...prev, message]);
      console.log("Message received");
    });

    socket.on("getOnlineUsers", (users) => {
      console.log("Online users:", users);
      setOnlineUsers(users); // users is an array of userIds
    });
  
    return () => {
      socket.emit("leaveGroup", groupId);
      socket.off("previousMessages");
      socket.off("newMessage");
    };
  }, [socket, groupId]);
  
  // Scroll to bottom on message update
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = () => {
    if (message.trim() === "") return;

    socket.emit("sendMessage", {
      username: username,
      groupId,
      messageContent: message,
      userId,
    });

    setMessage("");
  };

  const debounce = (func, delay) => {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => func(...args), delay);
      };
    };
  
    const saveCodeToBackend = useCallback(
      debounce(async (lang, code) => {
        try {
          await axios.post(
            `${BACKEND_URL}/saveCodeGroup`,
            { language: lang, code, groupId },
            { withCredentials: true }
          );
          console.log("Code saved");
        } catch (err) {
          console.error("Failed to save code", err);
        }
      }, 1000),
      []
    );

  const handleCompile = async () => {
    try {
      const res = await axios.post(`${BACKEND_URL}/compile`, {
        code: codes[language] || "",
        language,
        input,
      });
      console.log(res);

      setOutput(res.data.output || res.data.error);
    } catch (err) {
      // have to handle the time limit excedded properly
      if (err.response || err.response.data || err.response.data.error) {
        setOutput(err.response.data.error);
      } else {
        setOutput("An unknown error occurred.");
      }
    }
  };

  // Handle key bindings for undo/redo
  const handleEditorKeyDown = (event) => {
    // Handle Ctrl+Z for undo
    if (event.ctrlKey && event.key === 'z' && !event.shiftKey && undoManagerRef.current) {
      undoManagerRef.current.undo();
      event.preventDefault();
    }
    // Handle Ctrl+Shift+Z or Ctrl+Y for redo
    if ((event.ctrlKey && event.shiftKey && event.key === 'z') || 
        (event.ctrlKey && event.key === 'y')) {
      undoManagerRef.current.redo();
      event.preventDefault();
    }
  };

  return (
    <div className="flex h-screen bg-black text-white font-mono relative">
      {/* Group Info Drawer (Slide-In) */}
      {showGroupInfo && <GroupInfo groupId={groupId} userId={userId} setShowGroupInfo={setShowGroupInfo} onlineUsers={onlineUsers} />}

      {/* Chat Sidebar */}
      <div className="w-[25%] border-r border-neutral-800 bg-neutral-950 flex flex-col shadow-lg transition-colors duration-200">
        <div className="p-3 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between">
          <button
            className="bg-red-600 hover:bg-red-700 transition-all text-white px-3 py-1.5 rounded text-xs shadow-md"
            onClick={() => navigate("/home")}
          >
            ← Back to Home
          </button>
          <button
            onClick={() => setShowGroupInfo(!showGroupInfo)}
            className="text-xs text-red-400 hover:text-red-300 underline"
          >
            Group Info
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 p-3 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-red-700 scrollbar-track-transparent">
          <div className="text-center my-2">
            <span className="text-xs text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded">
              Today
            </span>
          </div>
          {messages.map((msg, idx) => {
            const isOwnMessage = msg.sender === userId;
            const time = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={idx}
                className={`flex flex-col max-w-[85%] ${
                  isOwnMessage ? "self-end items-end" : "items-start"
                }`}
              >
                {/* Sender Name */}
                <span className="text-[10px] text-neutral-400 mb-0.5">
                  {isOwnMessage ? username : msg.senderrname}
                </span>

                <div
                  className={`flex items-start ${
                    isOwnMessage ? "flex-row-reverse" : ""
                  }`}
                >
                  {/* Avatar Circle */}
                  <div
                    className={`h-6 w-6 rounded-full ${
                      isOwnMessage ? "bg-red-600 ml-2" : "bg-blue-600 mr-2"
                    } flex items-center justify-center text-xs mt-0.5`}
                  >
                    {msg.sendername ? msg.sendername[0].toUpperCase() : 'U'}
                  </div>

                  {/* Message Bubble with Timestamp */}
                  <div
                    className={`px-3 py-2 rounded-lg text-xs shadow-sm relative ${
                      isOwnMessage
                        ? "bg-red-900/30 rounded-tr-none"
                        : "bg-neutral-800 rounded-tl-none"
                    }`}
                  >
                    <div className="prose prose-invert max-w-none text-xs">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.message}
                      </ReactMarkdown>
                    </div>

                    <div
                      className={`text-[10px] text-neutral-500 mt-1 ${
                        isOwnMessage ? "text-right" : "text-left"
                      }`}
                    >
                      {time}
                      
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Auto-scroll anchor */}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-900 transition-colors duration-200">
          <div className="relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.shiftKey) {
                    // Shift+Enter → insert newline
                    return;
                  } else {
                    // Enter → send message
                    e.preventDefault();
                    sendMessage();
                  }
                }
              }}
              placeholder="Type a message..."
              rows={2} 
              className="w-full h-10 bg-neutral-800 text-white px-3 py-2 rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-500 pr-8 resize-none"
            />
            <button
              onClick={sendMessage}
              className="absolute right-2 top-1.5 text-red-500 hover:text-red-400"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 p-4 flex flex-col space-y-3">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-neutral-800 text-sm px-3 py-2 rounded border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="cpp">C++</option>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>
            <button
              onClick={() => {
                setOutput("Compiling your code...");
                handleCompile();
              }}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm shadow-md flex items-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
              Compile & Run
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-green-400 text-xs flex items-center">
              <div className="h-2 w-2 bg-green-500 rounded-full mr-1"></div>
              <span>Collaborative Mode Active</span>
            </div>
          </div>
        </div>

        {/* Code Editor */}
        <div 
          className="flex-1 border border-neutral-700 rounded-xl overflow-hidden shadow-md"
          onKeyDown={handleEditorKeyDown}
        >
          <Editor
            height="100%"
            language={language}
            value={codes[language] || ""}
              onChange={(val) => {
                const updatedCode = val || "";
                setCodes((prev) => ({ ...prev, [language]: updatedCode }));
                saveCodeToBackend(language, updatedCode);
              }}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              wordWrap: "on",
            }}
          />
        </div>

        {/* Output/Input Area */}
        <div className="flex gap-4">
          <div className="w-[70%] bg-neutral-900 rounded-lg border border-neutral-700 text-sm h-40 overflow-auto shadow-sm flex flex-col">
            <div className="px-4 py-2 border-b border-neutral-700 bg-neutral-800">
              <h2 className="text-red-500 font-semibold text-xs">Output:</h2>
            </div>
            <pre className="whitespace-pre-wrap text-sm p-4 flex-1">
              {output}
            </pre>
          </div>
          <div className="w-[30%] bg-neutral-900 rounded-lg border border-neutral-700 text-sm h-40 overflow-auto shadow-sm flex flex-col">
            <div className="px-4 py-2 border-b border-neutral-700 bg-neutral-800">
              <h2 className="text-red-500 font-semibold text-xs">Input:</h2>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter input for the code..."
              className="flex-1 p-4 bg-neutral-900 text-white text-sm resize-none border-none focus:outline-none focus:ring-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
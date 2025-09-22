import { useNavigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import SocketContext from "../context/socketContext";
import * as Y from 'yjs';
import GroupInfo from "./GroupInfo";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Helper debounce function
const debounce = (func, delay) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func(...args), delay);
    };
};

export default function GroupPage() {
  const { socket } = React.useContext(SocketContext);
  const navigate = useNavigate();
  
  // State for UI elements, not for the editor's content
  const [output, setOutput] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // Refs for managing Yjs, Monaco, and bindings
  const editorRef = useRef(null);
  const ydocRef = useRef(null);
  const yTextRef = useRef(null); // Will now point to the Y.Text for the current language
  const undoManagerRef = useRef(null);
  const chatEndRef = useRef(null);
  const unbindEditorRef = useRef(null); // Ref to store the editor binding cleanup function

  const userId = localStorage.getItem("user-data")
    ? JSON.parse(localStorage.getItem("user-data"))._id
    : null;
  const username = localStorage.getItem("user-data")
    ? JSON.parse(localStorage.getItem("user-data")).username
    : "";

  const { groupId } = useParams();

  // useCallback to memoize the binding function
  const bindEditorToYjs = useCallback((editor, yText) => {
    if (!editor || !yText) return;
    const model = editor.getModel();
    model.setValue(yText.toString());

    let updatingFromYjs = false;

    // Yjs changes -> Editor
    const yjsObserver = () => {
      updatingFromYjs = true;
      const yContent = yText.toString();
      if (model.getValue() !== yContent) {
        const currentPosition = editor.getPosition();
        model.setValue(yContent);
        if (currentPosition) {
            editor.setPosition(currentPosition);
        }
      }
      updatingFromYjs = false;
    };
    yText.observe(yjsObserver);

    // Editor changes -> Yjs
    const editorListener = editor.onDidChangeModelContent(() => {
      if (updatingFromYjs) return;
      const value = editor.getValue();
      if (yText.toString() !== value) {
        yText.doc.transact(() => {
          yText.delete(0, yText.length);
          yText.insert(0, value);
        });
      }
    });

    // Return a cleanup function
    return () => {
      editorListener.dispose();
      yText.unobserve(yjsObserver);
    };
  }, []);

  // Function to handle mounting of the Monaco Editor
  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  // Debounced save function, memoized with useCallback
  const saveCodeToBackend = useCallback(
    debounce(async (lang, code) => {
      try {
        await axios.post(
          "http://localhost:8000/saveCodeGroup",
          { language: lang, code, groupId },
          { withCredentials: true }
        );
        console.log(`Code for ${lang} saved to backend.`);
      } catch (err) {
        console.error("Failed to save code", err);
      }
    }, 1500),
    [groupId]
  );

  // Main useEffect to set up Yjs document and socket listeners (runs only once)
  useEffect(() => {
    if (!groupId || !socket) return;
    
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const handleDocumentUpdate = (update) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), 'remote');
    };
    socket.on("documentUpdated", handleDocumentUpdate);

    return () => {
      socket.off("documentUpdated", handleDocumentUpdate);
      if (ydocRef.current) {
        ydocRef.current.destroy();
      }
    };
  }, [groupId, socket]);

  // Second useEffect to handle LOCAL changes (typing) and saving
  useEffect(() => {
    if (!ydocRef.current) return;

    const observer = (update, origin) => {
      if (origin !== 'remote') {
        socket.emit("updateDocument", Array.from(update));
        if (yTextRef.current) {
          saveCodeToBackend(language, yTextRef.current.toString());
        }
      }
    };

    ydocRef.current.on("update", observer);

    return () => {
      if (ydocRef.current) {
        ydocRef.current.off("update", observer);
      }
    };
  }, [language, saveCodeToBackend, socket]);

  // useEffect to handle language switching
  useEffect(() => {
    if (!ydocRef.current || !editorRef.current) return;

    if (unbindEditorRef.current) {
      unbindEditorRef.current();
    }
    
    const yText = ydocRef.current.getText(language);
    yTextRef.current = yText;

    undoManagerRef.current = new Y.UndoManager(yText);
    
    unbindEditorRef.current = bindEditorToYjs(editorRef.current, yText);

    const fetchInitialCode = async () => {
      if (yText.toString() === "") {
        try {
          const res = await axios.post(
            "http://localhost:8000/getCodeGroup",
            { language, groupId },
            { withCredentials: true }
          );
          const initialCode = res.data.code || `// Write your ${language} code here`;
          yText.insert(0, initialCode);
        } catch (err) {
          console.error(`Failed to fetch code for ${language}`, err);
        }
      }
    };

    fetchInitialCode();
  }, [language, groupId, bindEditorToYjs]);


  // Chat-related useEffects
  useEffect(() => {
    if (!socket || !groupId) return;
    socket.emit("joinGroup", groupId);
    
    const handlePreviousMessages = (msgs) => setMessages(msgs);
    const handleNewMessage = (msg) => setMessages((prev) => [...prev, msg]);
    const handleOnlineUsers = (users) => setOnlineUsers(users);

    socket.on("previousMessages", handlePreviousMessages);
    socket.on("newMessage", handleNewMessage);
    socket.on("getOnlineUsers", handleOnlineUsers);
  
    return () => {
      socket.emit("leaveGroup", groupId);
      socket.off("previousMessages", handlePreviousMessages);
      socket.off("newMessage", handleNewMessage);
      socket.off("getOnlineUsers", handleOnlineUsers);
    };
  }, [socket, groupId]);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (message.trim() === "") return;
    socket.emit("sendMessage", { username, groupId, messageContent: message, userId });
    setMessage("");
  };

  const handleCompile = async () => {
    if (!yTextRef.current) return;
    setOutput("Compiling...");
    try {
      const res = await axios.post("http://localhost:8000/compile", {
        code: yTextRef.current.toString(),
        language,
        input,
      });
      setOutput(res.data.output || res.data.error);
    } catch (err) {
      setOutput(err.response?.data?.error || "An unknown error occurred.");
    }
  };

  const handleEditorKeyDown = (event) => {
    if (!undoManagerRef.current) return;
    if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undoManagerRef.current.undo();
    }
    if ((event.ctrlKey && event.key === 'y') || (event.ctrlKey && event.shiftKey && event.key === 'z')) {
      event.preventDefault();
      undoManagerRef.current.redo();
    }
  };

  return (
    <div className="flex h-screen bg-black text-white font-mono relative">
      {showGroupInfo && <GroupInfo groupId={groupId} userId={userId} setShowGroupInfo={setShowGroupInfo} onlineUsers={onlineUsers} />}

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
                <span className="text-[10px] text-neutral-400 mb-0.5">
                  {isOwnMessage ? "You" : msg.sendername}
                </span>

                <div
                  className={`flex items-start ${
                    isOwnMessage ? "flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`h-6 w-6 rounded-full ${
                      isOwnMessage ? "bg-red-600 ml-2" : "bg-blue-600 mr-2"
                    } flex items-center justify-center text-xs mt-0.5`}
                  >
                    {msg.sendername ? msg.sendername[0].toUpperCase() : 'U'}
                  </div>

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
          <div ref={chatEndRef} />
        </div>

        <div className="p-3 border-t border-neutral-800 bg-neutral-900 transition-colors duration-200">
          <div className="relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
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
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col space-y-3">
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
              onClick={handleCompile}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm shadow-md flex items-center"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
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
        
        <div 
          className="flex-1 border border-neutral-700 rounded-xl overflow-hidden shadow-md"
          onKeyDown={handleEditorKeyDown}
        >
          <Editor
            height="100%"
            language={language}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              wordWrap: "on",
            }}
          />
        </div>
        
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
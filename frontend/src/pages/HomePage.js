import React, { useState, useEffect } from "react";
import { FiMenu } from "react-icons/fi";
import Editor from "@monaco-editor/react";
import axios from "axios";
import CreateGroupPage from "./CreateGroupPage";
import JoinGroupPage from "./JoinGroupPage";
import { useNavigate } from "react-router-dom";
import { useCallback } from "react";
import { BACKEND_URL } from "./GlobalVariable";

function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/protect`, {
          withCredentials: true,
        });
        if (res.data?.error) {
          console.log(res.data.error);
          navigate("/");
        } else {
          navigate("/home");
        }
      } catch (err) {
        navigate("/");
      }
    };
    fetchUser();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await axios.post(
        `${BACKEND_URL}/groups`,
        {},
        {
          withCredentials: true,
        }
      );
      const data = res.data;

      // ✅ Merge created and joined groups
      const mergedGroups = [...data.joinedGroups];
      setJoinedGroups(mergedGroups);
    } catch (err) {
      console.error("Failed to fetch groups", err);
    }
  };

  const fetchCode = async (lang) => {
  try {
    const res = await axios.post(
  `${BACKEND_URL}/getCode`,
  { language },
  { withCredentials: true }
);

    const data = res.data;
    setCodes((prev) => ({
      ...prev,
      [lang]: data.code || "// Write your code here",
    }));
    console.log(codes)
  } catch (err) {
    console.error("Failed to fetch code", err);
  }
};


  // Load groups amd fetch code
  useEffect(() => {
    fetchGroups();
    fetchCode(language);
  }, []);

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
          `${BACKEND_URL}/saveCode`,
          { language: lang, code },
          { withCredentials: true }
        );
        console.log("Code saved");
      } catch (err) {
        console.error("Failed to save code", err);
      }
    }, 1000),
    []
  );

  const handleLogout = async () => {
    try {
      await axios.post(`${BACKEND_URL}/logout`, null, {
        withCredentials: true,
      });
      localStorage.removeItem("user-data");
      navigate("/");
    } catch (err) {
      console.log(err);
    }
  };
  const GroupClickHandler = (group) => {
    navigate(`/groups/${group._id}`);
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [codes, setCodes] = useState({});
  const [output, setOutput] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [input, setInput] = useState("");
  const [showCreateGroupPage, setShowCreateGroupPage] = useState(false);
  const [showJoinGroupPage, setShowJoinGroupPage] = useState(false);
  const [joinedGroups, setJoinedGroups] = useState([]);

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

  useEffect(() => {
  if (language) {
    fetchCode(language);
  }
}, [language]);

  return (
    <div className="h-screen w-screen bg-neutral-950 text-gray-200 flex flex-col font-sans">
      {/* Top Bar */}

      {showCreateGroupPage && (
        <CreateGroupPage
          show={showCreateGroupPage}
          setShow={setShowCreateGroupPage}
          refreshGroups={fetchGroups}
        />
      )}
      {showJoinGroupPage && (
        <JoinGroupPage
          show={showJoinGroupPage}
          setShow={setShowJoinGroupPage}
          refreshGroups={fetchGroups}
        />
      )}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900">
        <button onClick={() => setMenuOpen(!menuOpen)}>
          <FiMenu className="text-gray-300 text-2xl hover:text-red-500 transition" />
        </button>
        <h1 className="text-lg tracking-wide text-gray-300">BROCODE</h1>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>
            Hi,{" "}
            {JSON.parse(localStorage.getItem("user-data") || "{}").fullName ||
              "User"}
            !
          </span>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-gray-300 border-2 border-white-700 rounded hover:bg-red-600 hover:border-red-600 transition text-xs"
          >
            LOG OUT
          </button>
        </div>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute top-14 left-4 w-44 rounded-md shadow-md bg-neutral-800 border border-neutral-700 z-50">
            <div
              className="px-4 py-2 hover:bg-neutral-700 cursor-pointer transition"
              onClick={() => navigate("/profile")}
            >
              My Profile
            </div>
            <div
              className="px-4 py-2 hover:bg-neutral-700 cursor-pointer transition"
              onClick={() => {
                setMenuOpen(!menuOpen);
                setShowCreateGroupPage(!showCreateGroupPage);
              }}
            >
              Create Group
            </div>
            <div
              className="px-4 py-2 hover:bg-neutral-700 cursor-pointer transition"
              onClick={() => {
                setMenuOpen(!menuOpen);
                setShowJoinGroupPage(!showCreateGroupPage);
              }}
            >
              Join Group
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="hidden md:block w-64 bg-neutral-900 p-4 border-r border-neutral-800">
          <h2 className="text-base text-gray-400 mb-3">Your Groups</h2>
          <ul className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
            {joinedGroups.map((group, index) => (
              <li
                key={index}
                className="bg-neutral-800 p-2 rounded hover:bg-neutral-700 cursor-pointer text-sm"
                onClick={() => {
                  GroupClickHandler(group);
                }}
              >
                {group.name}
              </li>
            ))}
          </ul>
        </div>

        {/* Editor + Output Area */}
        <div className="flex-1 p-4 flex flex-col">
          {/* Controls */}
          <div className="flex items-center gap-4 mb-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-neutral-800 text-sm p-2 rounded"
            >
              <option value="cpp">C++</option>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>
            <button
              onClick={() => {
                setOutput("Compiling your code....");
                handleCompile();
              }}
              className="bg-red-600 hover:bg-red-700 px-4 py-1 rounded text-sm"
            >
              Compile & Run
            </button>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 border border-neutral-700 rounded overflow-hidden mb-2">
            <Editor
              height="100%"
              language={language}
              value={codes[language] || ""}
              onChange={(val) => {
                const updatedCode = val || "";
                setCodes((prev) => ({ ...prev, [language]: updatedCode }));
                saveCodeToBackend(language, updatedCode);
              }}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                wordWrap: "on",
              }}
            />
          </div>

          <div className="flex gap-4 items-start">
            {/* Output */}
            <div className="w-[70%] bg-neutral-900 p-3 rounded border border-neutral-700 text-sm h-40 overflow-auto">
              <h2 className="text-red-500 mb-1 font-medium">Output:</h2>
              <pre className="whitespace-pre-wrap">{output}</pre>
            </div>

            {/* Input */}
            <div className="w-[30%]">
              <h2 className="text-red-500 mb-1 font-medium">Input:</h2>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter input for the code..."
                className="w-full h-32 p-2 border border-neutral-700 
                      rounded bg-neutral-900 text-white resize-none text-sm 
                      focus:outline-none focus:ring-2  focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;

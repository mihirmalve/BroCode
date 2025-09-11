import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "./GlobalVariable"; // CORRECTED: Import the 'useNavigate' hook

const GroupInfo = ({ groupId, userId, setShowGroupInfo, onlineUsers }) => {
  const [members, setMembers] = useState([]);
  const [adminId, setAdminId] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // CORRECTED: Initialize the hook

  // Fetch group info when the component mounts or groupId changes
  useEffect(() => {
    const fetchGroupInfo = async () => {
      if (!groupId) return;
      setLoading(true);
      try {
        const res = await axios.post(
          `${BACKEND_URL}/info`,
          { groupId },
          { withCredentials: true }
        );
        setMembers(res.data.members);
        setAdminId(res.data.admin);
      } catch (err) {
        console.error("Failed to fetch group info:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGroupInfo();
  }, [groupId]);

  const handleKickUser = async (memberIdToKick) => {
    try {
      await axios.post(
        `${BACKEND_URL}/kick`,
        { groupId, userId: memberIdToKick },
        { withCredentials: true }
      );
      setMembers(prevMembers => prevMembers.filter(member => member._id !== memberIdToKick));
    } catch (err) {
      console.error("Failed to kick user:", err);
      alert("Error: Could not kick the user.");
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await axios.post(
        `${BACKEND_URL}/leave`,
        { groupId },
        { withCredentials: true }
      );
      
      navigate('/'); 

    } catch (err) {
      console.error("Failed to leave group:", err);
      alert("Error: Could not leave the group.");
    }
  };

  return (
    <div className="fixed top-0 right-0 w-1/5 h-screen bg-neutral-950 text-white z-50 shadow-xl p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-bold text-red-500">Group Members</h1>
        <button
          onClick={() => setShowGroupInfo(false)}
          className="text-white text-xl hover:text-red-500"
        >
          &times;
        </button>
      </div>

      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member._id}
            className="flex items-center justify-between bg-neutral-900 px-4 py-2 rounded shadow-sm"
          >
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-red-700 text-white flex items-center justify-center text-sm font-bold">
                  {member.username ? member.username[0].toUpperCase() : 'U'}
                </div>
                <div
                  className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-neutral-900 ${
                    onlineUsers.includes(member._id) ?  "bg-green-500" : "bg-gray-500"
                  }`}
                ></div>
              </div>
              <span className="text-sm">{member.username}</span>
            </div>

            {userId === adminId && member._id !== userId && (
              <button
                onClick={() => handleKickUser(member._id)}
                className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 rounded"
              >
                Kick
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={handleLeaveGroup}
          className="text-sm px-4 py-2 bg-red-700 hover:bg-red-800 rounded shadow"
        >
          Leave Group
        </button>
      </div>
    </div>
  );
};

export default GroupInfo;
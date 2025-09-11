import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { BACKEND_URL } from "./GlobalVariable";

const JoinGroupPage = ({ show, setShow,refreshGroups }) => {
  const [groupName, setGroupName] = useState("");
  const [groupPassword, setGroupPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const onClose = () => {
    setShow(!show);
  };    
 
  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const JoinButtonHandler = async () => {
    try {
      const data = {
        name: groupName,
        password: groupPassword,
      };

      const res = await axios.post(`${BACKEND_URL}/join`, data, {
        withCredentials: true,
      });

      if (res.status === 201) {
        toast.success("Group Joined Successfully");
        refreshGroups();
        onClose();
      } else {
        toast.error("Group Join Failed");
      }
    } catch (err) {
      console.log("Error joining group:", err);
      toast.error("Group Join Failed");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm z-50 flex justify-center items-center px-4">
      <div className="relative bg-neutral-900 rounded-2xl p-8 w-full max-w-md shadow-lg border border-neutral-800 transition-all duration-200 z-60">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-white hover:text-red-400 text-2xl font-bold"
        >
          &times;
        </button>

        <h1 className="text-3xl font-semibold text-red-500 mb-6 text-center">
          Join Group
        </h1>

        {/* Group Name */}
        <div className="mb-5">
          <label className="block text-sm text-red-400 mb-1">Group Name</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Enter group name"
            className="w-full px-3 py-2 rounded-lg bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-red-500 placeholder:text-neutral-500 text-sm transition duration-150"
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label className="block text-sm text-red-400 mb-1">Group Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={groupPassword}
              onChange={(e) => setGroupPassword(e.target.value)}
              placeholder="Enter group password"
              className="w-full pr-12 px-3 py-2 rounded-lg bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-red-500 placeholder:text-neutral-500 text-sm transition duration-150"
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-red-400 hover:text-red-300 focus:outline-none"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* Join Button */}
        <button
          className="w-full bg-red-600 hover:bg-red-700 transition-colors text-white py-2.5 rounded-lg font-medium text-sm"
          onClick={JoinButtonHandler}
        >
          Join Group
        </button>
      </div>
    </div>
  );
};

export default JoinGroupPage;

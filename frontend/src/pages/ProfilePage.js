import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { BACKEND_URL } from "./GlobalVariable";

export default function MyProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState({});

  const [groupToDelete, setGroupToDelete] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const [profilePic, setProfilePic] = useState(null);
  const [isImageSelected, setIsImageSelected] = useState(false); // To track if an image is selected

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result);
        setIsImageSelected(true); // Image is selected
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteProfilePic = () => {
    setProfilePic(null);
    setIsImageSelected(false); // Reset to show the avatar again
  };

  const confirmDelete = async () => {
    try {
      const res = await axios.post(
        `${BACKEND_URL}//deleteGroup`,
        { groupId: groupToDelete._id },
        {
          withCredentials: true,
        }
      );
      if (res.status === 200) {
        toast.success("Group deleted successfully");
        setUser((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            createdGroups: prev.user.createdGroups.filter(
              (g) => g._id !== groupToDelete._id
            ),
          },
        }));
      }
    } catch (err) {
      toast.error(err);
    }
    console.log(`Deleted group: ${groupToDelete}`);
    setShowConfirmDelete(false);
  };

  const cancelDelete = () => {
    setGroupToDelete(null);
    setShowConfirmDelete(false);
  };

  useEffect(() => {
    const handleProfile = async () => {
      try {
        const res = await axios.post(
          `${BACKEND_URL}/getProfile`,
          {},
          {
            withCredentials: true,
          }
        );

        if (res.status === 401) {
          navigate("/");
          return;
        }

        if (res.data?.error) {
          console.log(res.data.error);
        } else {
          setUser(res.data);
        }
      } catch (err) {
        navigate("/");
      }
    };

    handleProfile();
  }, [navigate]);

  // Ensure that user data is available before rendering
  if (!user || Object.keys(user).length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex justify-center items-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-12 px-4 sm:px-6 lg:px-20">
      {/* Main Heading */}
      <div className="mb-12 flex justify-between items-center">
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
          <span className="flex items-center gap-2">
            <span className="text-white hover:text-red-600 transition-colors duration-300">
              My Profile
            </span>
          </span>
        </h1>
        {/* Home Button */}
        <button
          className="bg-black/80 hover:bg-red-600 text-white px-5 py-2.5 rounded-full text-sm font-medium tracking-wide border border-white/20 hover:border-red-500 transition-all duration-300 shadow-lg hover:shadow-red-900/30"
          onClick={() => navigate("/home")}
        >
          Home
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Left Side: Profile & Basic Info */}
        <div className="flex flex-col items-center md:items-start">
          {/* Profile Pic */}
          {profilePic ? (
            <img
              src={profilePic}
              alt="Profile"
              className="w-40 h-40 rounded-full object-cover border-4 border-red-600 shadow-lg hover:border-red-500 transition-all duration-300"
            />
          ) : (
            <div className="w-40 h-40 rounded-full flex items-center justify-center bg-black border-4 border-red-600 shadow-lg text-red-500 text-5xl font-bold">
              {user.user.fullName
                ? user.user.fullName.charAt(0).toUpperCase()
                : "?"}
                
            </div>
          )}

          {/* Change button */}
          <div className="mt-6 w-full flex justify-center md:justify-start">
            <input
              type="file"
              accept="image/*"
              onChange={handleProfilePicChange}
              className="hidden"
              id="profile-pic-upload"
            />
            <label
              htmlFor="profile-pic-upload"
              className="cursor-pointer bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-full text-sm font-medium tracking-wide shadow-lg hover:shadow-red-900/50 transition-all duration-300"
            >
              Change Profile Picture
            </label>

            {isImageSelected && (
              <button
                onClick={handleDeleteProfilePic}
                className="bg-black-700 hover:bg-gray-600 text-white px-5 py-2 rounded-full text-sm font-medium tracking-wide shadow-lg hover:shadow-red-900/50 transition-all duration-300"
              >
                Delete Photo
              </button>
            )}
          </div>

          {/* Basic Info */}
          <div className="mt-10 w-full">
            <h2 className="text-2xl font-normal text-white mb-8 relative">
              <span className="relative z-10">Basic Info</span>
              <span className="absolute -bottom-1 left-0 w-8 h-[2px] bg-red-600"></span>
              <span className="absolute -bottom-1 left-10 w-[calc(100%-2.5rem)] h-[1px] bg-gray-700"></span>
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                  Name
                </p>
                <p className="text-lg font-medium text-white/90">
                  {user.user.fullName}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                  Username
                </p>
                <p className="text-lg font-medium text-white/90">
                  @{user.user.username}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                  Email
                </p>
                <p className="text-lg font-medium text-white/90">
                  {user.user.email}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                  Age
                </p>
                <p className="text-lg font-medium text-white/90">
                  {user.user.age}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Groups */}
        <div className="md:col-span-2">
          <h2 className="text-2xl font-semibold text-red-600 mb-6 pb-2 border-b border-gray-800 tracking-tight">
            Groups Created
          </h2>
          <ul className="space-y-3">
            {user?.user?.createdGroups?.length > 0 ? (
              user.user.createdGroups.map((group) => (
                <li
                  key={group._id}
                  className="bg-gray-900 hover:bg-gray-800 px-5 py-3 rounded-xl shadow-lg transition-all duration-300 flex justify-between items-center group"
                >
                  <span className="text-lg font-medium text-white/90 group-hover:text-white">
                    {group.name}
                  </span>
                  <button
                    onClick={() => {
                      setShowConfirmDelete(!showConfirmDelete);
                      setGroupToDelete(group);
                    }}
                    className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-gray-700 transition-all duration-300"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </li>
              ))
            ) : (
              <li className="text-gray-400 italic py-8 text-center bg-gray-900/30 rounded-xl">
                No groups created yet.
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-xl w-full max-w-md">
            <h3 className="text-xl font-semibold text-white text-center mb-3 tracking-tight">
              Delete Group?
            </h3>
            <p className="text-gray-400 text-center mb-5">
              Are you sure you want to delete{" "}
              <span className="font-medium text-white">
                "{groupToDelete.name}"
              </span>
              ?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={cancelDelete}
                className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2 rounded-full text-sm font-medium tracking-wide transition-all duration-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-full text-sm font-medium tracking-wide transition-all duration-300"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

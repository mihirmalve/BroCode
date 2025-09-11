import React, { useState, useEffect } from "react";
import background from "./back1.jpg";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { BACKEND_URL } from "./GlobalVariable";

function LoginSignupPage() {
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/protect`, {
          withCredentials: true,
        });
        if (res.data?.error) {
          console.log(res.data.error);
        } else {
          navigate("/home");
        }
      } catch (err) {
        navigate("/");
      }
    };
    fetchUser();
  }, []);

  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const isValidEmail = (email) => {
    const regex =
      /^[a-zA-Z0-9._%+-]+@(?:gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|protonmail\.com|icloud\.com)$/;
    return regex.test(email);
  };

  const resetFields = () => {
    setName("");
    setUsername("");
    setAge("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setEnteredOtp("");
    setIsOtpSent(false);
    setIsOtpVerified(false);
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Enter") {
        if (isSignup) {
          if (isOtpVerified) {
            handleSignup();
          } else if (isOtpSent && !isOtpVerified) {
            handleVerifyOtp();
          } else if (!isOtpSent) {
            handleSendOtp();
          }
        } else {
          handleSignin();
        }
      }
    };
  
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isSignup, isOtpSent, isOtpVerified, name, username, age, email, otp, enteredOtp, password, confirmPassword]);
  

  const handleSendOtp = async () => {
    if (!name || !username || !age || !email) {
      toast.warning("Please fill all fields (name, username, age, email).");
      return;
    }
    if (!isValidEmail(email)) {
      toast.warning(
        "Please enter a valid email address (gmail, outlook, etc)."
      );
      return;
    }

    const res1 = await axios.post(`${BACKEND_URL}/checkUserAndEmail`, {
      email,
      username,
    });
    if (res1.data.check == "Email repeated") {
      toast.warning("Email already exists. Please use a different email.");
      setEmail("");
      return;
    }
    if (res1.data.check == "Username repeated") {
      toast.warning(
        "Username already exists. Please use a different username."
      );
      setUsername("");
      return;
    }

    const res = await axios.post(`${BACKEND_URL}/sendOtp`, { email });
    setOtp(res.data.otp);
    setIsOtpSent(true);
    toast.info(`OTP sent to ${email}`);
  };

  const handleVerifyOtp = () => {
    if (enteredOtp == otp) {
      setIsOtpVerified(true);
      toast.success("OTP verified! You can now set your password.");
    } else {
      toast.error("Incorrect OTP. Please try again.");
    }
  };

  const handleSignin = async () => {
    try {
      const res = await axios.post(
        `${BACKEND_URL}/signin`,
        {
          email,
          password,
        },
        {
          withCredentials: true,
        }
      );
  
      if (res.data.error) {
        toast.error(res.data.error);
        return;
      } else {
        localStorage.setItem("user-data", JSON.stringify(res.data));
        navigate("/Home");
        resetFields();
      }
    } catch (err) {
      // Catch 401 or other errors here and show toast
      toast.error(err.response?.data?.error || "Invalid email or password");
    }
  };
  

  const handleSignup = async () => {
    if (!name || !username || !age || !email) {
      toast.warning("Please fill all fields (name, username, age, email).");
      return;
    }
    if (!isValidEmail(email)) {
      toast.warning(
        "Please enter a valid email address (gmail, outlook, etc)."
      );
      return;
    }

    if (!password || !confirmPassword) {
      toast.warning("Please set your password.");
      return;
    }
    if (password !== confirmPassword) {
      toast.warning("Passwords do not match.");
      return;
    }

    const res = await axios.post(`${BACKEND_URL}/signup`, {
      name,
      username,
      age,
      email,
      password,
    },
      {
        withCredentials: true,
      });
    if (res.data.error) {
      toast.error(res.data.error);
      return;
    } else {
      localStorage.setItem("user-data", JSON.stringify(res.data));
      navigate("/Home");
      toast.success("Signed up successfully!");
      resetFields();
      setIsSignup(false);
    }
  };

  const inputClass =
    "w-full p-2 bg-gray-800 text-white rounded outline-none border-2 border-transparent focus:border-red-600 focus:ring-0";

  return (
    <div
      className="h-screen bg-cover bg-center flex justify-center items-center"
      style={{ backgroundImage: `url(${background})` }}
    >
      <div className="absolute top-4 left-6 text-red-600 text-4xl font-extrabold tracking-wider drop-shadow-lg">
        DevSquad
      </div>

      <div className="bg-black bg-opacity-70 pt-16 p-10 rounded-lg w-[90%] max-w-md text-white min-h-[440px]">
        <h1 className="text-3xl font-bold mb-6">
          {isSignup ? "Sign Up" : "Sign In"}
        </h1>

        {isSignup ? (
          <>
            <input
              type="text"
              placeholder="Full Name"
              className={`${inputClass} mb-3`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isOtpSent}
            />
            <input
              type="text"
              placeholder="Username"
              className={`${inputClass} mb-3`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isOtpSent}
            />
            <input
              type="number"
              placeholder="Age"
              className={`${inputClass} mb-3`}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              disabled={isOtpSent}
            />
            <input
              type="email"
              placeholder="Gmail"
              className={`${inputClass} mb-3`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isOtpSent}
            />

            {!isOtpSent && (
              <button
                className="w-full bg-red-600 hover:bg-red-700 py-2 rounded font-semibold mb-4"
                onClick={handleSendOtp}
              >
                Send OTP
              </button>
            )}

            {isOtpSent && !isOtpVerified && (
              <>
                <input
                  type="text"
                  placeholder="Enter OTP"
                  className={`${inputClass} mb-3`}
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value)}
                />
                <button
                  className="w-full bg-red-600 hover:bg-red-700 py-2 rounded font-semibold mb-4"
                  onClick={handleVerifyOtp}
                >
                  Verify OTP
                </button>
              </>
            )}

            {isOtpVerified && (
              <>
                <div className="relative mb-3">
                  <input
                    type={showSignupPassword ? "text" : "password"}
                    placeholder="Set Password"
                    className={`${inputClass} pr-16`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-300 hover:text-white"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                  >
                    {showSignupPassword ? "Hide" : "Show"}
                  </button>
                </div>

                <div className="relative mb-6">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm Password"
                    className={`${inputClass} pr-16`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-300 hover:text-white"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>

                <button
                  className="w-full bg-red-600 hover:bg-red-700 py-2 rounded font-semibold"
                  onClick={handleSignup}
                >
                  Sign Up
                </button>
              </>
            )}

            <div className="mt-4 text-sm text-gray-400">
              Already have an account?{" "}
              <span
                className="text-white hover:underline cursor-pointer"
                onClick={() => {
                  resetFields();
                  setIsSignup(false);
                }}
              >
                Sign in
              </span>
            </div>
          </>
        ) : (
          <>
            <input
              type="email"
              placeholder="Email"
              className={`${inputClass} mb-4`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="relative mb-6">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className={`${inputClass} pr-16`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-300 hover:text-white"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <button
              className="w-full bg-red-600 hover:bg-red-700 py-2 rounded font-semibold"
              onClick={handleSignin}
            >
              Sign in
            </button>

            <div className="mt-4 text-sm text-gray-400">
              New to OurSite?{" "}
              <span
                className="text-white hover:underline cursor-pointer"
                onClick={() => setIsSignup(true)}
              >
                Sign up now
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default LoginSignupPage;

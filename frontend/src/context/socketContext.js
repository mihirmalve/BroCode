import React, {
  createContext,
  useEffect,
  useState,
  useContext,
} from 'react';
import io from 'socket.io-client';
import { BACKEND_URL } from "../pages/GlobalVariable";

const SocketContext = createContext();

// Create a custom hook to easily use the socket context
export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketContextProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  // Using a more robust way to get user data
  const user_data_string = localStorage.getItem("user-data"); 
  const userId = user_data_string ? JSON.parse(user_data_string)._id : null;

  useEffect(() => {  
    if (userId) {
      console.log("Attempting to connect to WebSocket server at:", BACKEND_URL);

      // Create the socket instance
      const newSocket = io(BACKEND_URL, {
        query: { userId },
        withCredentials: true,
      });

      // CRITICAL: Listen for a successful connection
      newSocket.on("connect", () => {
        console.log("✅ Socket connected successfully! ID:", newSocket.id);
        // Set the socket in state ONLY after a successful connection
        setSocket(newSocket);
      });

      // CRITICAL: Listen for connection errors
      newSocket.on("connect_error", (err) => {
        console.error("❌ Socket connection failed:", err.message);
        // This will tell you if it's a CORS error, a timeout, etc.
      });

      // Listen for other events
      newSocket.on("getOnlineUsers", (users) => {
        setOnlineUsers(users);
      });

      newSocket.on("disconnect", () => {
          console.log("Socket disconnected.");
          setSocket(null);
      });

      // The cleanup function is crucial
      return () => {
        newSocket.close();
      };
    } else {
      // If there's no user, ensure any existing socket is disconnected.
      if (socket) {
        socket.close();
        setSocket(null);
      }
    }
    
  }, [userId]); // The effect depends only on the userId

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
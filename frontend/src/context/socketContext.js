import React, {
    createContext,
    useEffect,
    useState,
  } from 'react';
  import io from 'socket.io-client';
  import { BACKEND_URL } from "../pages/GlobalVariable";
  
  export const SocketContext = createContext();
  
  export const SocketContextProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const user_data = localStorage.getItem("user-data"); 
    const userId = user_data ? JSON.parse(user_data)._id : null;

    useEffect(() => {  
      if (user_data) {
        const newSocket = io(`${BACKEND_URL}`, {
          query: { userId },
          withCredentials: true,
        });
  
        setSocket(newSocket);
  
        newSocket.on("getOnlineUsers", (users) => {
          setOnlineUsers(users);
        });
  
        return () => {
          newSocket.disconnect();
        };
      }
      else {
        console.log("User data is not available.");
      }
      
    }, [user_data]);
  
    return (
      <SocketContext.Provider value={{ socket, onlineUsers }}>
        {children}
      </SocketContext.Provider>
    );
  };
  
  export default SocketContext;
  
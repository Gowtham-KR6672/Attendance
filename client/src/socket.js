import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

export const socket = io(SOCKET_URL, {
  auth: { token: localStorage.getItem("token") },
  withCredentials: true,
  transports: ["websocket", "polling"],
});

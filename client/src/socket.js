import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:4000"; // change later for production

export const socket = io(SOCKET_URL, {
  auth: { token: localStorage.getItem("token") },
  withCredentials: true,
});

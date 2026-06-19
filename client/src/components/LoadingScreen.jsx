import React from "react";
import logoImg from "../asset/icon.png";

export default function LoadingScreen({ text = "Loading Data...", subtext = "Please wait a moment..." }) {
  return (
    <div className="w-full min-h-[60vh] bg-[#f8fafc] flex flex-col items-center justify-center px-4 overflow-hidden relative rounded-2xl">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-100/50 rounded-full blur-[80px] animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-blue-200/50 rounded-full blur-[60px] animate-[pulse_3s_ease-in-out_infinite]" />

      <div className="relative w-24 h-24 mb-16 z-10 flex items-center justify-center">
        {/* Complex orbiting rings */}
        <div className="absolute inset-[-40%] rounded-full border-[3px] border-transparent border-t-blue-400/80 border-r-blue-500/80 animate-[spin_3s_linear_infinite]" />
        <div className="absolute inset-[-20%] rounded-full border-[3px] border-transparent border-b-blue-300/80 border-l-blue-400/80 animate-[spin_2s_linear_infinite_reverse]" />
        <div className="absolute inset-0 rounded-full border-[2px] border-blue-200/30 animate-[spin_4s_linear_infinite]" />
        
        {/* Logo Container */}
        <div className="relative w-full h-full flex items-center justify-center z-10 transform transition-transform hover:scale-105">
          <img src={logoImg} alt="Logo" className="relative w-full h-full object-cover scale-[1.6] animate-[pulse_2s_ease-in-out_infinite] mix-blend-multiply opacity-90" />
        </div>
      </div>
      
      <h2 className="text-2xl font-extrabold text-[#13254a] mb-3 tracking-tight z-10 drop-shadow-sm">
        {text}
      </h2>
      <p className="text-sm text-slate-500 text-center max-w-sm leading-relaxed z-10 font-medium">
        {subtext}
      </p>
    </div>
  );
}

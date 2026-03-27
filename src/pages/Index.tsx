// src/pages/Index.tsx
// ✅ ELEGANT MOBILE UI - Premium look without changing design

import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center relative overflow-hidden px-4 py-8"
      style={{
        backgroundImage: `url('/shinchan-jungle-bg.jpg')`,
      }}
    >
      {/* Cinematic dark jungle overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/70 to-black/80" />

      <div className="relative z-10 max-w-5xl mx-auto w-full text-center text-white flex flex-col items-center">
        
        {/* Theatre branding */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-[-3px] leading-none drop-shadow-2xl mb-2">
          PRAANSPANDA
        </h1>
        <p className="text-xl sm:text-2xl md:text-3xl font-light tracking-[5px] text-amber-300 mb-12">
          THEATRE
        </p>

        {/* Movie title */}
        <div className="mb-16 md:mb-20">
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-widest mb-2 drop-shadow-xl">
            SHINCHAN
          </h2>
          <p className="text-3xl sm:text-4xl md:text-5xl font-medium text-amber-400 drop-shadow-lg">
            JUNGLE THAT INVITES STORM
          </p>
        </div>

        {/* Buttons - Elegant & Mobile Optimized */}
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-xs sm:max-w-md mx-auto">
          
          {/* REGISTER BUTTON */}
          <Button
            asChild
            size="lg"
            className="text-xl font-semibold px-8 py-6 rounded-3xl border-2 border-white bg-white text-black hover:bg-amber-300 transition-all duration-300 shadow-2xl flex-1"
          >
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSdk3u6lawiledKLqujlg6rVmekKxk_dpGJ3zkPEaJFaTzAX2w/viewform?usp=sharing&ouid=117674513086318912458"
              target="_blank"
              rel="noopener noreferrer"
            >
              REGISTER
            </a>
          </Button>

          {/* DASHBOARD BUTTON */}
          <Button
            size="lg"
            variant="outline"
            className="text-xl font-semibold px-8 py-6 rounded-3xl border-2 border-white text-black hover:bg-amber-300 transition-all duration-300 shadow-2xl flex-1"
            onClick={() => navigate("/dashboard")}
          >
            DASHBOARD
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
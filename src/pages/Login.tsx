// src/pages/Login.tsx
// ✅ UPDATED - Elegant, mobile-friendly Shinchan jungle theme

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Sparkles, Leaf, Zap } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [uti, setUti] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login, user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !loading) {
      if (isAdmin) {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, isAdmin, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await login(email, uti);

    if (error) {
      toast({ title: "Login Failed 😢", description: error, variant: "destructive" });
    } else {
      toast({ title: "Welcome to the Jungle! 🌿⚡", description: "Login successful" });
    }

    setIsLoading(false);
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center relative overflow-hidden px-4 py-8"
      style={{
        backgroundImage: `url('/shinchan-jungle-bg.jpg')`,
      }}
    >
      {/* Vibrant jungle overlay */}
      <div className="absolute inset-0 bg-gray-400/20" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#fcd34d_0%,transparent_60%)] opacity-30 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,#22c55e_0%,transparent_60%)] opacity-20 pointer-events-none" />

      <Card className="w-full max-w-md shadow-2xl border-4 border-amber-600 bg-white/95 backdrop-blur-lg rounded-3xl overflow-hidden relative z-10">
        <CardHeader className="text-center space-y-4 pb-6 pt-8">
          <div className="flex justify-center items-center gap-3 mx-auto">
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-xl border-4 border-white">
              <Ticket className="w-8 h-8 text-black" />
            </div>
          </div>

          <CardTitle className="text-3xl sm:text-3xl font-black tracking-[-2px] text-black flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            PRAANSPANDA LOGIN
            <Sparkles className="w-6 h-6 text-amber-500" />
          </CardTitle>
        </CardHeader>

        <CardContent className="px-6 sm:px-8 pb-10">
          <form onSubmit={handleLogin} className="space-y-6">
            <Input
              type="email"
              placeholder="Your Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 text-base bg-white border-2 border-green-300 focus:border-amber-400 rounded-2xl placeholder:text-zinc-400 shadow-inner"
            />

            <Input
              type="password"
              placeholder="Transaction ID Code"
              value={uti}
              onChange={(e) => setUti(e.target.value)}
              required
              className="h-12 text-base bg-white border-2 border-green-300 focus:border-amber-400 rounded-2xl placeholder:text-zinc-400 shadow-inner"
            />

            <Button
              type="submit"
              className="w-full h-14 text-xl font-black rounded-3xl bg-gradient-to-r from-yellow-400 via-orange-400 to-amber-400 hover:from-yellow-300 hover:via-orange-300 hover:to-amber-300 text-black shadow-2xl transition-all duration-300 flex items-center justify-center gap-3"
              disabled={isLoading}
            >
              {isLoading ? "Entering the Jungle..." : "ENTER THEATRE"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
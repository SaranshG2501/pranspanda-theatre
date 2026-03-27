// src/pages/Dashboard.tsx
// ✅ UPDATED - Minimal & Professional Shinchan jungle theme
// (Background kept exactly as you liked, but everything else toned down)

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, Armchair, LogOut, Shield } from "lucide-react";

const Dashboard = () => {
  const { user, isAdmin, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<{ row_num: number; col_num: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchBooking = async () => {
      try {
        const { data: bookingData, error } = await supabase
          .from("bookings")
          .select("seat_id")
          .eq("user_id", user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error(error);
          setLoading(false);
          return;
        }

        if (!bookingData) {
          setBooking(null);
          setLoading(false);
          return;
        }

        const { data: seatData } = await supabase
          .from("seats")
          .select("row_num, col_num")
          .eq("id", bookingData.seat_id)
          .single();

        if (seatData) {
          setBooking({
            row_num: seatData.row_num,
            col_num: seatData.col_num,
          });
        }
      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    };

    fetchBooking();
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-lg font-medium text-amber-300">
        Authenticating...
      </div>
    );
  }

  const getSeatLabel = (row: number, col: number) =>
    `${String.fromCharCode(64 + col)}${row}`;

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center relative overflow-hidden p-6"
      style={{
        backgroundImage: `url('/shinchan-jungle-bg.jpg')`,
      }}
    >
      {/* Clean, professional jungle overlay (stronger dark tint for readability) */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/75" />

      <div className="relative z-10 max-w-2xl w-full mx-auto">

        {/* Header - minimal & professional */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold tracking-tight text-white">
            PRAANSPANDA Presents
          </h1>
          <p className="text-2xl font-medium text-amber-300 tracking-wide mt-1">
            SHINCHAN : JUNGLE THAT INVITES STORM
          </p>
          <p className="text-sm text-zinc-400 mt-4">
            Welcome back, {user?.email}
          </p>
        </div>

        {/* Admin Button */}
        {isAdmin && (
          <div className="flex justify-center mb-8">
            <Button
              variant="outline"
              className="gap-2 text-amber-500 border-amber-300/50 hover:bg-amber-300 hover:text-black text-sm font-medium"
              onClick={() => navigate("/admin")}
            >
              <Shield className="w-4 h-4" />
              Admin Panel
            </Button>
          </div>
        )}

        {/* Booking Card - clean, minimal & professional */}
        <Card className="bg-gray-900 border border-white shadow-xl rounded-3xl backdrop-blur-md">
          <CardHeader className="pb-4 pt-7">
            <CardTitle className="flex items-center justify-center gap-3 text-xl font-semibold text-white">
              <Ticket className="w-5 h-5 text-white" />
              YOUR BOOKING STATUS
            </CardTitle>
          </CardHeader>

          <CardContent className="px-8 pb-10 text-center space-y-8">
            {loading ? (
              <p className="text-base text-zinc-500">Loading your status...</p>
            ) : booking ? (
              <>
                <div className="mx-auto w-28 h-28 bg-amber-400 rounded-2xl flex items-center justify-center shadow-inner">
                  <span className="text-5xl font-bold text-black tracking-tighter">
                    {getSeatLabel(booking.row_num, booking.col_num)}
                  </span>
                </div>

                <div className="space-y-3">
                  <Badge className="px-6 py-1.5 bg-green-600 text-white text-sm font-medium">
                    Seat Frozen
                  </Badge>
                </div>
              </>
            ) : (
              <div className="space-y-8">
                {/* Bold message - prominent but clean & professional */}
                <p className="text-xl font-semibold text-amber-400 tracking-[1px] uppercase">
                  YOU CAN CHOOSE YOUR SEAT ONLY ONCE
                </p>

                <Armchair className="w-16 h-16 mx-auto text-zinc-400" />

                <p className="text-base text-white">
                  You haven't booked a seat yet
                </p>

                <Button
                  size="lg"
                  className="w-full h-12 text-base font-medium bg-amber-400 hover:bg-amber-300 text-black rounded-3xl shadow-md"
                  onClick={() => navigate("/book")}
                >
                  <Ticket className="w-5 h-5 mr-3" />
                  BOOK YOUR SEAT
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logout */}
        <div className="flex justify-center mt-10">
          <Button
            variant="ghost"
            className="gap-2 text-zinc-100 hover:text-black text-sm font-medium"
            onClick={logout}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
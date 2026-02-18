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
      <div className="min-h-screen flex items-center justify-center text-lg font-medium">
        Authenticating...
      </div>
    );
  }

  const getSeatLabel = (row: number, col: number) =>
    `${String.fromCharCode(64 + col)}${row}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-accent/30 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Theatre Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-wide bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
            PranSpanda Theatre
          </h1>

          <p className="text-xl md:text-2xl font-semibold text-foreground">
            Doraemon : Nobita's Dorabian Nights
          </p>

          <p className="text-sm text-muted-foreground">
            Welcome back, {user?.email}
          </p>
        </div>

        {/* Admin Button */}
        {isAdmin && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              className="gap-2 shadow-md"
              onClick={() => navigate("/admin")}
            >
              <Shield className="w-4 h-4" />
              Admin Panel
            </Button>
          </div>
        )}

        {/* Booking Card */}
        <Card className="border-2 border-primary/20 shadow-xl rounded-2xl backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Ticket className="w-6 h-6 text-primary" />
              Your Booking Status
            </CardTitle>
          </CardHeader>

          <CardContent className="text-center space-y-6">
            {loading ? (
              <p className="text-muted-foreground">Loading your status...</p>
            ) : booking ? (
              <>
                <div className="inline-flex items-center justify-center w-28 h-28 bg-primary rounded-3xl shadow-lg">
                  <span className="text-4xl font-bold text-primary-foreground">
                    {getSeatLabel(booking.row_num, booking.col_num)}
                  </span>
                </div>

                <div className="space-y-2">
                  <Badge className="px-4 py-1 text-sm bg-green-500 text-white">
                    Seat Frozen
                  </Badge>
                  <p className="text-muted-foreground text-sm">
                    Contact admin if you need to change your seat.
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <Armchair className="w-16 h-16 mx-auto text-muted-foreground" />
                <p className="text-lg text-muted-foreground">
                  You haven't booked a seat yet
                </p>
                <Button
                  size="lg"
                  className="px-8 py-6 text-lg gap-2 shadow-lg"
                  onClick={() => navigate("/book")}
                >
                  <Ticket className="w-5 h-5" />
                  Book Your Seat
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            className="gap-2 text-muted-foreground"
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

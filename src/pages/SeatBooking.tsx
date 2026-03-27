// src/pages/SeatBooking.tsx
// ✅ UPDATED - Shinchan jungle theme + Live realtime updates + Professional minimal design

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Monitor } from "lucide-react";

interface Seat {
  id: string;
  row_num: number;
  col_num: number;
  is_booked: boolean;
}

const SeatBooking = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [layout, setLayout] = useState<{ total_rows: number; total_columns: number } | null>(null);

  // ================= FETCH + REALTIME =================
  useEffect(() => {
    const fetchData = async () => {
      const { data: layoutData } = await supabase
        .from("seat_layout")
        .select("total_rows, total_columns")
        .single();

      setLayout(layoutData);

      const { data: seatsData } = await supabase
        .from("seats")
        .select("id, row_num, col_num, is_booked")
        .order("row_num")
        .order("col_num");

      setSeats(seatsData || []);
      setLoading(false);
    };

    fetchData();

    // LIVE REALTIME - updates instantly when anyone books/unfreezes
    const channel = supabase
      .channel("seat-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seats" },
        (payload) => {
          setSeats((prev) =>
            prev.map((seat) =>
              seat.id === payload.new.id ? { ...payload.new } : seat
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getSeatLabel = (row: number, col: number) =>
    `${String.fromCharCode(64 + col)}${row}`;

  const handleSeatClick = (seat: Seat) => {
    if (seat.is_booked) return;
    setSelectedSeat(seat);
    setShowConfirm(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedSeat || !user) return;

    setBooking(true);

    const { error } = await supabase.from("bookings").insert({
      user_id: user.id,
      seat_id: selectedSeat.id,
    });

    if (error) {
      toast({
        title: "Booking Failed",
        description: error.message.includes("user_id")
          ? "You already have a booking!"
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Seat Frozen! 🎉",
        description: `Seat ${getSeatLabel(selectedSeat.row_num, selectedSeat.col_num)} is now yours!`,
      });
      navigate("/dashboard");
    }

    setBooking(false);
    setShowConfirm(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-amber-300">
        Loading seats...
      </div>
    );
  }

  const rows = layout?.total_rows || 0;

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-start justify-center relative overflow-hidden p-6 pt-12"
      style={{
        backgroundImage: `url('/shinchan-jungle-bg.jpg')`,
      }}
    >
      {/* Professional jungle overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/65 to-black/75" />

      <div className="relative z-10 max-w-6xl w-full mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4 text-white">
          <Button
            variant="ghost"
            className="text-amber-300 hover:text-white"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-semibold tracking-tight">Select Your Seat</h1>
        </div>

        {/* Stage */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md text-white px-12 py-4 rounded-t-3xl border-b-4 border-amber-400 shadow-2xl">
            <Monitor className="w-6 h-6" />
            <span className="font-semibold tracking-widest uppercase text-base">SCREEN</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-8 text-sm text-white">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-400 rounded border border-white/30" />
            Available
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-amber-400 rounded border border-white/30" />
            Selected
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-400 rounded border border-white/30" />
            Booked
          </div>
        </div>

        {/* Seat Grid */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-max md:flex md:justify-center">
            <div className="space-y-3">

              {Array.from({ length: rows }, (_, r) => {
                const rowNum = r + 1;

                return (
                  <div
                    key={r}
                    className="flex items-center gap-8 px-4 py-2 rounded-xl 
                       bg-white/5 backdrop-blur-sm border border-white/10"
                  >
                    {/* Sticky Row Number */}
                    <div className="sticky left-0 z-10 bg-black/70 px-2 py-1 rounded text-amber-300 text-sm font-semibold">
                      {rowNum}
                    </div>

                    {/* Seats */}
                    <div className="flex gap-3">

                      {/* Block A */}
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((col) => renderSeat(rowNum, col))}
                      </div>

                      {/* Aisle */}
                      <div className="w-4" />

                      {/* Block B */}
                      <div className="flex gap-1">
                        {[5, 6, 7, 8, 9, 10, 11, 12].map((col) =>
                          renderSeat(rowNum, col)
                        )}
                      </div>

                      {/* Aisle */}
                      <div className="w-4" />

                      {/* Block C */}
                      <div className="flex gap-1">
                        {[13, 14, 15, 16].map((col) => renderSeat(rowNum, col))}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Dialog - themed */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-white/95 border-amber-400">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-semibold text-zinc-800">
              Freeze Seat Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-600">
              You are about to freeze seat{" "}
              <strong className="text-amber-500">
                {selectedSeat && getSeatLabel(selectedSeat.row_num, selectedSeat.col_num)}
              </strong>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={booking} className="text-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBooking}
              disabled={booking}
              className="bg-amber-400 hover:bg-amber-300 text-black font-semibold"
            >
              {booking ? "Freezing..." : "Yes, Freeze It!"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  function renderSeat(row: number, col: number) {
    const seat = seats.find((s) => s.row_num === row && s.col_num === col);
    if (!seat) return <div key={col} className="w-10 h-10" />;

    const isSelected = selectedSeat?.id === seat.id;

    return (
      <button
        key={col}
        onClick={() => handleSeatClick(seat)}
        disabled={seat.is_booked}
        className={`w-11 h-11 rounded-2xl text-sm font-semibold transition-all duration-200 border-2
          ${seat.is_booked
            ? "bg-red-400 text-white border-red-400 cursor-not-allowed"
            : isSelected
              ? "bg-amber-400 text-black border-amber-400 scale-110 shadow-lg"
              : "bg-green-400 text-black border-green-400 hover:bg-green-300"
          }`}
      >
        {getSeatLabel(row, col)}
      </button>
    );
  }
};

export default SeatBooking;
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
        description:
          error.message.includes("user_id")
            ? "You already have a booking!"
            : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Seat Frozen! 🎉",
        description: `Seat ${getSeatLabel(
          selectedSeat.row_num,
          selectedSeat.col_num
        )} is now yours!`,
      });
      navigate("/dashboard");
    }

    setBooking(false);
    setShowConfirm(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading seats...
      </div>
    );
  }

  const rows = layout?.total_rows || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 p-6">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold">Select Your Seat</h1>
        </div>

        {/* Stage */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-10 py-3 rounded-t-xl border-b-4 border-primary shadow-md">
            <Monitor className="w-5 h-5" />
            <span className="font-semibold tracking-widest uppercase text-sm">
              Screen
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-accent border rounded" />
            Available
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-primary border rounded" />
            Selected
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-destructive/40 border rounded" />
            Booked
          </div>
        </div>

        {/* CENTERED SEAT GRID */}
        <div className="flex justify-center">
          <div className="space-y-3">

            {Array.from({ length: rows }, (_, r) => {
              const rowNum = r + 1;

              return (
                <div key={r} className="flex gap-8 items-center justify-center">

                  {/* Row Number */}
                  <div className="w-6 text-xs text-muted-foreground text-right">
                    {rowNum}
                  </div>

                  {/* Seats */}
                  <div className="flex gap-6">

                    {/* Block A */}
                    <div className="flex gap-1">
                      {[1,2,3,4].map((col) =>
                        renderSeat(rowNum, col)
                      )}
                    </div>

                    {/* Block B */}
                    <div className="flex gap-1">
                      {[5,6,7,8,9,10,11,12].map((col) =>
                        renderSeat(rowNum, col)
                      )}
                    </div>

                    {/* Block C */}
                    <div className="flex gap-1">
                      {[13,14,15,16].map((col) =>
                        renderSeat(rowNum, col)
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Freeze Seat Permanently? 🎫</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to freeze seat{" "}
              <strong>
                {selectedSeat &&
                  getSeatLabel(
                    selectedSeat.row_num,
                    selectedSeat.col_num
                  )}
              </strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={booking}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBooking}
              disabled={booking}
            >
              {booking ? "Freezing..." : "Yes, Freeze It!"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  function renderSeat(row: number, col: number) {
    const seat = seats.find(
      (s) => s.row_num === row && s.col_num === col
    );

    if (!seat)
      return <div key={col} className="w-10 h-10" />;

    const isSelected = selectedSeat?.id === seat.id;
    const isBooked = seat.is_booked;

    return (
      <button
        key={col}
        onClick={() => handleSeatClick(seat)}
        disabled={isBooked}
        className={`w-10 h-10 rounded-lg text-xs font-bold transition-all duration-200 
          ${
            isBooked
              ? "bg-destructive/30 text-destructive/60 border-2 border-destructive/20 cursor-not-allowed"
              : isSelected
              ? "bg-primary text-primary-foreground scale-110 border-2 border-primary shadow-lg"
              : "bg-accent text-accent-foreground hover:bg-primary hover:text-white border-2 border-accent"
          }`}
      >
        {getSeatLabel(row, col)}
      </button>
    );
  }
};

export default SeatBooking;

// src/pages/Admin.tsx
// ✅ COMPLETE & FIXED - Realtime + Multiple freeze/unfreeze + Delete any booking

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

interface UserWithRole {
  id: string;
  email: string;
  role: "admin" | "user";
}

interface Seat {
  id: string;
  row_num: number;
  col_num: number;
  is_booked: boolean;
}

interface SeatLayout {
  id: string;
  total_rows: number;
  total_columns: number;
}

interface BookingInfo {
  id: string;
  user_id: string;
  user_email: string;
  seat_id: string;
  row_num: number;
  col_num: number;
}

const Admin = () => {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [layout, setLayout] = useState<SeatLayout | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [bookings, setBookings] = useState<BookingInfo[]>([]);

  const [newEmail, setNewEmail] = useState("");
  const [newUti, setNewUti] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [newRows, setNewRows] = useState("");

  const [editingBooking, setEditingBooking] = useState<BookingInfo | null>(null);
  const [newSeatId, setNewSeatId] = useState("");
  const [showLayoutConfirm, setShowLayoutConfirm] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }
    fetchAll();

    const channel = supabase
      .channel("admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "seats" }, fetchLayout)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, fetchBookings)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [isAdmin]);

  const fetchAll = async () => {
    await Promise.all([fetchUsers(), fetchLayout(), fetchBookings()]);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.rpc("get_all_users_with_roles");
    setUsers(data || []);
  };

  const handleAddUser = async () => {
    if (!newEmail || !newUti) return;
    const { error } = await supabase.functions.invoke("add_user", {
      body: { email: newEmail.trim().toLowerCase(), uti: newUti.trim(), role: newRole },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "User Added ✅" });
    setNewEmail(""); setNewUti(""); setNewRole("user");
    fetchUsers();
  };

  const updateRole = async (userId: string, role: "admin" | "user") => {
    await supabase.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id" });
    toast({ title: "Role Updated ✅" });
    fetchUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Delete this user permanently?")) return;
    const { error } = await supabase.functions.invoke("delete_user", { body: { user_id: userId } });
    if (error) {
      toast({ title: "Delete Failed ❌", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "User Deleted ✅" });
    fetchAll();
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);
    for (const row of rows) {
      const email = row.email?.toString().trim().toLowerCase();
      const uti = row.uti?.toString().trim();
      if (!email || !uti) continue;
      await supabase.functions.invoke("add_user", { body: { email, uti, role: "user" } });
    }
    toast({ title: "Excel Upload Complete ✅" });
    fetchUsers();
  };

  // ================= LAYOUT =================
  const fetchLayout = async () => {
    const { data: layoutData } = await supabase.from("seat_layout").select("*").single();
    const { data: seatsData } = await supabase.from("seats").select("*").order("row_num").order("col_num");
    setLayout(layoutData);
    setSeats(seatsData || []);
    if (layoutData) setNewRows(String(layoutData.total_rows));
  };

  const handleUpdateLayoutClick = () => setShowLayoutConfirm(true);

  const confirmUpdateLayout = async () => {
    if (!layout) return;
    await supabase.from("seat_layout").update({ total_rows: parseInt(newRows), total_columns: 16 }).eq("id", layout.id);
    await supabase.rpc("generate_seats_for_layout", { _layout_id: layout.id });
    toast({ title: "Layout Updated ✅" });
    setShowLayoutConfirm(false);
    fetchLayout();
  };

  // Admin freeze/unfreeze (multiple seats allowed)
  const handleToggleFreeze = async (seat: Seat) => {
    const existingBooking = bookings.find(b => b.seat_id === seat.id);

    if (existingBooking && existingBooking.user_id !== user?.id) {
      toast({
        title: "Cannot Unfreeze",
        description: `Freezed by ${existingBooking.user_email}`,
        variant: "destructive",
      });
      return;
    }

    await supabase.from("seats").update({ is_booked: !seat.is_booked }).eq("id", seat.id);

    toast({ title: seat.is_booked ? "Seat Unfrozen ✅" : "Seat Frozen ✅" });

    await fetchLayout();
    await fetchBookings();
  };

  // ================= BOOKINGS =================
  const fetchBookings = async () => {
    const { data } = await supabase.rpc("get_all_bookings_with_email");
    if (!data) return;
    setBookings(
      data.map((b: any) => ({
        id: b.id,
        user_id: b.user_id,
        user_email: b.email,
        seat_id: b.seat_id,
        row_num: b.row_num,
        col_num: b.col_num,
      }))
    );
  };

  const handleDeleteBooking = async (booking: BookingInfo) => {
    if (!window.confirm(`Delete booking for ${booking.user_email}?`)) return;

    await supabase.from("bookings").delete().eq("id", booking.id);
    await supabase.from("seats").update({ is_booked: false }).eq("id", booking.seat_id);

    toast({ title: "Booking Deleted & Seat Freed ✅" });
    fetchAll();
  };

  const handleModifyBooking = async () => {
    if (!editingBooking || !newSeatId) return;
    await supabase.from("seats").update({ is_booked: false }).eq("id", editingBooking.seat_id);
    await supabase.from("seats").update({ is_booked: true }).eq("id", newSeatId);
    await supabase.from("bookings").update({ seat_id: newSeatId }).eq("id", editingBooking.id);
    toast({ title: "Seat Updated ✅" });
    setEditingBooking(null);
    setNewSeatId("");
    fetchAll();
  };

  const availableSeats = seats.filter(s => !s.is_booked);

  const getSeatLabel = (row: number, col: number) =>
    `${String.fromCharCode(64 + col)}${row}`;

  const renderSeat = (row: number, col: number) => {
    const seat = seats.find(s => s.row_num === row && s.col_num === col);
    if (!seat) return null;

    const booking = bookings.find(b => b.seat_id === seat.id);
    const isMine = booking && user && booking.user_id === user.id;

    let className = "w-9 h-9 rounded text-xs font-medium transition-all flex items-center justify-center border";
    let title = "";

    if (!seat.is_booked) {
      className += " bg-green-400 hover:bg-green-300 text-black border-green-300";
      title = "Click to freeze";
    } else if (isMine || !booking) {
      className += " bg-amber-400 hover:bg-amber-300 text-black border-amber-300";
      title = "Freezed by you – click to unfreeze";
    } else {
      className += " bg-red-400 text-white cursor-not-allowed border-red-400";
      title = `Freezed by ${booking.user_email}`;
    }

    return (
      <button
        key={col}
        onClick={() => handleToggleFreeze(seat)}
        disabled={seat.is_booked && !isMine && !!booking}
        title={title}
        className={className}
      >
        {getSeatLabel(row, col)}
      </button>
    );
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-start justify-center relative overflow-hidden p-6 pt-12"
      style={{ backgroundImage: `url('/shinchan-jungle-bg.jpg')` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/65 to-black/75" />

      <div className="relative z-10 max-w-6xl w-full mx-auto space-y-6">
        <div className="flex items-center gap-4 text-white">
          <Button variant="ghost" className="text-amber-300 hover:text-white" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={18} /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-semibold tracking-tight">Admin Panel</h1>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/10 backdrop-blur-md border border-amber-300/30">
            <TabsTrigger value="users" className="data-[state=active]:bg-amber-400 data-[state=active]:text-black">Users</TabsTrigger>
            <TabsTrigger value="layout" className="data-[state=active]:bg-amber-400 data-[state=active]:text-black">Layout</TabsTrigger>
            <TabsTrigger value="bookings" className="data-[state=active]:bg-amber-400 data-[state=active]:text-black">Bookings</TabsTrigger>
          </TabsList>

          {/* USERS TAB */}
          <TabsContent value="users">
            <Card className="bg-white/95 border-amber-300/30 shadow-xl backdrop-blur-md">
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-wrap gap-3">
                  <Input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="flex-1" />
                  <Input placeholder="UTI" value={newUti} onChange={e => setNewUti(e.target.value)} className="flex-1" />
                  <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddUser}><Plus size={16} className="mr-2" /> Add User</Button>
                </div>

                <div>
                  <Label className="text-amber-400">Upload Excel (email | uti)</Label>
                  <Input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} />
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>
                          <Select value={u.role} onValueChange={(val: any) => updateRole(u.id, val)}>
                            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteUser(u.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LAYOUT TAB */}
          <TabsContent value="layout">
            <Card className="bg-white/95 border-amber-300/30 shadow-xl backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-xl">Seat Layout (4-8-4)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4">
                  <Input type="number" value={newRows} onChange={e => setNewRows(e.target.value)} placeholder="Total Rows" />
                  <Button onClick={handleUpdateLayoutClick}>Update Layout</Button>
                </div>

                {layout && Array.from({ length: layout.total_rows }, (_, r) => {
                  const row = r + 1;
                  return (
                    <div key={r} className="flex gap-6 justify-center">
                      <div className="flex gap-1">{[1,2,3,4].map(c => renderSeat(row, c))}</div>
                      <div className="flex gap-1">{[5,6,7,8,9,10,11,12].map(c => renderSeat(row, c))}</div>
                      <div className="flex gap-1">{[13,14,15,16].map(c => renderSeat(row, c))}</div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BOOKINGS TAB - Delete any booking */}
          <TabsContent value="bookings">
            <Card className="bg-white/95 border-amber-300/30 shadow-xl backdrop-blur-md">
              <CardContent className="p-6 space-y-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Seat</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{getSeatLabel(b.row_num, b.col_num)}</TableCell>
                        <TableCell>{b.user_email}</TableCell>
                        <TableCell className="text-right flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setEditingBooking(b)}>
                            Change
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteBooking(b)}>
                            <Trash2 size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {editingBooking && (
                  <div className="border border-amber-300/30 p-6 rounded-3xl bg-white/80 space-y-4">
                    <p className="font-medium">Change seat for <span className="text-amber-600">{editingBooking.user_email}</span></p>
                    <Select onValueChange={setNewSeatId}>
                      <SelectTrigger><SelectValue placeholder="Select new seat" /></SelectTrigger>
                      <SelectContent>
                        {availableSeats.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {getSeatLabel(s.row_num, s.col_num)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-3">
                      <Button onClick={handleModifyBooking}>Save Change</Button>
                      <Button variant="outline" onClick={() => setEditingBooking(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Layout Update Confirmation */}
      <AlertDialog open={showLayoutConfirm} onOpenChange={setShowLayoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Seat Layout?</AlertDialogTitle>
            <AlertDialogDescription>This will regenerate all seats. Existing bookings will be lost.<br />Are you sure?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUpdateLayout}>Yes, Update</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
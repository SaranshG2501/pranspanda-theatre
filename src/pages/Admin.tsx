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
  const { isAdmin } = useAuth();
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

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }
    fetchAll();
  }, [isAdmin]);

  const fetchAll = async () => {
    await fetchUsers();
    await fetchLayout();
    await fetchBookings();
  };

  // ================= USERS =================

  const fetchUsers = async () => {
    const { data } = await supabase.rpc("get_all_users_with_roles");
    setUsers(data || []);
  };

  const handleAddUser = async () => {
    if (!newEmail || !newUti) return;

    const { error } = await supabase.functions.invoke("add_user", {
      body: { email: newEmail, uti: newUti, role: newRole },
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "User Added ✅" });
    setNewEmail("");
    setNewUti("");
    fetchUsers();
  };

  const updateRole = async (userId: string, role: "admin" | "user") => {
    await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id" });

    toast({ title: "Role Updated ✅" });
    fetchUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this user? This will permanently remove their account and booking."
    );

    if (!confirmDelete) return;

    try {
      const { data, error } = await supabase.functions.invoke("delete_user", {
        body: { user_id: userId },
      });

      if (error) {
        toast({
          title: "Delete Failed ❌",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "User Deleted Successfully ✅",
        description: "The user and all related data have been removed.",
      });

      // Refresh everything
      await fetchAll();

    } catch (err: any) {
      toast({
        title: "Unexpected Error ❌",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    }
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

      await supabase.functions.invoke("add_user", {
        body: { email, uti, role: "user" },
      });
    }

    toast({ title: "Excel Upload Complete ✅" });
    fetchUsers();
  };

  // ================= LAYOUT =================

  const fetchLayout = async () => {
    const layoutRes = await supabase.from("seat_layout").select("*").single();
    const seatsRes = await supabase.from("seats").select("*").order("row_num").order("col_num");

    setLayout(layoutRes.data);
    setSeats(seatsRes.data || []);
    if (layoutRes.data) setNewRows(String(layoutRes.data.total_rows));
  };

  const handleUpdateLayout = async () => {
    if (!layout) return;

    await supabase
      .from("seat_layout")
      .update({ total_rows: parseInt(newRows), total_columns: 16 })
      .eq("id", layout.id);

    await supabase.rpc("generate_seats_for_layout", {
      _layout_id: layout.id,
    });

    toast({ title: "Layout Updated (4-8-4)" });
    fetchLayout();
  };

  const handleToggleFreeze = async (seat: Seat) => {
    await supabase
      .from("seats")
      .update({ is_booked: !seat.is_booked })
      .eq("id", seat.id);

    fetchLayout();
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


  const handleModifyBooking = async () => {
    if (!editingBooking || !newSeatId) return;

    await supabase
      .from("bookings")
      .update({ seat_id: newSeatId })
      .eq("id", editingBooking.id);

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
    return (
      <button
        key={col}
        onClick={() => handleToggleFreeze(seat)}
        className={`w-8 h-8 rounded text-xs ${seat.is_booked ? "bg-red-400" : "bg-green-400"
          }`}
      >
        {getSeatLabel(row, col)}
      </button>
    );
  };

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={16} /> Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
          </TabsList>

          {/* USERS TAB */}
          <TabsContent value="users">
            <Card>
              <CardContent className="space-y-4 p-6">

                <div className="flex gap-2">
                  <Input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                  <Input placeholder="Password" value={newUti} onChange={e => setNewUti(e.target.value)} />
                  <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddUser}><Plus size={14} /> Add</Button>
                </div>

                <Label>Upload Excel (email | uti)</Label>
                <Input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} />

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.id}>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Select value={u.role} onValueChange={(val: any) => updateRole(u.id, val)}>
                            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
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
            <Card>
              <CardHeader><CardTitle>Seat Layout (4-8-4)</CardTitle></CardHeader>
              <CardContent className="space-y-4">

                <div className="flex gap-4">
                  <Input type="number" value={newRows} onChange={e => setNewRows(e.target.value)} />
                  <Button onClick={handleUpdateLayout}>Update Layout</Button>
                </div>

                {layout && Array.from({ length: layout.total_rows }, (_, r) => {
                  const row = r + 1;
                  return (
                    <div key={r} className="flex gap-6">
                      <div className="flex gap-1">{[1, 2, 3, 4].map(c => renderSeat(row, c))}</div>
                      <div className="flex gap-1">{[5, 6, 7, 8, 9, 10, 11, 12].map(c => renderSeat(row, c))}</div>
                      <div className="flex gap-1">{[13, 14, 15, 16].map(c => renderSeat(row, c))}</div>
                    </div>
                  )
                })}

              </CardContent>
            </Card>
          </TabsContent>

          {/* BOOKINGS TAB */}
          <TabsContent value="bookings">
            <Card>
              <CardContent className="p-6 space-y-4">

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Seat</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Modify</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map(b => (
                      <TableRow key={b.id}>
                        <TableCell>{getSeatLabel(b.row_num, b.col_num)}</TableCell>
                        <TableCell>{b.user_email}</TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => setEditingBooking(b)}>Change</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {editingBooking && (
                  <div className="border p-4 rounded-lg space-y-3">
                    <div>Change seat for {editingBooking.user_email}</div>
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

                    <div className="flex gap-2">
                      <Button onClick={handleModifyBooking}>Save</Button>
                      <Button variant="outline" onClick={() => setEditingBooking(null)}>Cancel</Button>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
};

export default Admin;

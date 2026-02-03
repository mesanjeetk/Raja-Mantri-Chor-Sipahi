import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useSocket } from "../provider/SocketProvider"
import { Button } from "../components/Button"
import { Input } from "../components/Input"
import { Modal } from "../components/Modal"
import { Card } from "../components/Card"

interface Room {
    roomId: string;
    hasPassword: boolean;
    creatorId: string;
    playerCount: number;
    maxPlayers: number;
    state: string;
}

const Home = () => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const { socket, isConnected } = useSocket();

    // State
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

    // Create room form
    const [createForm, setCreateForm] = useState({
        password: '',
        maxPlayers: 4
    });

    // Join room form
    const [joinForm, setJoinForm] = useState({
        password: ''
    });

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Fetch rooms on mount
    useEffect(() => {
        if (socket) {
            socket.emit('getRooms', { filters: { notFull: true } }, (response: any) => {
                if (response.success) {
                    setRooms(response.rooms);
                }
            });

            // Listen for room list updates
            socket.on('roomListUpdated', ({ rooms: updatedRooms }) => {
                setRooms(updatedRooms);
            });

            return () => {
                socket.off('roomListUpdated');
            };
        }
    }, [socket]);

    const handleCreateRoom = () => {
        if (!socket) return;

        setIsLoading(true);
        setError('');

        socket.emit('createRoom', createForm, (response: any) => {
            setIsLoading(false);

            if (response.success) {
                setIsCreateModalOpen(false);
                navigate('/game-room');
            } else {
                setError(response.error || 'Failed to create room');
            }
        });
    };

    const handleJoinRoom = () => {
        if (!socket || !selectedRoom) return;

        setIsLoading(true);
        setError('');

        socket.emit('joinRoom', {
            roomId: selectedRoom.roomId,
            password: joinForm.password
        }, (response: any) => {
            setIsLoading(false);

            if (response.success) {
                setIsJoinModalOpen(false);
                navigate('/game-room');
            } else {
                setError(response.error || 'Failed to join room');
            }
        });
    };

    const openJoinModal = (room: Room) => {
        setSelectedRoom(room);
        setJoinForm({ password: '' });
        setError('');
        setIsJoinModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#141b3d] to-[#0a0e27]">
            {/* Header */}
            <header className="border-b border-white/10 backdrop-blur-sm bg-white/5">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-white bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            Raja Mantri Chor Sipahi
                        </h1>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-sm text-gray-400">
                                    {isConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>

                            <div className="text-white px-4 py-2 bg-white/10 rounded-lg">
                                {user?.username}
                            </div>

                            <Button variant="ghost" size="sm" onClick={signOut}>
                                Sign Out
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                {/* Hero Section */}
                <div className="text-center mb-12">
                    <h2 className="text-5xl font-bold text-white mb-4">
                        Welcome to the Lobby
                    </h2>
                    <p className="text-gray-400 text-lg mb-8">
                        Create a room or join an existing one to start playing
                    </p>

                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => {
                            setCreateForm({ password: '', maxPlayers: 4 });
                            setError('');
                            setIsCreateModalOpen(true);
                        }}
                        disabled={!isConnected}
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Room
                    </Button>
                </div>

                {/* Rooms List */}
                <div>
                    <h3 className="text-2xl font-bold text-white mb-6">Available Rooms</h3>

                    {rooms.length === 0 ? (
                        <Card className="text-center py-12">
                            <p className="text-gray-400 text-lg">No rooms available. Create one to get started!</p>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {rooms.map((room) => (
                                <Card key={room.roomId} className="hover:scale-105">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xl font-bold text-white">Room {room.roomId}</h4>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${room.state === 'waiting' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                                                }`}>
                                                {room.state}
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-400">Players</span>
                                                <span className="text-white font-semibold">
                                                    {room.playerCount}/{room.maxPlayers}
                                                </span>
                                            </div>

                                            {room.hasPassword && (
                                                <div className="flex items-center gap-2 text-sm text-yellow-400">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                    </svg>
                                                    Password Protected
                                                </div>
                                            )}
                                        </div>

                                        <Button
                                            variant="secondary"
                                            size="md"
                                            className="w-full"
                                            onClick={() => openJoinModal(room)}
                                            disabled={room.playerCount >= room.maxPlayers}
                                        >
                                            Join Room
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Create Room Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Create New Room"
            >
                <div className="space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <Input
                        type="password"
                        label="Password (Optional)"
                        placeholder="Leave empty for no password"
                        value={createForm.password}
                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Max Players
                        </label>
                        <select
                            value={createForm.maxPlayers}
                            onChange={(e) => setCreateForm({ ...createForm, maxPlayers: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value={4}>4 Players</option>
                        </select>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            variant="secondary"
                            onClick={() => setIsCreateModalOpen(false)}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleCreateRoom}
                            isLoading={isLoading}
                            className="flex-1"
                        >
                            Create
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Join Room Modal */}
            <Modal
                isOpen={isJoinModalOpen}
                onClose={() => setIsJoinModalOpen(false)}
                title={`Join Room ${selectedRoom?.roomId}`}
            >
                <div className="space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {selectedRoom?.hasPassword && (
                        <Input
                            type="password"
                            label="Room Password"
                            placeholder="Enter room password"
                            value={joinForm.password}
                            onChange={(e) => setJoinForm({ password: e.target.value })}
                        />
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button
                            variant="secondary"
                            onClick={() => setIsJoinModalOpen(false)}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleJoinRoom}
                            isLoading={isLoading}
                            className="flex-1"
                        >
                            Join
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default Home
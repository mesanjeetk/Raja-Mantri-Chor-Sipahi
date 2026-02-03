interface GameCardProps {
    card: 'Raja' | 'Mantri' | 'Chor' | 'Sipahi';
    isRevealed?: boolean;
}

const GameCard = ({ card, isRevealed = false }: GameCardProps) => {
    const cardColors = {
        Raja: 'from-yellow-500 to-orange-500',
        Mantri: 'from-blue-500 to-indigo-500',
        Chor: 'from-red-500 to-pink-500',
        Sipahi: 'from-green-500 to-emerald-500',
    };

    const cardIcons = {
        Raja: '👑',
        Mantri: '🎓',
        Chor: '🎭',
        Sipahi: '⚔️',
    };

    return (
        <div className="relative w-full aspect-[3/4] perspective-1000">
            <div
                className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isRevealed ? 'rotate-y-180' : ''
                    }`}
            >
                {/* Card Back */}
                <div className="absolute w-full h-full backface-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl border-2 border-white/20 shadow-xl flex items-center justify-center">
                        <div className="text-6xl">🎴</div>
                    </div>
                </div>

                {/* Card Front */}
                <div className="absolute w-full h-full backface-hidden rotate-y-180">
                    <div className={`w-full h-full bg-gradient-to-br ${cardColors[card]} rounded-xl border-2 border-white/30 shadow-2xl p-4 flex flex-col items-center justify-center`}>
                        <div className="text-7xl mb-4">{cardIcons[card]}</div>
                        <div className="text-white text-2xl font-bold">{card}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameCard;